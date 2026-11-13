import { useState } from 'react';
import timeAgo from '../../utils/timeAgo';
import { replyParts } from '../../utils/quotedReply';

// One reply an authority sent back to an escalation email. Mail clients quote
// the entire original escalation underneath the two lines the sender actually
// typed, so only the typed part is shown; the quoted original stays available
// behind a toggle rather than being thrown away.
export default function EscalationReply({ reply, showSubject = false }) {
  const [showQuoted, setShowQuoted] = useState(false);
  const { message, quoted } = replyParts(reply);

  return (
    <>
      <div className="fw-semibold">
        {reply.from} <span className="text-muted fw-normal">· {timeAgo(reply.receivedAt)}</span>
      </div>
      {showSubject && reply.subject && <div className="text-muted">{reply.subject}</div>}
      {message
        ? <div style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{message}</div>
        : <div className="text-muted fst-italic">No message — the reply only quoted our email.</div>}
      {quoted && (
        <>
          <button type="button"
            className="btn btn-sm btn-link p-0 text-muted text-decoration-none"
            onClick={() => setShowQuoted(v => !v)}>
            <i className="bi bi-three-dots me-1"></i>
            {showQuoted ? 'Hide quoted email' : 'Show quoted email'}
          </button>
          {showQuoted && (
            <div className="mt-1 ps-2 border-start text-muted"
              style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word', maxHeight: 260, overflowY: 'auto' }}>
              {quoted}
            </div>
          )}
        </>
      )}
    </>
  );
}
