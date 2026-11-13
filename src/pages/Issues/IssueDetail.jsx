import { useEffect, useState } from 'react';
import { useParams, Link, useNavigate, useLocation } from 'react-router-dom';
import api from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import burstConfetti from '../../utils/confetti';
import TopNav from '../../components/layout/TopNav';
import Avatar from '../../components/common/Avatar';
import StatusBadge from '../../components/common/StatusBadge';
import StatusStamp from '../../components/common/StatusStamp';
import ModerationBadge from '../../components/common/ModerationBadge';
import ApprovalCountdown from '../../components/common/ApprovalCountdown';
import IssuePlaceholder from '../../components/common/IssuePlaceholder';
import Lightbox from '../../components/common/Lightbox';
import BlurImage from '../../components/common/BlurImage';
import { isVideoAttachment } from '../../utils/attachmentType';
import SearchableSelect from '../../components/common/SearchableSelect';
import timeAgo from '../../utils/timeAgo';
import ShareIssueModal from '../../components/common/ShareIssueModal';
import EscalateIssueModal from '../../components/common/EscalateIssueModal';
import EscalationReply from '../../components/common/EscalationReply';
import AddressAutocomplete from '../../components/create/AddressAutocomplete';

const MAX_ATTACHMENTS = 6;

const STAFF_ROLES = ['Admin', 'Authority'];

