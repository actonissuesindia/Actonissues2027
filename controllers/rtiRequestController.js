const RTIRequest = require('../models/RTIRequest');
const Issue = require('../models/Issue');
const User = require('../models/User');
const { isStaff, isLegalStaff } = require('../middleware/auth');
const { notify } = require('../services/notifyService');

const useGCS = !!process.env.GCS_BUCKET;
const gcs = useGCS ? require('../services/gcsService') : null;

// `citizen`/`lawyer` may be a raw ObjectId (most actions fetch the request
// unpopulated) or a populated object with its own `_id` (list/get do
// populate them, and get/list use .lean() too) — this normalizes either
// shape to a comparable string instead of assuming one or the other,
// since `String()` on a populated object does not reliably yield its ID.
const idOf = (value) => String((value && value._id) ? value._id : value);
const isOwner = (req, request) => idOf(request.citizen) === String(req.user._id);
const isAssignedLawyer = (req, request) => request.lawyer && idOf(request.lawyer) === String(req.user._id);
// Anyone allowed to act as "the legal side" of a request: staff always,
// or the lawyer actually assigned to this specific one.
const canActAsLegal = (req, request) => isStaff(req.user) || isAssignedLawyer(req, request);

// A citizen viewing their own request should only ever see the same
// effective display name shown on the public "Find a Lawyer" directory
// (controllers/lawyerController.js's toPublicLawyer) — never the lawyer's
// real account name/lawyerProfile, even though staff and the lawyer
// themselves legitimately see the real identity elsewhere (e.g. the
// Admin dashboard's assignment dropdown, sourced separately from
// /api/admin/users). Mutates the already-populated `lawyer` field on a
// lean/plain request object in place.
function maskLawyerForCitizen(request) {
  if (request.lawyer && request.lawyer.name !== undefined) {
    const displayName = request.lawyer.lawyerProfile?.displayName;
    request.lawyer = { _id: request.lawyer._id, avatar: request.lawyer.avatar, name: displayName || request.lawyer.name };
  }
  return request;
}

// GET /api/rti-requests/meta
exports.meta = async (req, res, next) => {
  try {
    res.json({
      success: true,
      statuses: RTIRequest.STATUSES,
      jurisdictions: RTIRequest.JURISDICTIONS,
      states: Issue.INDIAN_STATES,
      requestTypes: RTIRequest.REQUEST_TYPES
    });
  } catch (err) {
    next(err);
  }
};

// GET /api/rti-requests?mine=true|lawyer=me|unassigned=true|status=
exports.list = async (req, res, next) => {
  try {
    const { status, lawyer, unassigned, mine } = req.query;
    const filter = {};
    if (status) filter.status = String(status);

    if (mine === 'true') {
      // A citizen can only ever see their own — forced regardless of any
      // other filter someone might pass.
      filter.citizen = req.user._id;
    } else if (unassigned === 'true') {
      // The claimable pool — only meaningful for Lawyer/staff, and only
      // ever unclaimed, still-open requests.
      if (req.user.role !== 'Lawyer' && !isStaff(req.user)) {
        return res.status(403).json({ success: false, message: 'Forbidden' });
      }
      filter.lawyer = { $exists: false };
      filter.status = 'Submitted';
    } else if (lawyer === 'me') {
      if (req.user.role !== 'Lawyer' && !isStaff(req.user)) {
        return res.status(403).json({ success: false, message: 'Forbidden' });
      }
      filter.lawyer = req.user._id;
    } else if (isStaff(req.user)) {
      // No extra filter — staff can browse everything.
    } else if (req.user.role === 'Lawyer') {
      // A Lawyer with no explicit filter defaults to their own assigned
      // requests, never someone else's or the raw unfiltered pool.
      filter.lawyer = req.user._id;
    } else {
      // A citizen calling without mine=true still only ever sees their own.
      filter.citizen = req.user._id;
    }

    let requests = await RTIRequest.find(filter)
      .populate('citizen', 'name avatar')
      .populate('lawyer', 'name avatar lawyerProfile.displayName')
      .sort({ createdAt: -1 })
      .lean();
    if (!isStaff(req.user) && req.user.role !== 'Lawyer') {
      requests = requests.map(maskLawyerForCitizen);
    }
    res.json({ success: true, requests });
  } catch (err) {
    next(err);
  }
};

