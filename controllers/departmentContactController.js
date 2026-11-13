const DepartmentContact = require('../models/DepartmentContact');
const Issue = require('../models/Issue');
const { parseDepartmentReport } = require('../services/departmentImport');
const { LEVELS } = DepartmentContact;

const norm = (s) => (s || '').toLowerCase().trim();
const sameArea = (a, b) => !!a && !!b && (a === b || a.includes(b) || b.includes(a));

// GET /api/admin/departments — the same list backs both the management
// table (Departments tab) and the picker in EscalateIssueModal.jsx; there's
// no separate public endpoint since both surfaces are staff-only.
exports.list = async (req, res, next) => {
  try {
    const contacts = await DepartmentContact.find().sort({ state: 1, district: 1, mandal: 1, name: 1 }).populate('addedBy', 'name');
    res.json({ success: true, contacts });
  } catch (err) {
    next(err);
  }
};

// GET /api/admin/departments/lookup?issueNumber=AOI-000123 — resolves an
// issue's own location (already captured from its address, see
// AddressAutocomplete.jsx) and returns any saved Department Directory
// contacts covering it, grouped by hierarchy level, so staff can jump
// straight to escalating without hunting for the issue first. When a level
// has no saved contact yet, the frontend uses `issue.location` to show
// exactly what to look up on lgdirectory.gov.in instead of guessing.
exports.lookupByIssue = async (req, res, next) => {
  try {
    const raw = (req.query.issueNumber || '').trim();
    if (!raw) {
      return res.status(400).json({ success: false, message: 'Enter an issue ID (e.g. AOI-000123)' });
    }
    const issue = await Issue.findOne({ issueNumber: raw.toUpperCase() }, 'issueNumber title location');
    if (!issue) {
      return res.status(404).json({ success: false, message: `No issue found with ID "${raw}"` });
    }
    const loc = issue.location || {};
    const mandal = norm(loc.mandal) || norm(loc.city);
    const district = norm(loc.district);
    const state = norm(loc.state);

    const contacts = await DepartmentContact.find().sort({ name: 1 });
    const matches = { District: [], Mandal: [], Village: [], Other: [] };
    for (const c of contacts) {
      const cMandal = norm(c.mandal);
      const cDistrict = norm(c.district);
      const cState = norm(c.state);
      const isMatch =
        ((c.level === 'Village' || c.level === 'Mandal') && sameArea(mandal, cMandal)) ||
        (c.level === 'District' && sameArea(district, cDistrict)) ||
        (c.level === 'Other' && (sameArea(district, cDistrict) || sameArea(state, cState)));
      if (isMatch) matches[c.level].push(c);
    }

    res.json({
      success: true,
      issue: { _id: issue._id, issueNumber: issue.issueNumber, title: issue.title, location: loc },
      matches
    });
  } catch (err) {
    next(err);
  }
};

function validate(body, res) {
  const name = (body.name || '').trim();
  const email = (body.email || '').trim();
  if (!name) {
    res.status(400).json({ success: false, message: 'Department/office name is required' });
    return null;
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    res.status(400).json({ success: false, message: 'A valid email address is required' });
    return null;
  }
  const level = LEVELS.includes(body.level) ? body.level : 'Other';
  return {
    name,
    email: email.toLowerCase(),
    phone: (body.phone || '').trim(),
    level,
    state: (body.state || '').trim(),
    district: (body.district || '').trim(),
    mandal: level === 'Village' || level === 'Mandal' ? (body.mandal || '').trim() : '',
    notes: (body.notes || '').trim()
  };
}

// POST /api/admin/departments
exports.create = async (req, res, next) => {
  try {
    const data = validate(req.body, res);
    if (!data) return;
    let contact = await DepartmentContact.create({ ...data, addedBy: req.user._id });
    contact = await contact.populate('addedBy', 'name');
    res.status(201).json({ success: true, contact });
  } catch (err) {
    next(err);
  }
};

// PATCH /api/admin/departments/:id
exports.update = async (req, res, next) => {
  try {
    const data = validate(req.body, res);
    if (!data) return;
    const contact = await DepartmentContact.findByIdAndUpdate(req.params.id, data, { new: true }).populate('addedBy', 'name');
    if (!contact) return res.status(404).json({ success: false, message: 'Contact not found' });
    res.json({ success: true, contact });
  } catch (err) {
    next(err);
  }
};

// POST /api/admin/departments/import — bulk-loads a "PRI Localbody Email
// IDs" report exported from lgdirectory.gov.in (see services/departmentImport.js).
// Every row's email comes straight from that file, never guessed; existing
// contacts with the same email are updated in place (so re-uploading a
// refreshed export doesn't create duplicates) rather than skipped outright.
exports.importFromFile = async (req, res, next) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'Choose a file to import' });
    }
    const level = LEVELS.includes(req.body.level) ? req.body.level : 'Village';
    const state = (req.body.state || '').trim();
    const district = (req.body.district || '').trim();
    const mandal = level === 'Village' || level === 'Mandal' ? (req.body.mandal || '').trim() : '';
    let parsed;
    try {
      parsed = await parseDepartmentReport(req.file.buffer, req.file.originalname);
    } catch (parseErr) {
      return res.status(400).json({ success: false, message: "Couldn't read that file — make sure it's the report exported from lgdirectory.gov.in (or a .csv with the same columns)." });
    }
    if (!parsed.headerFound) {
      return res.status(400).json({ success: false, message: 'No "Local Body Name" + "Email ID" columns found in that file — is it the right report?' });
    }
    if (parsed.rows.length === 0) {
      return res.status(400).json({ success: false, message: 'That file has a matching header but no usable rows underneath it.' });
    }

    let created = 0;
    let updated = 0;
    for (const row of parsed.rows) {
      const result = await DepartmentContact.findOneAndUpdate(
        { email: row.email },
        { $set: { name: row.name, level, state, district, mandal, addedBy: req.user._id } },
        { upsert: true, new: true, rawResult: true }
      );
      if (result.lastErrorObject?.updatedExisting) updated++; else created++;
    }
    res.json({ success: true, created, updated, total: parsed.rows.length });
  } catch (err) {
    next(err);
  }
};

// DELETE /api/admin/departments/:id
exports.remove = async (req, res, next) => {
  try {
    const contact = await DepartmentContact.findByIdAndDelete(req.params.id);
    if (!contact) return res.status(404).json({ success: false, message: 'Contact not found' });
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
};
