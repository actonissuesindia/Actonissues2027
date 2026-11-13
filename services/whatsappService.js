const axios = require('axios');

let configured = false;

// Lazily configures from env, same pattern as pushService — a missing
// access token should never crash the server at boot, only surface when a
// WhatsApp send is actually attempted.
function ensureConfigured() {
  if (configured) return true;
  const { WHATSAPP_PHONE_NUMBER_ID, WHATSAPP_ACCESS_TOKEN } = process.env;
  if (!WHATSAPP_PHONE_NUMBER_ID || !WHATSAPP_ACCESS_TOKEN) return false;
  configured = true;
  return true;
}

// Meta's Cloud API requires business-initiated messages to use a
// pre-approved template (free-form text only works within 24h of the user
// messaging first) — see docs/DEPLOYMENT.md for the template text to submit
// for approval. The template's body has 3 placeholders: title, message, a
// link (WhatsApp auto-linkifies a URL that appears in template text).
exports.sendWhatsApp = async (phone, { title, message, url }) => {
  if (!ensureConfigured() || !phone) return;
  const { WHATSAPP_PHONE_NUMBER_ID, WHATSAPP_ACCESS_TOKEN } = process.env;
  const apiVersion = process.env.WHATSAPP_API_VERSION || 'v21.0';
  const templateName = process.env.WHATSAPP_TEMPLATE_NAME || 'issue_update';

  await axios.post(
    `https://graph.facebook.com/${apiVersion}/${WHATSAPP_PHONE_NUMBER_ID}/messages`,
    {
      messaging_product: 'whatsapp',
      to: phone.replace(/^\+/, ''),
      type: 'template',
      template: {
        name: templateName,
        language: { code: 'en' },
        components: [{
          type: 'body',
          parameters: [
            { type: 'text', text: title },
            { type: 'text', text: message },
            { type: 'text', text: url || '' }
          ]
        }]
      }
    },
    { headers: { Authorization: `Bearer ${WHATSAPP_ACCESS_TOKEN}` } }
  );
};
