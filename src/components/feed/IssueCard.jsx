import { memo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import api from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import Avatar from '../common/Avatar';
import StatusBadge from '../common/StatusBadge';
import StatusStamp from '../common/StatusStamp';
import ModerationBadge from '../common/ModerationBadge';
import IssuePlaceholder, { CATEGORY_ICONS, hueFor } from '../common/IssuePlaceholder';
import BlurImage from '../common/BlurImage';
import ShareIssueModal from '../common/ShareIssueModal';
import timeAgo from '../../utils/timeAgo';
import { isVideoAttachment } from '../../utils/attachmentType';

export default memo(function IssueCard({ issue }) {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [supportCount, setSupportCount] = useState(issue.supportCount ?? issue.supporters?.length ?? 0);
  const [supported, setSupported] = useState(!!(user && issue.supporters?.includes(user._id)));
  const [disagreeCount, setDisagreeCount] = useState(issue.disagreeCount ?? issue.disagrees?.length ?? 0);
  const [disagreed, setDisagreed] = useState(!!(user && issue.disagrees?.includes(user._id)));
  const [popping, setPopping] = useState(false);
  const [disagreePopping, setDisagreePopping] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  const toggleSupport = async (e) => {
    e.preventDefault();
    if (!user) { navigate('/login'); return; }
    if (busy) return;
    setBusy(true);
    const wasSupported = supported;
    const wasDisagreed = disagreed;
    // Optimistic — the pop animation should feel instant, not wait on the network.
    setSupported(!wasSupported);
    setSupportCount(c => c + (wasSupported ? -1 : 1));
    if (!wasSupported && wasDisagreed) { setDisagreed(false); setDisagreeCount(c => c - 1); }
    if (!wasSupported) {
      setPopping(true);
      setTimeout(() => setPopping(false), 500);
    }
    try {
      const res = await api.post(`/issues/${issue._id}/support`);
      setSupportCount(res.data.supportCount);
      setSupported(res.data.supported);
      setDisagreeCount(res.data.disagreeCount);
      setDisagreed(res.data.disagreed);
    } catch {
      setSupported(wasSupported);
      setSupportCount(c => c + (wasSupported ? 1 : -1));
      setDisagreed(wasDisagreed);
    } finally {
      setBusy(false);
    }
  };

  const toggleDisagree = async (e) => {
    e.preventDefault();
    if (!user) { navigate('/login'); return; }
    if (busy) return;
    setBusy(true);
    const wasDisagreed = disagreed;
    const wasSupported = supported;
    setDisagreed(!wasDisagreed);
    setDisagreeCount(c => c + (wasDisagreed ? -1 : 1));
    if (!wasDisagreed && wasSupported) { setSupported(false); setSupportCount(c => c - 1); }
    if (!wasDisagreed) {
      setDisagreePopping(true);
      setTimeout(() => setDisagreePopping(false), 500);
    }
    try {
      const res = await api.post(`/issues/${issue._id}/disagree`);
      setDisagreeCount(res.data.disagreeCount);
      setDisagreed(res.data.disagreed);
      setSupportCount(res.data.supportCount);
      setSupported(res.data.supported);
    } catch {
      setDisagreed(wasDisagreed);
      setDisagreeCount(c => c + (wasDisagreed ? 1 : -1));
      setSupported(wasSupported);
    } finally {
      setBusy(false);
    }
  };

  const share = (e) => {
    e.preventDefault();
    setShareOpen(true);
  };

  const hue = hueFor(issue.category || 'Other');
  const chipIcon = CATEGORY_ICONS[issue.category] || CATEGORY_ICONS.Other;

  return (
    <div className="card issue-card issue-card-modern issue-card-compact rotating-glow stamped-card p-2 h-100">
      <div className="d-flex justify-content-between align-items-start mb-1">
        <div className="d-flex align-items-center gap-2">
          <Avatar name={issue.reporter?.name} size="sm" />
          <div>
            <div className="fw-semibold small">{issue.reporter?.name || 'Member'}</div>
            <div className="text-muted" style={{ fontSize: '0.72rem' }}>
              {issue.location?.city || issue.location?.address || 'Unknown'} · {timeAgo(issue.createdAt)}
            </div>
          </div>
        </div>
        <div className="d-flex flex-column align-items-end gap-1">
          <StatusBadge status={issue.status} />
          <ModerationBadge status={issue.moderationStatus} />
        </div>
      </div>

      <Link
        to={`/issues/${issue._id}`}
        className="category-chip d-inline-flex align-items-center gap-1 mb-1"
        style={{ '--chip-hue': hue }}
      >
        <i className={`bi ${chipIcon}`}></i>{issue.category}
      </Link>
      <Link to={`/issues/${issue._id}`} className="text-decoration-none text-dark">
        <p className="mb-1 issue-desc">{issue.description}</p>
      </Link>

      <Link to={`/issues/${issue._id}`} className="issue-media-link">
        <div className="issue-media mb-1">
          <StatusStamp status={issue.status} />
          {issue.attachments?.[0]?.url
            ? (isVideoAttachment(issue.attachments[0])
              ? (
                <>
                  <video src={issue.attachments[0].url} className="w-100 h-100" style={{ objectFit: 'contain', background: '#eee' }} preload="metadata" muted playsInline />
                  <i className="bi bi-play-circle-fill position-absolute top-50 start-50 translate-middle text-white" style={{ fontSize: '2rem', textShadow: '0 1px 4px rgba(0,0,0,0.5)' }}></i>
                </>
              )
              : <BlurImage src={issue.attachments[0].url} alt="" />)
            : <IssuePlaceholder category={issue.category} />}
        </div>
      </Link>

      <div className="d-flex align-items-center gap-3 mt-auto pt-1">
        <button
          className={`btn-support ${supported ? 'btn-support-active' : ''} ${popping ? 'btn-support-pop' : ''}`}
          onClick={toggleSupport}
          title={user ? (supported ? 'Remove support' : 'Support this issue') : 'Log in to support'}
        >
          <i className={`bi ${supported ? 'bi-hand-thumbs-up-fill' : 'bi-hand-thumbs-up'}`}></i>
          <span className="small fw-semibold">{supportCount}</span>
        </button>
        <button
          className={`btn-disagree ${disagreed ? 'btn-disagree-active' : ''} ${disagreePopping ? 'btn-disagree-pop' : ''}`}
          onClick={toggleDisagree}
          title={user ? (disagreed ? 'Remove disagree' : 'Disagree with this issue') : 'Log in to disagree'}
        >
          <i className={`bi ${disagreed ? 'bi-hand-thumbs-down-fill' : 'bi-hand-thumbs-down'}`}></i>
          <span className="small fw-semibold">{disagreeCount}</span>
        </button>
        <Link to={`/issues/${issue._id}`} className="text-muted d-flex align-items-center gap-1">
          <i className="bi bi-chat-left-text"></i>
        </Link>
        <button className="btn btn-link p-0 text-muted" onClick={share} title="Share">
          <i className="bi bi-share"></i>
        </button>
      </div>
      <ShareIssueModal issue={issue} show={shareOpen} onClose={() => setShareOpen(false)} />
    </div>
  );
});
