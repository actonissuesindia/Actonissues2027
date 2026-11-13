const IssueEscalation = require('../models/IssueEscalation');
const { splitQuotedReply, htmlToText } = require('../utils/quotedReply');

function firstAddress(value) {
  if (!value) return '';
  if (Array.isArray(value)) {
    const first = value[0];
    return typeof first === 'string' ? first : (first?.Address || first?.address || first?.email || '');
  }
  if (typeof value === 'string') return value;
  return value.Address || value.address || value.email || '';
}

function pick(obj, keys) {
  for (const key of keys) {
    if (obj && obj[key] !== undefined && obj[key] !== null && obj[key] !== '') return obj[key];
  }
  return undefined;
}

// POST /api/webhooks/brevo-inbound/:secret (secret checked in routes/webhookRoutes.js)
// An authority's reply to an escalation email arrives here as JSON from
// Brevo's inbound-parsing feature (see docs/DEPLOYMENT.md Step 17), matched
// back to its IssueEscalation record via the `esc-<id>@...` address it was
// sent to. Brevo's exact field names are confirmed against a real payload
// once this is live — the raw body is logged so that's easy to check rather
// than guessed blind; the field-name fallbacks below cover the documented
// shape plus a couple of plausible variants.
exports.brevoInbound = async (req, res) => {
  console.log('Inbound email webhook payload:', JSON.stringify(req.body));
  // Always 200 quickly — an unmatched or malformed email should never make
  // Brevo treat this as a delivery failure and retry indefinitely.
  res.sendStatus(200);

  try {
    const items = Array.isArray(req.body?.items) ? req.body.items : [req.body];
    for (const item of items) {
      const toAddress = firstAddress(pick(item, ['To', 'to']));
      const match = /^esc-([a-f0-9]{24})@/i.exec(toAddress || '');
      if (!match) {
        console.warn('Inbound email did not match any escalation address:', toAddress);
        continue;
      }
      const escalation = await IssueEscalation.findById(match[1]);
      if (!escalation) {
        console.warn('Inbound email matched no existing escalation:', match[1]);
        continue;
      }
      // ExtractedMarkdownMessage first: Brevo has already stripped the quoted
      // original from it. The raw bodies still need splitting ourselves, and
      // an HTML-only reply needs flattening to the plain text it's shown as.
      const extracted = pick(item, ['ExtractedMarkdownMessage']);
      const raw = pick(item, ['RawTextBody', 'text']);
      const html = pick(item, ['RawHtmlBody', 'html']);
      const { message, quoted } = splitQuotedReply(extracted || raw || htmlToText(html));

      escalation.replies.push({
        from: firstAddress(pick(item, ['From', 'from'])),
        subject: pick(item, ['Subject', 'subject']) || '',
        body: message,
        quotedBody: quoted,
        receivedAt: new Date()
      });
      await escalation.save();
    }
  } catch (err) {
    console.error('Failed to process inbound email webhook:', err.message);
  }
};