// A lawyer's UPI/bank details are never part of the public directory
// (controllers/lawyerController.js) — they only ever surface here, and
// only once the citizen who owns this specific request actually has a
// fee to pay (Fee Quoted or any later stage), never before and never to
// anyone but that citizen.
const PAYMENT_VISIBLE_STATUSES = ['Fee Quoted', 'Accepted', 'Filed', 'Resolved'];

// GET /api/rti-requests/:id
exports.get = async (req, res, next) => {
  try {
    let request = await RTIRequest.findById(req.params.id)
      .populate('citizen', 'name avatar')
      .populate('lawyer', 'name avatar lawyerProfile.displayName')
      .populate('workNotes.author', 'name avatar')
      .lean();
    if (!request) return res.status(404).json({ success: false, message: 'Request not found' });
    if (!isOwner(req, request) && !isLegalStaff(req.user)) {
      return res.status(403).json({ success: false, message: 'Forbidden' });
    }

    let paymentDetails = null;
    if (isOwner(req, request) && request.lawyer && PAYMENT_VISIBLE_STATUSES.includes(request.status)) {
      const lawyerUser = await User.findById(request.lawyer._id).select('name lawyerProfile.displayName lawyerProfile.upiId lawyerProfile.bankDetails');
      if (lawyerUser?.lawyerProfile?.upiId || lawyerUser?.lawyerProfile?.bankDetails?.accountNumber) {
        paymentDetails = {
          payeeName: lawyerUser.lawyerProfile.displayName || lawyerUser.name,
          upiId: lawyerUser.lawyerProfile.upiId || null,
          bankDetails: lawyerUser.lawyerProfile.bankDetails || null
        };
      }
    }

    if (isOwner(req, request)) {
      request = maskLawyerForCitizen(request);
    }

    res.json({ success: true, request, paymentDetails });
  } catch (err) {
    next(err);
  }
};

// POST /api/rti-requests  (citizen-only)  { requestType, subject, description,
// publicAuthority?, jurisdiction?, state?, applicantAddress?, lawyer? }
// The four RTI-specific fields are only required when requestType is
// 'RTI' — every other type just needs subject/description, same as any
// other request for legal help. `lawyer`, if given (from the Find a
// Lawyer directory), assigns the request directly instead of leaving it
// in the shared unclaimed pool.
exports.create = async (req, res, next) => {
  try {
    if (req.user.role !== 'Citizen') {
      return res.status(403).json({ success: false, message: 'Only citizen accounts can file a legal assistance request' });
    }
    const { requestType, subject, description, publicAuthority, jurisdiction, state, applicantAddress, lawyer } = req.body;
    if (!subject || !description) {
      return res.status(400).json({ success: false, message: 'Subject and description are required' });
    }
    const type = requestType && RTIRequest.REQUEST_TYPES.includes(requestType) ? requestType : 'RTI';

    if (type === 'RTI') {
      if (!publicAuthority || !jurisdiction || !applicantAddress) {
        return res.status(400).json({ success: false, message: 'Public authority, jurisdiction, and your address are all required for an RTI request' });
      }
      if (!RTIRequest.JURISDICTIONS.includes(jurisdiction)) {
        return res.status(400).json({ success: false, message: 'Invalid jurisdiction' });
      }
      if (jurisdiction === 'State' && !state) {
        return res.status(400).json({ success: false, message: 'State is required for a State-jurisdiction request' });
      }
    }

    let lawyerId;
    if (lawyer) {
      // Same eligibility as the public directory (controllers/
      // lawyerController.js's DIRECTORY_FILTER) — a citizen can only ever
      // direct-request someone who'd actually show up there, Lawyer or an
      // opted-in Admin, never an unlisted account of either role.
      const lawyerUser = await User.findOne({
        _id: lawyer,
        isDisabled: { $ne: true },
        $or: [
          { role: 'Lawyer', 'lawyerProfile.isListed': { $ne: false } },
          { role: 'Admin', 'lawyerProfile.isListed': true }
        ]
      });
      if (!lawyerUser) return res.status(400).json({ success: false, message: 'Selected lawyer not found' });
      lawyerId = lawyerUser._id;
    }

    const request = await RTIRequest.create({
      citizen: req.user._id,
      requestType: type,
      subject, description,
      publicAuthority: type === 'RTI' ? publicAuthority : publicAuthority || undefined,
      jurisdiction: type === 'RTI' ? jurisdiction : undefined,
      state: type === 'RTI' && jurisdiction === 'State' ? state : undefined,
      applicantAddress: type === 'RTI' ? applicantAddress : undefined,
      lawyer: lawyerId
    });

    await notify(req.user._id, {
      title: 'Legal assistance request submitted',
      message: `Your request "${subject}" has been submitted and is awaiting review.`,
      link: `/rti/${request._id}`
    });

    if (lawyerId) {
      await notify(lawyerId, {
        title: 'A citizen has requested your help',
        message: `"${subject}" (${type}) was sent directly to you.`,
        link: `/lawyer`
      });
    }

    res.status(201).json({ success: true, request });
  } catch (err) {
    next(err);
  }
};

