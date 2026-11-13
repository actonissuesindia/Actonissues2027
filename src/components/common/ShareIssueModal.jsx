import { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import { useToast } from '../../context/ToastContext';

function truncate(str = '', max = 140) {
  if (str.length <= max) return str;
  return `${str.slice(0, max - 1).trimEnd()}…`;
}

// A pasted description keeps its own line breaks and double spaces, which
// arrive in a chat message as ragged gaps.
const oneLine = (str = '') => str.replace(/\s+/g, ' ').trim();
const normalise = (str = '') => oneLine(str).toLowerCase();

// Plenty of reporters put the same sentence in the title and again as the
// first line of the description — quoting both then reads like the message
// was sent twice, which is how a shared post ends up looking different from
// the next one for no reason the reader can see.
function shareSummary(issue) {
  const body = oneLine(issue.description);
  if (!body || normalise(body).startsWith(normalise(issue.title))) return issue.title;
  return `${issue.title}\n${truncate(body)}`;
}

// A dedicated "Share this issue" panel — QR code (downloadable, for
// printed/in-person use) plus one-tap links to the usual social/messaging
// destinations. Replaces the old single Share button's silent
// native-share-or-clipboard behavior with something users can actually see
// and choose from.
export default function ShareIssueModal({ issue, show, onClose }) {
  const toast = useToast();
  const [qrDataUrl, setQrDataUrl] = useState(null);

  // Always hand out the canonical .com link, whichever alias the visitor
  // happens to be browsing on (www.actonissues.com and actonissues.blog both
  // reach this same site — see the redirect in server.js). Sharing an alias
  // sends the reader through a redirect first, and the meta tags this site
  // serves all name the .com URL anyway, so the two disagreeing is one more
  // way the same post can preview differently for different people.
  const origin = /(^|\.)actonissues\.(com|blog)$/.test(window.location.hostname)
    ? 'https://actonissues.com'
    : window.location.origin;
  const url = issue ? `${origin}/issues/${issue._id}` : '';
  const resolved = issue?.status === 'Resolved';
  const text = issue
    ? (resolved
      ? `Good news — "${issue.title}" that I reported on Act On Issues just got resolved.`
      : shareSummary(issue))
    : '';

  useEffect(() => {
    if (!show || !issue) return;
    QRCode.toDataURL(url, { width: 240, margin: 1, color: { dark: '#0F172A', light: '#FFFFFF' } })
      .then(setQrDataUrl)
      .catch(() => setQrDataUrl(null));
  }, [show, issue, url]);

  if (!show || !issue) return null;

  const copyLink = async () => {
    await navigator.clipboard.writeText(url);
    toast('Link copied');
  };

  const downloadQr = () => {
    if (!qrDataUrl) return;
    const a = document.createElement('a');
    a.href = qrDataUrl;
    a.download = `issue-${issue.issueNumber || issue._id}-qr.png`;
    a.click();
  };

  const openShareLink = (href) => window.open(href, '_blank', 'noopener,noreferrer');

  const shareLinks = [
    { key: 'copy', label: 'Copy link', icon: 'bi-link-45deg', bg: '#E2E8F0', color: '#334155', onClick: copyLink },
    {
      key: 'facebook',
      label: 'Facebook',
      icon: 'bi-facebook',
      bg: '#1877F2',
      color: '#fff',
      onClick: () => openShareLink(`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`)
    },
    {
      key: 'whatsapp',
      label: 'WhatsApp',
      icon: 'bi-whatsapp',
      bg: '#25D366',
      color: '#fff',
      onClick: () => openShareLink(`https://wa.me/?text=${encodeURIComponent(`${text}\n\n${url}`)}`)
    },
    {
      key: 'x',
      label: 'X',
      icon: 'bi-twitter-x',
      bg: '#000000',
      color: '#fff',
      onClick: () => openShareLink(`https://twitter.com/intent/tweet?url=${encodeURIComponent(url)}&text=${encodeURIComponent(resolved ? text : issue.title)}`)
    },
    {
      key: 'email',
      label: 'Email',
      icon: 'bi-envelope',
      bg: '#E2E8F0',
      color: '#334155',
      onClick: () => { window.location.href = `mailto:?subject=${encodeURIComponent(issue.title)}&body=${encodeURIComponent(`${text}\n\n${url}`)}`; }
    }
  ];

  return (
    <div className="modal d-block" tabIndex="-1" style={{ background: 'rgba(15, 23, 42, 0.45)' }} onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal-dialog modal-dialog-centered">
        <div className="modal-content">
          <div className="modal-header border-0 pb-0">
            <h5 className="modal-title fw-bold">{resolved ? 'Share your win' : 'Share this issue'}</h5>
            <button type="button" className="btn-close" onClick={onClose}></button>
          </div>
          <div className="modal-body pt-2">
            {/* A post awaiting review isn't public yet, so the link preview a
                chat app builds for it can only show the site's own card — not
                this post's photo and description. Worth saying out loud
                because those apps remember the preview they built for a URL
                for days, so a link shared now can keep looking plain long
                after the post goes live. */}
            {issue.moderationStatus && issue.moderationStatus !== 'Approved' && (
              <div className="d-flex gap-2 small rounded-4 p-3 mb-3" style={{ background: 'var(--badge-progress-bg)', color: 'var(--badge-progress-text)' }}>
                <i className="bi bi-clock-history mt-1"></i>
                <span>
                  This report is still awaiting review, so a link shared right now shows the
                  Act On Issues card instead of your photo and description — and chat apps
                  remember that for a few days. It's worth waiting until it's approved.
                </span>
              </div>
            )}
            <div className="border rounded-4 p-3 d-flex align-items-center gap-3 mb-4">
              {qrDataUrl
                ? <img src={qrDataUrl} alt="QR code linking to this issue" width={84} height={84} style={{ borderRadius: 8, flexShrink: 0 }} />
                : <div style={{ width: 84, height: 84, flexShrink: 0 }} className="skeleton-shimmer rounded-3" />}
              <div>
                <p className="small text-muted mb-2">Share this issue in person, or use the QR code for your own material.</p>
                <button type="button" className="btn btn-sm btn-pill-outline" onClick={downloadQr} disabled={!qrDataUrl}>
                  Download QR Code
                </button>
              </div>
            </div>

            <div className="d-flex flex-wrap gap-4">
              {shareLinks.map(s => (
                <button
                  key={s.key}
                  type="button"
                  className="btn p-0 border-0 bg-transparent d-flex flex-column align-items-center gap-1"
                  style={{ width: 64 }}
                  onClick={s.onClick}
                >
                  <span
                    className="d-flex align-items-center justify-content-center rounded-circle"
                    style={{ width: 48, height: 48, background: s.bg, color: s.color, fontSize: '1.25rem' }}
                  >
                    <i className={`bi ${s.icon}`}></i>
                  </span>
                  <span className="small text-muted">{s.label}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
