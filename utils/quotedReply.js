// Mirrors src/utils/quotedReply.js — an authority replying to an escalation
// email replies from their own mail client, which tacks the entire original
// message onto the bottom as quoted text ("On <date> <no-reply@...> wrote:"
// followed by `>`-prefixed lines, or an Outlook "-----Original Message-----"
// header block). Stored verbatim that would bury a one-line answer under the
// whole escalation email, tracking links and all, so inbound replies are
// split into the new message and the quoted history before saving (see
// controllers/webhookController.js).

// Recognises the line where the quoted history starts. `lines` is the whole
// body so the multi-line forms (a wrapped Gmail attribution, an Outlook
// header block) can look ahead.
function isQuoteStart(lines, i) {
  const line = lines[i];
  const trimmed = line.trim();

  if (/^>/.test(trimmed)) return true;                                   // quoted line
  if (/^-{2,}\s*(original message|forwarded message)\s*-{2,}$/i.test(trimmed)) return true;
  if (/^_{5,}$/.test(trimmed)) return true;                              // Outlook's divider rule

  // Gmail/Apple Mail attribution: "On <date> <someone> wrote:" — often wrapped
  // across two or three lines, so glue the continuation lines back on (up to
  // the blank line or first `>` that ends the attribution) before deciding.
  if (/^(on|le|el|am)\b/i.test(trimmed)) {
    let joined = trimmed;
    for (let j = i + 1; j < Math.min(i + 3, lines.length) && !/^\s*$|^\s*>/.test(lines[j]); j++) {
      joined += ' ' + lines[j].trim();
    }
    if (/\bwrote\s*:$/i.test(joined)) return true;
  }

  // Outlook header block: a "From:" line immediately followed by the rest of
  // the original headers (a signature line reading "From: the team" has no
  // such follower, so it survives).
  if (/^from\s*:\s*\S/i.test(trimmed) && /^\s*(sent|date|to|subject)\s*:/im.test(lines.slice(i + 1, i + 4).join('\n'))) return true;

  return false;
}

// Returns { message, quoted } — `message` is what the sender actually typed,
// `quoted` is the original email they replied on top of (empty when there is
// none). A reply that is nothing but quoted text yields an empty `message`,
// which the UI labels rather than pretending the quote was the reply.
function splitQuotedReply(text) {
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

// Last-resort conversion for a reply that arrived as HTML only — enough to
// turn it into the plain text the reply is displayed as, not a full parser.
function htmlToText(html) {
  return String(html || '')
    .replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1>/gi, '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|div|tr|li|h[1-6])\s*>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/g, "'")
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

module.exports = { splitQuotedReply, htmlToText };