// POST /api/rti-requests/:id/claim  (Lawyer, or Admin acting as one, self-serve pickup)
exports.claim = async (req, res, next) => {
  try {
    if (req.user.role !== 'Lawyer' && req.user.role !== 'Admin') {
      return res.status(403).json({ success: false, message: 'Only a Lawyer account can claim a request' });
    }
    const request = await RTIRequest.findById(req.params.id);
    if (!request) return res.status(404).json({ success: false, message: 'Request not found' });
    if (request.lawyer) return res.status(409).json({ success: false, message: 'This request has already been claimed' });
    if (request.status !== 'Submitted') {
      return res.status(409).json({ success: false, message: 'Only a newly submitted request can be claimed' });
    }
    request.lawyer = req.user._id;
    request.lastUpdatedBy = req.user._id;
    await request.save();
    res.json({ success: true, request });
  } catch (err) {
    next(err);
  }
};

// PATCH /api/rti-requests/:id/assign  { lawyer }  (staff picks a lawyer)
exports.assign = async (req, res, next) => {
  try {
    if (!isStaff(req.user)) return res.status(403).json({ success: false, message: 'Forbidden' });
    const { lawyer } = req.body;
    const request = await RTIRequest.findById(req.params.id);
    if (!request) return res.status(404).json({ success: false, message: 'Request not found' });
    request.lawyer = lawyer || undefined;
    request.lastUpdatedBy = req.user._id;
    await request.save();
    res.json({ success: true, request });
  } catch (err) {
    next(err);
  }
};

// POST /api/rti-requests/:id/quote  { isFree, quotedFee, quoteNote }
exports.quote = async (req, res, next) => {
  try {
    const request = await RTIRequest.findById(req.params.id);
    if (!request) return res.status(404).json({ success: false, message: 'Request not found' });
    if (!canActAsLegal(req, request)) return res.status(403).json({ success: false, message: 'Forbidden' });
    if (request.status !== 'Submitted') {
      return res.status(409).json({ success: false, message: 'A fee can only be quoted on a newly submitted request' });
    }
    const { isFree, quotedFee, quoteNote } = req.body;
    if (!isFree && (quotedFee === undefined || quotedFee === null || isNaN(Number(quotedFee)) || Number(quotedFee) < 0)) {
      return res.status(400).json({ success: false, message: 'A valid quoted fee is required, or mark this request as free' });
    }

    request.status = 'Fee Quoted';
    request.isFree = !!isFree;
    request.quotedFee = isFree ? 0 : Number(quotedFee);
    request.quoteNote = quoteNote || '';
    request.quotedAt = new Date();
    request.quotedBy = req.user._id;
    request.lastUpdatedBy = req.user._id;
    await request.save();

    await notify(request.citizen, {
      title: 'A fee was quoted for your legal request',
      message: `"${request.subject}" — ${request.isFree ? 'the lawyer will handle this free of charge' : `quoted fee ₹${request.quotedFee}`}${request.quoteNote ? `: ${request.quoteNote}` : ''}. Please accept or decline.`,
      link: `/rti/${request._id}`
    });

    res.json({ success: true, request });
  } catch (err) {
    next(err);
  }
};

