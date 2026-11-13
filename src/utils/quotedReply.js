// Mirrors utils/quotedReply.js. New inbound replies are split server-side
// before they're stored, but replies captured before that (and anything the
// server-side split didn't catch) still arrive with the whole original email
// quoted underneath, so the escalation views split again at render time and
// hide the quoted half behind a toggle.

function isQuoteStart(lines, i) {
  const line = lines[i];
  const trimmed = line.trim();

  if (/^>/.test(trimmed)) return true;                                   // quoted line
  if (/^-{2,}\s*(original message|forwarded message)\s*-{2,}$/i.test(trimmed)) return true;
  if (/^_{5,}$/.test(trimmed)) return true;                              // Outlook's divider rule

  // Gmail/Apple Mail attribution: "On <date> <someone> wrote:", often wrapped
  // across two or three lines.
  if (/^(on|le|el|am)\b/i.test(trimmed)) {
    let joined = trimmed;
    for (let j = i + 1; j < Math.min(i + 3, lines.length) && !/^\s*$|^\s*>/.test(lines[j]); j++) {
      joined += ' ' + lines[j].trim();
    }
    if (/\bwrote\s*:$/i.test(joined)) return true;
  }

  // Outlook header block — a "From:" line followed by the rest of the headers.
  if (/^from\s*:\s*\S/i.test(trimmed) && /^\s*(sent|date|to|subject)\s*:/im.test(lines.slice(i + 1, i + 4).join('\n'))) return true;

  return false;
}

// Returns { message, quoted } — `message` is what the sender actually typed,
// `quoted` is the original email they replied on top of (empty when there is
// none). A reply that is nothing but quoted text yields an empty `message`.
export function splitQuotedReply(text) {
  const normalized = String(text || '').replace(/\r\n?/g, '\n');
  const lines = normalized.split('\n');

  let cut = -1;
  for (let i = 0; i < lines.length; i++) {
    if (isQuoteStart(lines, i)) { cut = i; break; }
  }
  if (cut === -1) return { message: normalized.trim(), quoted: '' };

  return {
    message: lines.slice(0, cut).join('\n').trim(),
    quoted: lines.slice(cut).join('\n').trim()
  };
}

// The reply as it should be shown: the server-stored split when it's there,
// otherwise split the stored body now.
export function replyParts(reply) {
  if (reply?.quotedBody) return { message: String(reply.body || '').trim(), quoted: reply.quotedBody };
  return splitQuotedReply(reply?.body);
}