export default function IssueDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const toast = useToast();
  const [issue, setIssue] = useState(null);
  const [lightboxIndex, setLightboxIndex] = useState(null);
  const [comments, setComments] = useState([]);
  const [meta, setMeta] = useState({ statuses: [] });
  const [text, setText] = useState('');
  const [loading, setLoading] = useState(true);
  const [replyTo, setReplyTo] = useState(null);
  const [replyText, setReplyText] = useState('');
  const [shareOpen, setShareOpen] = useState(false);
  const [escalateOpen, setEscalateOpen] = useState(false);
  const [escalations, setEscalations] = useState([]);
  const [editing, setEditing] = useState(false);
  const [editTitle, setEditTitle] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editTopic, setEditTopic] = useState('');
  const [editSubTopic, setEditSubTopic] = useState('');
  const [editCustomCategory, setEditCustomCategory] = useState('');
  const [editAddress, setEditAddress] = useState('');
  const [editCity, setEditCity] = useState('');
  const [editWard, setEditWard] = useState('');
  const [editDistrict, setEditDistrict] = useState('');
  const [editMandal, setEditMandal] = useState('');
  const [editState, setEditState] = useState('');
  const [editCoordinates, setEditCoordinates] = useState(null);
  const [editError, setEditError] = useState('');
  const [editBusy, setEditBusy] = useState(false);
  const [attachmentBusy, setAttachmentBusy] = useState(false);
  const [attachmentError, setAttachmentError] = useState('');

  const isStaff = user && STAFF_ROLES.includes(user.role);

  // Set by the Admin table (see AdminDashboard) when it links here, so staff
  // can step through the same list they were reviewing without bouncing
  // back to it after every approve/reject. Each queue entry carries just
  // enough (_id/moderationStatus/status) to filter here without refetching.
  // The filters start pre-set to whatever was active in the table, but can
  // be changed from this page too — the queue array itself never shrinks,
  // only which of it counts as "next" does.
  const queue = location.state?.queue;
  const [queueModFilter, setQueueModFilter] = useState(location.state?.moderationFilter || '');
  const [queueStatusFilter, setQueueStatusFilter] = useState(location.state?.issueStatusFilter || '');
  const filteredQueue = queue
    ? queue.filter(q => (!queueModFilter || q.moderationStatus === queueModFilter) && (!queueStatusFilter || q.status === queueStatusFilter))
    : null;
  const queueIndex = filteredQueue ? filteredQueue.findIndex(q => q._id === id) : -1;
  const goToQueueIndex = (i) => navigate(`/issues/${filteredQueue[i]._id}`, { state: { queue, moderationFilter: queueModFilter, issueStatusFilter: queueStatusFilter } });

  const applyQueueFilter = (nextModFilter, nextStatusFilter) => {
    setQueueModFilter(nextModFilter);
    setQueueStatusFilter(nextStatusFilter);
    if (!queue) return;
    const next = queue.filter(q => (!nextModFilter || q.moderationStatus === nextModFilter) && (!nextStatusFilter || q.status === nextStatusFilter));
    if (next.length === 0) { toast('No posts match this filter'); return; }
    if (!next.some(q => q._id === id)) navigate(`/issues/${next[0]._id}`, { state: { queue, moderationFilter: nextModFilter, issueStatusFilter: nextStatusFilter } });
  };

  const load = () => Promise.all([
    api.get(`/issues/${id}`),
    api.get(`/comments/${id}`),
    api.get('/issues/meta')
  ]).then(([i, c, m]) => {
    setIssue(i.data.issue);
    setComments(c.data.comments);
    setMeta(m.data);
  });

  useEffect(() => {
    load().catch(() => {}).finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const loadEscalations = () => {
    api.get(`/issues/${id}/escalations`).then(r => setEscalations(r.data.escalations)).catch(() => {});
  };

  // History of "Escalate to Authority" sends and their replies — visible to
  // any signed-in user (the backend enforces the same check, see
  // escalationController.listEscalations), same public-accountability
  // treatment as a Resolved/Rejected status. Waits for `issue` to load so
  // this only fires once there's actually an issue to load escalations for.
  useEffect(() => {
    if (!issue) return;
    if (user) loadEscalations();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, user, issue?._id]);

  // Turns a quiet status change into a shareable moment for the reporter —
  // fires once per issue (tracked in localStorage, not a DB field, since
  // it's purely a one-time client-side nudge) the first time they view
  // their own Resolved issue, reusing the existing Share modal and
  // celebration confetti rather than building a new prompt from scratch.
  useEffect(() => {
    if (!issue || !user) return;
    const isOwner = String(issue.reporter?._id || issue.reporter) === String(user._id);
    if (!isOwner || issue.status !== 'Resolved') return;
    const flagKey = `sharedWinPrompted_${issue._id}`;
    if (localStorage.getItem(flagKey)) return;
    localStorage.setItem(flagKey, '1');
    burstConfetti(window.innerWidth / 2, 220);
    setShareOpen(true);
  }, [issue, user]);

  const postComment = async (e) => {
    e.preventDefault();
    if (!text.trim()) return;
    const res = await api.post(`/comments/${id}`, { text });
    setComments([...comments, res.data.comment]);
    setText('');
  };

  const postReply = async (e, parentId) => {
    e.preventDefault();
    if (!replyText.trim()) return;
    const res = await api.post(`/comments/${id}`, { text: replyText, parentComment: parentId });
    setComments([...comments, res.data.comment]);
    setReplyText('');
    setReplyTo(null);
  };

  const removeComment = async (commentId) => {
    await api.delete(`/comments/${id}/${commentId}`);
    setComments(comments.filter(c => c._id !== commentId && String(c.parentComment) !== String(commentId)));
  };

  const changeStatus = async (status) => {
    const res = await api.patch(`/issues/${id}`, { status });
    setIssue(res.data.issue);
    toast(`Issue marked ${status}`);
    if (status === 'Resolved') burstConfetti(window.innerWidth / 2, 220);
  };

  const toggleFeatured = async () => {
    const res = await api.patch(`/issues/${id}`, { featured: !issue.featured });
    setIssue(res.data.issue);
  };

  const toggleLocked = async () => {
    const res = await api.patch(`/issues/${id}`, { commentsLocked: !issue.commentsLocked });
    setIssue(res.data.issue);
  };

  const moderate = async (decision) => {
    const res = await api.patch(`/issues/${id}`, { moderationStatus: decision });
    // Stay on this post after deciding — approving is often followed by
    // marking it Hot or leaving a comment, not moving straight on. Use the
    // Prev/Next queue controls above to advance manually when ready.
    setIssue(res.data.issue);
    toast(`Issue ${decision.toLowerCase()}`, decision === 'Rejected' ? 'info' : 'success');
  };

  const toggleSupport = async () => {
    const res = await api.post(`/issues/${id}/support`);
    setIssue(prev => ({
      ...prev,
      supportCount: res.data.supportCount,
      supporters: res.data.supported ? [...(prev.supporters || []), { _id: user._id, name: user.name }] : (prev.supporters || []).filter(s => String(s._id || s) !== String(user._id)),
      disagreeCount: res.data.disagreeCount,
      disagrees: (prev.disagrees || []).filter(s => String(s._id || s) !== String(user._id))
    }));
  };

  const toggleDisagree = async () => {
    const res = await api.post(`/issues/${id}/disagree`);
    setIssue(prev => ({
      ...prev,
      disagreeCount: res.data.disagreeCount,
      disagrees: res.data.disagreed ? [...(prev.disagrees || []), { _id: user._id, name: user.name }] : (prev.disagrees || []).filter(s => String(s._id || s) !== String(user._id)),
      supportCount: res.data.supportCount,
      supporters: (prev.supporters || []).filter(s => String(s._id || s) !== String(user._id))
    }));
  };

  const remove = async () => {
    if (!confirm('Delete this issue?')) return;
    await api.delete(`/issues/${id}`);
    navigate('/feed');
  };

  const startEdit = () => {
    setEditTitle(issue.title);
    setEditDescription(issue.description);
    setEditTopic(issue.topic || issue.category);
    setEditSubTopic(issue.subTopic || '');
    setEditCustomCategory(issue.customCategory || '');
    setEditAddress(issue.location?.address || '');
    setEditCity(issue.location?.city || '');
    setEditWard(issue.location?.ward || '');
    setEditDistrict(issue.location?.district || '');
    setEditMandal(issue.location?.mandal || '');
    setEditState(issue.location?.state || '');
    setEditCoordinates(issue.location?.lat && issue.location?.lng ? { lat: issue.location.lat, lng: issue.location.lng } : null);
    setEditError('');
    setAttachmentError('');
    setEditing(true);
  };

  const applyEditLocation = (picked) => {
    setEditAddress(picked.address);
    if (picked.city) setEditCity(picked.city);
    if (picked.district) setEditDistrict(picked.district);
    if (picked.mandal) setEditMandal(picked.mandal);
    if (picked.state) setEditState(picked.state);
    if (picked.lat && picked.lng) setEditCoordinates({ lat: picked.lat, lng: picked.lng });
  };

  const saveEdit = async () => {
    const hasAddress = !!editAddress.trim();
    const hasStructuredLocation = !!(editState.trim() && editDistrict.trim() && editCity.trim());
    if (!hasAddress && !hasStructuredLocation) {
      setEditError('Location is required — either search/pick an address, or fill in State, District and City.');
      return;
    }
    setEditBusy(true);
    setEditError('');
    try {
      const res = await api.patch(`/issues/${id}`, {
        title: editTitle,
        description: editDescription,
        topic: editTopic,
        subTopic: editSubTopic,
        customCategory: editCustomCategory || undefined,
        location: {
          address: editAddress,
          city: editCity,
          ward: editWard,
          district: editDistrict,
          mandal: editMandal,
          state: editState,
          lat: editCoordinates?.lat,
          lng: editCoordinates?.lng
        }
      });
      setIssue(res.data.issue);
      setEditing(false);
      toast('Changes saved');
    } catch (err) {
      setEditError(err.response?.data?.message || 'Could not save changes.');
    } finally {
      setEditBusy(false);
    }
  };

  const addEditAttachments = async (fileList) => {
    const files = Array.from(fileList || []);
    if (files.length === 0) return;
    const room = Math.max(0, MAX_ATTACHMENTS - (issue.attachments?.length || 0));
    if (room === 0) {
      setAttachmentError(`Up to ${MAX_ATTACHMENTS} photos/videos are allowed.`);
      return;
    }
    setAttachmentBusy(true);
    setAttachmentError('');
    try {
      const fd = new FormData();
      files.slice(0, room).forEach(f => fd.append('attachments', f));
      const res = await api.post(`/attachments/${id}`, fd);
      setIssue(prev => ({ ...prev, attachments: res.data.attachments }));
    } catch (err) {
      setAttachmentError(err.response?.data?.message || 'Could not add file(s).');
    } finally {
      setAttachmentBusy(false);
    }
  };

  const removeEditAttachment = async (attachmentId) => {
    setAttachmentBusy(true);
    setAttachmentError('');
    try {
      const res = await api.delete(`/attachments/${id}/${attachmentId}`);
      setIssue(prev => ({ ...prev, attachments: res.data.attachments }));
    } catch (err) {
      setAttachmentError(err.response?.data?.message || 'Could not remove file.');
    } finally {
      setAttachmentBusy(false);
    }
  };

  if (loading) return (
    <div>
      <TopNav />
      <div className="container-fluid px-4 py-4">
        <div className="mx-auto" style={{ maxWidth: 820 }}>
          <div className="card p-4">
            <div className="d-flex align-items-center gap-2 mb-3">
              <div className="skeleton-shimmer skeleton-avatar"></div>
              <div className="flex-grow-1">
                <div className="skeleton-shimmer skeleton-line" style={{ width: '30%' }}></div>
                <div className="skeleton-shimmer skeleton-line mt-2" style={{ width: '20%', height: 9 }}></div>
              </div>
            </div>
            <div className="skeleton-shimmer skeleton-line mb-3" style={{ width: '60%', height: 26 }}></div>
            <div className="skeleton-shimmer skeleton-line mb-1"></div>
            <div className="skeleton-shimmer skeleton-line mb-3" style={{ width: '80%' }}></div>
            <div className="skeleton-shimmer" style={{ aspectRatio: '16 / 10', borderRadius: 14, maxWidth: 400 }}></div>
          </div>
        </div>
      </div>
    </div>
  );
  if (!issue) return (
    <div>
      <TopNav />
      <div className="container-fluid px-4 py-4">
        <div className="alert alert-warning">Issue not found. <Link to="/feed">Back to Issues</Link></div>
      </div>
    </div>
  );

  const canDelete = user && isStaff;
  const isOwner = user && String(issue.reporter?._id) === String(user._id);
  const canEdit = isOwner && issue.moderationStatus === 'Pending';
  const commentsBlocked = issue.commentsLocked && !isStaff;
  const closed = issue.status === 'Resolved' || issue.status === 'Rejected';
  const canBeFeatured = issue.moderationStatus === 'Approved' && !closed;
  const supported = !!(user && issue.supporters?.some(s => String(s._id || s) === String(user._id)));
  const disagreed = !!(user && issue.disagrees?.some(s => String(s._id || s) === String(user._id)));

  return (
    <div>
      <TopNav />
      <div className="container-fluid px-4 py-4">
        <div className="mx-auto" style={{ maxWidth: 820 }}>
          <div className="d-flex align-items-center justify-content-between flex-wrap gap-2 mb-2">
            <Link to="/feed" className="btn btn-link px-0 text-decoration-none"><i className="bi bi-arrow-left me-1"></i>Back to Issues</Link>
            {queue && (
              <div className="d-flex align-items-center gap-2 flex-wrap">
                <SearchableSelect
                  value={queueModFilter}
                  onChange={next => applyQueueFilter(next, queueStatusFilter)}
                  options={meta.moderationStatuses || []}
                  labels={{ Rejected: 'Refused' }}
                  allLabel="All review states"
                  style={{ width: 150 }}
                  title="Only step through posts in this review state"
                />
                <SearchableSelect
                  value={queueStatusFilter}
                  onChange={next => applyQueueFilter(queueModFilter, next)}
                  options={meta.statuses || []}
                  labels={{ Escalated: 'Acknowledged' }}
                  allLabel="All statuses"
                  style={{ width: 140 }}
                  title="Only step through posts in this status"
                />
                {queueIndex !== -1 && (
                  <>
                    <span className="text-muted small">{queueIndex + 1} of {filteredQueue.length}</span>
                    <button
                      type="button"
                      className="btn btn-sm btn-pill-outline"
                      disabled={queueIndex <= 0}
                      onClick={() => goToQueueIndex(queueIndex - 1)}
                      title="Previous post"
                    >
                      <i className="bi bi-chevron-left"></i>
                    </button>
                    <button
                      type="button"
                      className="btn btn-sm btn-pill-outline"
                      disabled={queueIndex >= filteredQueue.length - 1}
                      onClick={() => goToQueueIndex(queueIndex + 1)}
                      title="Next post"
                    >
                      Next<i className="bi bi-chevron-right ms-1"></i>
                    </button>
                  </>
                )}
              </div>
            )}
          </div>

          {issue.moderationStatus === 'Pending' && (
            <div className="small text-muted mb-2">
              {isStaff ? 'Awaiting your review — not visible to the public yet.' : 'Pending review — not visible to others yet. You can still edit it until it\'s reviewed.'}
            </div>
          )}
          {isOwner && issue.moderationStatus === 'Approved' && (
            <div className="small text-muted mb-2">
              <i className="bi bi-lock-fill me-1"></i>This post has been approved and can no longer be edited.
            </div>
          )}
          {issue.moderationStatus === 'Rejected' && (
            <div className="alert alert-danger d-flex align-items-center gap-2">
              <i className="bi bi-x-circle"></i>
              {isStaff ? 'This post was not approved and is hidden from the public.' : 'Your post was reviewed and not approved for posting.'}
            </div>
          )}

          {/* Kept separate from (and above) the full Escalations & Replies
              card further down — that card holds the email thread itself,
              this is just a same-glance "yes, this happened" signal, same
              role the Rejected alert above plays for moderation status. */}
          {issue.status === 'Escalated' && (
            <div
              className="alert d-flex align-items-center gap-2"
              style={{ background: 'var(--badge-escalated-bg)', color: 'var(--badge-escalated-text)', border: '1px solid currentColor' }}
            >
              <i className="bi bi-send-fill"></i>
              {escalations.length > 0 ? (
                <div>
                  Escalated to <strong>{escalations[0].authorityName || escalations[0].authorityEmail}</strong>
                  {escalations.length > 1 && ` (and ${escalations.length - 1} more)`} · {timeAgo(escalations[0].createdAt)}
                  {' — '}<a href="#escalations" style={{ color: 'inherit', textDecoration: 'underline' }}>see details below</a>.
                </div>
              ) : (
                <div>
                  This issue has been escalated to the relevant authority.
                  {!user && <> <Link to="/login" style={{ color: 'inherit', textDecoration: 'underline' }}>Log in</Link> to see full details.</>}
                </div>
              )}
            </div>
          )}

          <div className="card stamped-card p-4 mb-3">
            <div className="d-flex justify-content-between align-items-start flex-wrap gap-2 mb-2">
              <div className="d-flex align-items-center gap-2">
                <Avatar name={issue.reporter?.name} size="md" />
                <div>
                  <div className="fw-semibold">{issue.reporter?.name || 'Unknown'}</div>
                  <div className="text-muted small">{issue.issueNumber} · {timeAgo(issue.createdAt)}</div>
                </div>
              </div>
              <div className="d-flex align-items-center gap-2">
                {issue.featured && <span className="badge-solid-gradient"><i className="bi bi-fire me-1"></i>Trending</span>}
                <ModerationBadge status={issue.moderationStatus} />
                {issue.moderationStatus === 'Pending' && meta.autoApprovalEnabled && (
                  <ApprovalCountdown
                    createdAt={issue.createdAt}
                    days={meta.autoApprovalDays}
                    hours={meta.autoApprovalHours}
                    minutes={meta.autoApprovalMinutes}
                  />
                )}
                <StatusBadge status={issue.status} />
              </div>
            </div>

            {!editing && issue.location?.address && (
              <div className="text-muted small mb-1"><i className="bi bi-geo-alt me-1"></i>{issue.location.address}</div>
            )}
            {!editing && [issue.location?.ward, issue.location?.city, issue.location?.mandal, issue.location?.district, issue.location?.state]
              .filter(Boolean).length > 0 && (
              <div className="text-muted small mb-2">
                {[issue.location.ward, issue.location.city, issue.location.mandal, issue.location.district, issue.location.state]
                  .filter(Boolean).join(' · ')}
              </div>
            )}

            {editing ? (
              <div className="mb-3">
                <label className="form-label small fw-semibold">Topic</label>
                <div className="mb-2">
                  <SearchableSelect
                    clearable={false}
                    value={editTopic}
                    onChange={next => { setEditTopic(next); setEditSubTopic((meta.topicHierarchy?.[next] || [])[0] || ''); setEditCustomCategory(''); }}
                    options={Object.keys(meta.topicHierarchy || {})}
                    allLabel="Select a topic"
                    className="w-100"
                  />
                </div>
                <label className="form-label small fw-semibold">Sub Topic</label>
                <div className="mb-2">
                  <SearchableSelect
                    clearable={false}
                    value={editSubTopic}
                    onChange={next => { setEditSubTopic(next); setEditCustomCategory(''); }}
                    options={meta.topicHierarchy?.[editTopic] || []}
                    allLabel="Select a sub topic"
                    className="w-100"
                  />
                </div>
                {(editTopic === 'Other' || editSubTopic === 'Other') && (
                  <>
                    <label className="form-label small fw-semibold">Specify your category</label>
                    <input
                      className="form-control mb-2"
                      placeholder="Enter your category (4–30 characters)"
                      value={editCustomCategory}
                      onChange={e => setEditCustomCategory(e.target.value)}
                      minLength="4"
                      maxLength="30"
                      pattern="[A-Za-z0-9 &-]+"
                    />
                  </>
                )}
                <label className="form-label small fw-semibold">Title</label>
                <input className="form-control mb-2" value={editTitle} onChange={e => setEditTitle(e.target.value)} />
                <label className="form-label small fw-semibold">Description</label>
                <textarea className="form-control mb-2" rows={4} value={editDescription} onChange={e => setEditDescription(e.target.value)} />

                <label className="form-label small fw-semibold">Location</label>
                <div className="mb-2">
                  <AddressAutocomplete value={editAddress} onChange={setEditAddress} onSelect={applyEditLocation} />
                </div>
                <div className="row g-2 mb-2">
                  <div className="col-6">
                    <SearchableSelect value={editState} onChange={setEditState} options={meta.states || []} allLabel="Select a state" className="w-100" />
                  </div>
                  <div className="col-6">
                    <input className="form-control" placeholder="District" value={editDistrict} onChange={e => setEditDistrict(e.target.value)} />
                  </div>
                  <div className="col-6">
                    <input className="form-control" placeholder="City / Town" value={editCity} onChange={e => setEditCity(e.target.value)} />
                  </div>
                  <div className="col-6">
                    <input className="form-control" placeholder="Ward (optional)" value={editWard} onChange={e => setEditWard(e.target.value)} />
                  </div>
                  <div className="col-6">
                    <input className="form-control" placeholder="Mandal (optional)" value={editMandal} onChange={e => setEditMandal(e.target.value)} />
                  </div>
                </div>
                {editError && <div className="alert alert-danger py-2 small">{editError}</div>}
                <div className="d-flex gap-2">
                  <button type="button" className="btn btn-sm btn-gradient" disabled={editBusy || !editTitle.trim() || !editDescription.trim()} onClick={saveEdit}>
                    {editBusy ? 'Saving…' : 'Save changes'}
                  </button>
                  <button type="button" className="btn btn-sm btn-pill-outline" disabled={editBusy} onClick={() => setEditing(false)}>Cancel</button>
                </div>
              </div>
            ) : (
              <>
                <div className="hashtag mb-2">#{issue.category}</div>
                <h4 className="fw-bold mb-2">{issue.title}</h4>
                <p className="mb-3" style={{ whiteSpace: 'pre-line' }}>{issue.description}</p>
              </>
            )}

            {issue.attachments?.length > 0 ? (
              <div className="row g-2 mb-2">
                {issue.attachments.map((a, i) => (
                  <div className="col-6 col-md-4" key={a._id}>
                    <div className="issue-media position-relative">
                      <button type="button" className="d-block w-100 h-100 border-0 p-0" onClick={() => setLightboxIndex(i)}>
                        {i === 0 && <StatusStamp status={issue.status} />}
                        {isVideoAttachment(a) ? (
                          <>
                            <video src={a.url} className="w-100 h-100" style={{ objectFit: 'contain', background: '#eee' }} preload="metadata" muted playsInline />
                            <i className="bi bi-play-circle-fill position-absolute top-50 start-50 translate-middle text-white" style={{ fontSize: '2rem', textShadow: '0 1px 4px rgba(0,0,0,0.5)' }}></i>
                          </>
                        ) : (
                          <BlurImage src={a.url} alt={a.originalName} />
                        )}
                      </button>
                      {editing && (
                        <button
                          type="button"
                          className="btn-close position-absolute top-0 end-0 m-1 p-1 bg-white rounded-circle"
                          style={{ zIndex: 4 }}
                          disabled={attachmentBusy}
                          title="Remove"
                          onClick={() => removeEditAttachment(a._id)}
                        ></button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : !editing && (
              <div className="row g-2 mb-3">
                <div className="col-12 col-md-6">
                  <div className="issue-media">
                    <StatusStamp status={issue.status} size="lg" />
                    <IssuePlaceholder category={issue.category} />
                  </div>
                </div>
              </div>
            )}

            {editing && (
              <div className="mb-3">
                {(issue.attachments?.length || 0) < MAX_ATTACHMENTS && (
                  <label className="btn btn-sm btn-pill-outline mb-0">
                    <i className="bi bi-camera me-1"></i>{attachmentBusy ? 'Uploading…' : 'Add photos/video'}
                    <input
                      type="file"
                      accept=".jpg,.jpeg,.png,.mp4,.mov"
                      multiple
                      hidden
                      disabled={attachmentBusy}
                      onChange={e => { addEditAttachments(e.target.files); e.target.value = ''; }}
                    />
                  </label>
                )}
                {attachmentError && <div className="alert alert-danger py-2 small mt-2 mb-0">{attachmentError}</div>}
              </div>
            )}

            <div className="d-flex align-items-center gap-2 flex-wrap">
              <button
                className={`btn btn-sm ${supported ? 'btn-success' : 'btn-outline-success'}`}
                onClick={() => { if (!user) { navigate('/login'); return; } toggleSupport(); }}
              >
                <i className={`bi ${supported ? 'bi-hand-thumbs-up-fill' : 'bi-hand-thumbs-up'} me-1`}></i>Support
                <span className="ms-1 badge text-bg-light">{issue.supportCount ?? 0}</span>
              </button>
              <button
                className={`btn btn-sm ${disagreed ? 'btn-danger' : 'btn-outline-danger'}`}
                onClick={() => { if (!user) { navigate('/login'); return; } toggleDisagree(); }}
              >
                <i className={`bi ${disagreed ? 'bi-hand-thumbs-down-fill' : 'bi-hand-thumbs-down'} me-1`}></i>Disagree
                <span className="ms-1 badge text-bg-light">{issue.disagreeCount ?? 0}</span>
              </button>
              <button className="btn btn-sm btn-pill-outline" onClick={() => setShareOpen(true)}>
                <i className="bi bi-share me-1"></i>Share
              </button>
              {canEdit && !editing && (
                <button className="btn btn-sm btn-pill-outline" onClick={startEdit}>
                  <i className="bi bi-pencil me-1"></i>Edit
                </button>
              )}
              {canDelete && (
                <button className="btn btn-sm btn-outline-secondary" onClick={remove}>
                  <i className="bi bi-trash me-1"></i>Delete
                </button>
              )}
              {isStaff && issue.moderationStatus !== 'Approved' && (
                <button className="btn btn-sm btn-gradient" onClick={() => moderate('Approved')}>
                  <i className="bi bi-check-lg me-1"></i>Approve
                </button>
              )}
              {isStaff && issue.moderationStatus !== 'Rejected' && (
                <button className="btn btn-sm btn-outline-danger" onClick={() => moderate('Rejected')}>
                  <i className="bi bi-x-lg me-1"></i>Reject
                </button>
              )}
              {isStaff && (
                <>
                  {canBeFeatured && (
                    <button className={`btn btn-sm ${issue.featured ? 'btn-gradient' : 'btn-pill-outline'}`} onClick={toggleFeatured}>
                      <i className="bi bi-fire me-1"></i>{issue.featured ? 'Unmark Trending' : 'Mark Trending'}
                    </button>
                  )}
                  <button className="btn btn-sm btn-pill-outline" onClick={toggleLocked}>
                    <i className={`bi ${issue.commentsLocked ? 'bi-lock-fill' : 'bi-unlock'} me-1`}></i>
                    {issue.commentsLocked ? 'Unlock Comments' : 'Lock Comments'}
                  </button>
                  <button className="btn btn-sm btn-pill-outline" onClick={() => setEscalateOpen(true)}>
                    <i className="bi bi-send-fill me-1"></i>Escalate to Authority
                  </button>
                  <div className="ms-auto d-flex align-items-center gap-2">
                    <label className="small text-muted mb-0">Status:</label>
                    <select className="form-select form-select-sm" style={{ width: 'auto' }}
                      value={issue.status} onChange={e => changeStatus(e.target.value)}>
                      {meta.statuses.map(s => <option key={s} value={s}>{s === 'Escalated' ? 'Acknowledged' : s}</option>)}
                    </select>
                  </div>
                </>
              )}
            </div>
          </div>

          {escalations.length > 0 && (
            <div id="escalations" className="card p-4" style={{ borderLeft: '4px solid var(--badge-escalated-text)' }}>
              <h5 className="fw-semibold mb-3 d-flex align-items-center gap-2">
                <i className="bi bi-send-fill" style={{ color: 'var(--badge-escalated-text)' }}></i>Escalations &amp; Replies
              </h5>
              <div className="d-flex flex-column gap-3">
                {escalations.map(esc => (
                  <div key={esc._id} className="border rounded-3 p-3">
                    <div className="d-flex justify-content-between flex-wrap gap-2">
                      <div>
                        <div className="fw-semibold small">To: {esc.authorityName ? `${esc.authorityName} <${esc.authorityEmail}>` : esc.authorityEmail}</div>
                        {esc.ccEmails?.length > 0 && (
                          <div className="text-muted small">CC: {esc.ccEmails.join(', ')}</div>
                        )}
                        <div className="text-muted small">{esc.subject}</div>
                      </div>
                      <div className="text-end">
                        <span className={`badge ${esc.status === 'Sent' ? 'text-bg-success' : 'text-bg-danger'}`}>{esc.status}</span>
                        <div className="text-muted small mt-1">{timeAgo(esc.createdAt)} · by {esc.sentBy?.name || 'Staff'}</div>
                      </div>
                    </div>
                    {esc.attachments?.length > 0 && (
                      <div className="d-flex flex-wrap gap-2 mt-2">
                        {esc.attachments.map((a, i) => (
                          <a key={i} href={a.url} target="_blank" rel="noreferrer">
                            <img src={a.url} alt="" style={{ width: 56, height: 56, objectFit: 'cover', borderRadius: 6 }} />
                          </a>
                        ))}
                      </div>
                    )}
                    {esc.replies?.length > 0 && (
                      <div className="mt-3 ms-2 ps-2 border-start d-flex flex-column gap-2">
                        {esc.replies.map((r, i) => (
                          <div key={i} className="small">
                            <EscalationReply reply={r} />
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="card p-4">
            <h5 className="fw-semibold mb-3">Comments ({comments.length})</h5>
            {issue.commentsLocked && (
              <div className="alert alert-secondary py-2 small"><i className="bi bi-lock-fill me-1"></i>Comments are locked for this issue.</div>
            )}
            {comments.length === 0 && <p className="text-muted small">No comments yet. Be the first.</p>}
            <div className="d-flex flex-column gap-3 mb-3">
              {comments.filter(c => !c.parentComment).map(c => {
                const replies = comments.filter(r => String(r.parentComment) === String(c._id));
                return (
                <div key={c._id}>
                  <div className="d-flex gap-2">
                    <Avatar name={c.user?.name} size="sm" />
                    <div className="flex-grow-1">
                      <div className="fw-semibold small">{c.user?.name || 'User'}
                        <span className="text-muted fw-normal ms-2">{c.user?.role}</span>
                      </div>
                      <div>{c.text}</div>
                      {user && !commentsBlocked && (
                        <button className="btn btn-sm btn-link p-0 text-muted" onClick={() => { setReplyTo(replyTo === c._id ? null : c._id); setReplyText(''); }}>
                          Reply
                        </button>
                      )}
                    </div>
                    {user && (isStaff || String(c.user?._id) === String(user._id)) && (
                      <button className="btn btn-sm btn-link text-muted p-0" onClick={() => removeComment(c._id)}>
                        <i className="bi bi-x-lg"></i>
                      </button>
                    )}
                  </div>

                  {replies.length > 0 && (
                    <div className="d-flex flex-column gap-2 mt-2 ms-4 ps-2 border-start">
                      {replies.map(r => (
                        <div key={r._id} className="d-flex gap-2">
                          <Avatar name={r.user?.name} size="sm" />
                          <div className="flex-grow-1">
                            <div className="fw-semibold small">{r.user?.name || 'User'}
                              <span className="text-muted fw-normal ms-2">{r.user?.role}</span>
                            </div>
                            <div>{r.text}</div>
                          </div>
                          {user && (isStaff || String(r.user?._id) === String(user._id)) && (
                            <button className="btn btn-sm btn-link text-muted p-0" onClick={() => removeComment(r._id)}>
                              <i className="bi bi-x-lg"></i>
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                  )}

                  {replyTo === c._id && (
                    <form onSubmit={e => postReply(e, c._id)} className="d-flex gap-2 mt-2 ms-4">
                      <input className="form-control form-control-sm" placeholder={`Reply to ${c.user?.name || 'this comment'}…`}
                        value={replyText} onChange={e => setReplyText(e.target.value)} autoFocus />
                      <button className="btn btn-sm btn-gradient" disabled={!replyText.trim()}>Reply</button>
                    </form>
                  )}
                </div>
                );
              })}
            </div>
            {user ? (
              !commentsBlocked && (
                <form onSubmit={postComment} className="d-flex gap-2">
                  <input className="form-control" placeholder="Write a comment…"
                    value={text} onChange={e => setText(e.target.value)} />
                  <button className="btn btn-gradient" disabled={!text.trim()}>Post</button>
                </form>
              )
            ) : (
              <Link to="/login" className="btn btn-pill-outline">Log in to comment</Link>
            )}
          </div>
        </div>
      </div>
      {issue.attachments?.length > 0 && (
        <Lightbox images={issue.attachments} index={lightboxIndex} onClose={() => setLightboxIndex(null)} onNavigate={setLightboxIndex} />
      )}
      <ShareIssueModal issue={issue} show={shareOpen} onClose={() => setShareOpen(false)} />
      <EscalateIssueModal issue={issue} show={escalateOpen} onClose={() => setEscalateOpen(false)} onSent={loadEscalations} />
    </div>
  );
}