// POST /api/rti-requests/:id/decline  { reason }  (Lawyer/staff declines before quoting)
exports.decline = async (req, res, next) => {
  try {
    const request = await RTIRequest.findById(req.params.id);
    if (!request) return res.status(404).json({ success: false, message: 'Request not found' });
    if (!canActAsLegal(req, request)) return res.status(403).json({ success: false, message: 'Forbidden' });
    if (request.status !== 'Submitted') {
      return res.status(409).json({ success: false, message: 'Only a newly submitted request can be declined this way' });
    }
    request.status = 'Rejected';
    request.rejectedBy = 'Lawyer';
    request.rejectionReason = req.body.reason || '';
    request.decisionAt = new Date();
    request.lastUpdatedBy = req.user._id;
    await request.save();

    await notify(request.citizen, {
      title: 'Your RTI request was declined',
      message: `"${request.subject}" could not be taken up${request.rejectionReason ? `: ${request.rejectionReason}` : '.'}`,
      link: `/rti/${request._id}`
    });

    res.json({ success: true, request });
  } catch (err) {
    next(err);
  }
};

// POST /api/rti-requests/:id/decision  { accept, reason }  (citizen accepts/rejects the quote)
exports.decision = async (req, res, next) => {
  try {
    const request = await RTIRequest.findById(req.params.id);
    if (!request) return res.status(404).json({ success: false, message: 'Request not found' });
    if (!isOwner(req, request)) return res.status(403).json({ success: false, message: 'Forbidden' });
    if (request.status !== 'Fee Quoted') {
      return res.status(409).json({ success: false, message: 'There is no pending fee quote to respond to' });
    }

    const { accept, reason } = req.body;
    request.status = accept ? 'Accepted' : 'Rejected';
    if (!accept) {
      request.rejectedBy = 'Citizen';
      request.rejectionReason = reason || '';
    }
    request.decisionAt = new Date();
    request.lastUpdatedBy = req.user._id;
    await request.save();

    if (request.lawyer) {
      await notify(request.lawyer, {
        title: accept ? 'Your quote was accepted' : 'Your quote was declined',
        message: `"${request.subject}" — the citizen has ${accept ? 'accepted' : 'declined'} your quoted fee.`,
        link: `/lawyer`
      });
    }

    res.json({ success: true, request });
  } catch (err) {
    next(err);
  }
};

// POST /api/rti-requests/:id/file  { filedReferenceNumber }
exports.markFiled = async (req, res, next) => {
  try {
    const request = await RTIRequest.findById(req.params.id);
    if (!request) return res.status(404).json({ success: false, message: 'Request not found' });
    if (!canActAsLegal(req, request)) return res.status(403).json({ success: false, message: 'Forbidden' });
    if (request.status !== 'Accepted') {
      return res.status(409).json({ success: false, message: 'Only an accepted request can be marked as filed' });
    }
    request.status = 'Filed';
    request.filedAt = new Date();
    request.filedReferenceNumber = req.body.filedReferenceNumber || '';
    request.lastUpdatedBy = req.user._id;
    await request.save();

    await notify(request.citizen, {
      title: 'Your RTI request has been filed',
      message: `"${request.subject}" has been filed with the concerned authority${request.filedReferenceNumber ? ` (reference: ${request.filedReferenceNumber})` : ''}.`,
      link: `/rti/${request._id}`
    });

    res.json({ success: true, request });
  } catch (err) {
    next(err);
  }
};

// POST /api/rti-requests/:id/resolve  { responseSummary }  (+ optional attachments)
exports.resolve = async (req, res, next) => {
  try {
    const request = await RTIRequest.findById(req.params.id);
    if (!request) return res.status(404).json({ success: false, message: 'Request not found' });
    if (!canActAsLegal(req, request)) return res.status(403).json({ success: false, message: 'Forbidden' });
    if (request.status !== 'Filed') {
      return res.status(409).json({ success: false, message: 'Only a filed request can be marked resolved' });
    }

    if (req.files && req.files.length) {
      for (const file of req.files) {
        if (useGCS) {
          const { fileName, url } = await gcs.uploadFile(file);
          request.responseAttachments.push({ fileName, originalName: file.originalname, url });
        } else {
          request.responseAttachments.push({
            fileName: file.filename,
            originalName: file.originalname,
            url: '/uploads/' + file.filename
          });
        }
      }
    }

    request.status = 'Resolved';
    request.resolvedAt = new Date();
    request.responseSummary = req.body.responseSummary || '';
    request.lastUpdatedBy = req.user._id;
    await request.save();

    await notify(request.citizen, {
      title: 'Your RTI request has been resolved',
      message: `"${request.subject}" is now resolved.${request.responseSummary ? ` ${request.responseSummary}` : ''}`,
      link: `/rti/${request._id}`
    });

    res.json({ success: true, request });
  } catch (err) {
    next(err);
  }
};

// POST /api/rti-requests/:id/cancel  (citizen withdraws)
exports.cancel = async (req, res, next) => {
  try {
    const request = await RTIRequest.findById(req.params.id);
    if (!request) return res.status(404).json({ success: false, message: 'Request not found' });
    if (!isOwner(req, request)) return res.status(403).json({ success: false, message: 'Forbidden' });
    if (!['Submitted', 'Fee Quoted'].includes(request.status)) {
      return res.status(409).json({ success: false, message: 'This request can no longer be cancelled — it is already being acted on' });
    }
    request.status = 'Cancelled';
    request.cancelledAt = new Date();
    request.lastUpdatedBy = req.user._id;
    await request.save();

    if (request.lawyer) {
      await notify(request.lawyer, {
        title: 'An RTI request was withdrawn',
        message: `"${request.subject}" was cancelled by the citizen who filed it.`,
        link: `/lawyer`
      });
    }

    res.json({ success: true, request });
  } catch (err) {
    next(err);
  }
};

// POST /api/rti-requests/:id/notes  { note }  (Lawyer/staff-authored progress
// update — the "work notes / workflow" the citizen sees on their request,
// separate from and more frequent than the discrete status transitions
// above. Not restricted to a particular status — a lawyer can leave a note
// at any point while the request is still open.)
exports.addNote = async (req, res, next) => {
  try {
    const request = await RTIRequest.findById(req.params.id);
    if (!request) return res.status(404).json({ success: false, message: 'Request not found' });
    if (!canActAsLegal(req, request)) return res.status(403).json({ success: false, message: 'Forbidden' });
    const { note } = req.body;
    if (!note || !note.trim()) return res.status(400).json({ success: false, message: 'A note is required' });

    request.workNotes.push({ author: req.user._id, note: note.trim() });
    request.lastUpdatedBy = req.user._id;
    await request.save();
    await request.populate('workNotes.author', 'name avatar');

    await notify(request.citizen, {
      title: 'An update on your legal request',
      message: `"${request.subject}": ${note.trim()}`,
      link: `/rti/${request._id}`
    });

    res.status(201).json({ success: true, workNotes: request.workNotes });
  } catch (err) {
    next(err);
  }
};

// POST /api/rti-requests/:id/attachments  (multipart, field "attachments", up to 6 files)
exports.uploadAttachment = async (req, res, next) => {
  try {
    const request = await RTIRequest.findById(req.params.id);
    if (!request) return res.status(404).json({ success: false, message: 'Request not found' });
    if (!isOwner(req, request) && !isLegalStaff(req.user)) {
      return res.status(403).json({ success: false, message: 'Forbidden' });
    }
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ success: false, message: 'No files uploaded' });
    }

    for (const file of req.files) {
      if (useGCS) {
        const { fileName, url } = await gcs.uploadFile(file);
        request.attachments.push({ fileName, originalName: file.originalname, url });
      } else {
        request.attachments.push({
          fileName: file.filename,
          originalName: file.originalname,
          url: '/uploads/' + file.filename
        });
      }
    }
    await request.save();
    res.status(201).json({ success: true, attachments: request.attachments });
  } catch (err) {
    next(err);
  }
};

// DELETE /api/rti-requests/:id/attachments/:attachmentId
exports.removeAttachment = async (req, res, next) => {
  try {
    const request = await RTIRequest.findById(req.params.id);
    if (!request) return res.status(404).json({ success: false, message: 'Request not found' });
    if (!isOwner(req, request) && !isLegalStaff(req.user)) {
      return res.status(403).json({ success: false, message: 'Forbidden' });
    }
    const attachment = request.attachments.find(a => String(a._id) === req.params.attachmentId);
    if (useGCS && attachment) {
      await gcs.deleteFile(attachment.fileName).catch(() => {});
    }
    request.attachments = request.attachments.filter(a => String(a._id) !== req.params.attachmentId);
    await request.save();
    res.json({ success: true, attachments: request.attachments });
  } catch (err) {
    next(err);
  }
};
