// Shared branded HTML email template — used by both notifyService.js (issue/
// comment notifications) and userAdminController.js (Super Admin's bulk
// email to selected users), so every email the app sends looks the same
// rather than the bulk one being a bare, unstyled paragraph.
const SITE_URL = process.env.SITE_URL || 'http://localhost:5173';
const BRAND_COLOR = '#2563EB';
// The site's PWA icon is already a stable, public, unauthenticated URL at
// this exact path in both dev (Vite serves public/ as-is) and production
// (Express serves dist/, which vite build copies public/ into) — safer than
// the admin-configurable header/footer logo (SystemSetting HEADER_LOGO_URL),
// which can point at a relative /uploads/ path that isn't reliably
// resolvable from inside an email client.
const LOGO_URL = `${SITE_URL}/icons/icon-512.png`;

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

// Rich text that will be rendered as HTML rather than escaped: the Super
// Admin's bulk email body, and — the one that matters most — an article's
// body, which the public article page inserts with dangerouslySetInnerHTML.
//
// This used to be a list of regexes deleting things that looked dangerous.
// Removing what you recognise can't work, because what's left is whatever you
// failed to think of, and rewriting a string can create the very thing it was
// removing. Measured against the old version, three payloads went straight
// through — `<script src=x>` with no closing tag (the regex needed the pair),
// `<iframe>` (never considered), and `<scr<script>x</script>ipt>alert(1)`,
// where deleting the inner complete tag joined the outer halves into a working
// `<script>`. On a public page, from a stored article, that is exactly the
// XSS this was meant to stop.
//
// Now the opposite shape: a parser-based allowlist, where anything not named
// here is dropped. The list covers what a formatting toolbar produces and
// nothing else — no script, no iframe, no event handlers, no javascript: URLs.
const sanitizeHtmlLib = require('sanitize-html');

const SANITIZE_OPTIONS = {
  allowedTags: [
    'p', 'br', 'div', 'span', 'blockquote', 'pre', 'code',
    'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
    'b', 'strong', 'i', 'em', 'u', 's', 'strike', 'sub', 'sup', 'mark', 'small',
    'ul', 'ol', 'li',
    'a', 'img', 'figure', 'figcaption',
    'table', 'thead', 'tbody', 'tfoot', 'tr', 'th', 'td', 'caption', 'hr'
  ],
  allowedAttributes: {
    a: ['href', 'title', 'target', 'rel'],
    img: ['src', 'alt', 'title', 'width', 'height'],
    '*': ['style', 'align']
  },
  // Anything not in this list — javascript:, vbscript:, file: — is dropped
  // however it's spelled, since the parser decodes entities before the check.
  allowedSchemes: ['http', 'https', 'mailto', 'tel'],
  allowedSchemesByTag: { img: ['http', 'https', 'data'] },
  // Inline styles survive (the editor writes them for colour and alignment)
  // but only as plain declarations — url(), expression() and the like can't
  // smuggle a script through a style attribute.
  allowedStyles: {
    '*': {
      color: [/^#[0-9a-f]{3,8}$/i, /^rgba?\([\d\s,.%]+\)$/i, /^[a-z-]+$/i],
      'background-color': [/^#[0-9a-f]{3,8}$/i, /^rgba?\([\d\s,.%]+\)$/i, /^[a-z-]+$/i],
      'text-align': [/^(left|right|center|justify)$/],
      'font-size': [/^\d+(\.\d+)?(px|em|rem|%|pt)$/],
      'font-weight': [/^(normal|bold|bolder|lighter|\d{3})$/],
      'text-decoration': [/^[a-z-\s]+$/i],
      'font-style': [/^(normal|italic|oblique)$/]
    }
  },
  // A link that opens in a new tab without this can script the page that
  // opened it (window.opener) — set here so no author has to remember it.
  transformTags: {
    a: sanitizeHtmlLib.simpleTransform('a', { rel: 'noopener noreferrer' })
  }
};

function sanitizeHtml(html) {
  return sanitizeHtmlLib(String(html ?? ''), SANITIZE_OPTIONS);
}

// A self-contained (no external CSS/fonts) branded email — table-based
// layout since that's what actually renders consistently across Gmail/
// Outlook/Apple Mail, unlike flexbox/grid. `messageIsHtml: true` (bulk email
// compose, which has a real formatting toolbar) inserts a sanitized version
// of `message` as-is instead of escaping it as plain text.
function buildEmailHtml({ title, message, url, image, messageIsHtml, buttonLabel, footerNote }) {
  const messageHtml = messageIsHtml
    ? sanitizeHtml(message)
    : escapeHtml(message).replace(/\n/g, '<br>');
  const imageRow = image ? `
    <tr>
      <td style="padding:0 32px 20px;">
        <img src="${escapeHtml(image)}" alt="" width="536" style="width:100%;max-width:536px;height:auto;border-radius:10px;display:block;" />
      </td>
    </tr>` : '';

  const buttonRow = url ? `
    <tr>
      <td style="padding:8px 32px 32px;">
        <a href="${escapeHtml(url)}" style="display:inline-block;background:${BRAND_COLOR};color:#ffffff;text-decoration:none;font-weight:600;font-size:14px;padding:12px 24px;border-radius:8px;">
          ${escapeHtml(buttonLabel || 'View on Act On Issues')}
        </a>
      </td>
    </tr>` : '';

  return `<!doctype html>
<html>
  <body style="margin:0;padding:0;background:#F1F5F9;font-family:Segoe UI,Helvetica,Arial,sans-serif;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#F1F5F9;padding:32px 16px;">
      <tr>
        <td align="center">
          <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#ffffff;border-radius:14px;overflow:hidden;box-shadow:0 1px 3px rgba(15,23,42,0.08);">
            <tr>
              <td style="background:${BRAND_COLOR};padding:16px 32px;">
                <table role="presentation" cellpadding="0" cellspacing="0">
                  <tr>
                    <td style="vertical-align:middle;padding-right:10px;">
                      <img src="${LOGO_URL}" width="28" height="28" alt="" style="display:block;border-radius:6px;background:#ffffff;" />
                    </td>
                    <td style="vertical-align:middle;">
                      <span style="color:#ffffff;font-size:18px;font-weight:700;letter-spacing:0.2px;">Act On Issues</span>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
            <tr>
              <td style="padding:28px 32px 8px;">
                <h1 style="margin:0;font-size:20px;line-height:1.4;color:#0F172A;">${escapeHtml(title)}</h1>
              </td>
            </tr>
            <tr>
              <td style="padding:8px 32px 20px;">
                <div style="margin:0;font-size:15px;line-height:1.6;color:#334155;">${messageHtml}</div>
              </td>
            </tr>
            ${imageRow}
            ${buttonRow}
            <tr>
              <td style="padding:20px 32px;background:#F8FAFC;border-top:1px solid #E2E8F0;">
                <p style="margin:0;font-size:12px;color:#94A3B8;">
                  ${escapeHtml(footerNote || "You're receiving this because you have an account on Act On Issues. This is an automated message — please don't reply to it.")}
                </p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}

// Builds a human-readable "State, District, City" style line from an issue's
// structured location object, falling back to the free-text address if
// that's all that was given.
function formatLocation(location) {
  if (!location) return 'Not specified';
  if (location.address && location.address.trim()) return location.address.trim();
  return [location.city, location.mandal, location.district, location.state]
    .filter(Boolean).join(', ') || 'Not specified';
}

function formatCategory(issue) {
  const topic = issue.topic === 'Other' ? (issue.customCategory || 'Other') : issue.topic;
  const subTopic = issue.subTopic === 'Other' ? (issue.customCategory || 'Other') : issue.subTopic;
  return subTopic ? `${topic} → ${subTopic}` : topic;
}

// The rich, formal email body sent when a citizen's report is first
// submitted — explains that public backing is what lets a report be
// escalated to the concerned authorities, and asks the reporter to bring in
// people who know the issue firsthand to sign in and support it. Returned
// as HTML, meant to be passed to buildEmailHtml with messageIsHtml: true.
// Kept separate from the short bell/push/WhatsApp copy for the same event,
// which stays brief on purpose.
// Shared "Report Summary" details table, used by both the citizen thank-you
// email and the authority escalation email so the two stay visually and
// factually consistent.
function buildIssueDetailsTable(issue, heading) {
  const details = [
    ['Report ID', issue.issueNumber],
    ['Title', issue.title],
    ['Category', formatCategory(issue)],
    ['Priority', issue.priority],
    ['Location', formatLocation(issue.location)],
    ['Description', issue.description]
  ].map(([label, value]) => `
    <tr>
      <td style="padding:4px 0;font-size:13px;color:#64748B;white-space:nowrap;vertical-align:top;">${escapeHtml(label)}</td>
      <td style="padding:4px 0 4px 12px;font-size:14px;color:#0F172A;">${escapeHtml(String(value ?? ''))}</td>
    </tr>`).join('');

  return `
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 18px;border:1px solid #E2E8F0;border-radius:8px;overflow:hidden;">
      <tr>
        <td style="background:#F8FAFC;padding:10px 14px;font-weight:600;font-size:13px;color:#0F172A;border-bottom:1px solid #E2E8F0;">
          ${escapeHtml(heading)}
        </td>
      </tr>
      <tr>
        <td style="padding:12px 14px;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0">${details}</table>
        </td>
      </tr>
    </table>`;
}

function buildIssueThankYouMessage(issue, reporterName) {
  return `
    <p style="margin:0 0 14px;">Dear ${escapeHtml(reporterName || 'Reporter')},</p>
    <p style="margin:0 0 14px;">Thank you, and congratulations on taking the first step — your report has been received. Every genuine report like yours helps bring a real community problem to the attention of the people who can act on it.</p>

    ${buildIssueDetailsTable(issue, 'Your report summary')}

    <p style="margin:0 0 14px;"><strong>What happens next?</strong> Before a report can be escalated to the concerned authorities, we need to establish that it reflects a genuine, shared concern — not an isolated complaint. Public support from fellow residents is how that gets established.</p>

    <p style="margin:0 0 14px;">This is where you can help: please reach out to family, friends, and neighbours who know about this issue firsthand, and ask them to sign in to Act On Issues and add their support to your report. Once enough community backing is behind it, we'll begin our review and take the next steps toward escalating it to the relevant authorities.</p>

    <p style="margin:0;">Thank you again for being an active, responsible citizen.</p>`;
}

// Renders each photo full-width, stacked — same visual treatment as
// buildEmailHtml's single top-level `image` row, just repeated, since an
// escalation can carry several (the issue's own report photos plus
// whatever staff attach specifically to this escalation).
function buildImagesBlock(images) {
  if (!images || images.length === 0) return '';
  return images.map(src => `
    <div style="margin:0 0 14px;">
      <img src="${escapeHtml(src)}" alt="" width="536" style="width:100%;max-width:536px;height:auto;border-radius:10px;display:block;" />
    </div>`).join('');
}

// The email sent to a concerned authority when staff escalate an issue.
// `note` is the staff member's own free-text message (already-sanitized rich
// text HTML from the compose modal). `images` is the combined list of photo
// URLs to show — the issue's own report photos plus any extra ones attached
// specifically to this escalation (see controllers/escalationController.js).
// Asking the authority to just hit "Reply" works because the caller sets a
// per-escalation Reply-To address that routes back through Brevo's inbound
// parsing webhook to this exact escalation record.
function buildIssueEscalationMessage(issue, note, images) {
  return `
    <p style="margin:0 0 14px;">Dear Sir/Madam,</p>
    <p style="margin:0 0 14px;">A civic issue reported on Act On Issues is being escalated to your office for review and appropriate action, having received sufficient support from local residents confirming it as a genuine concern.</p>

    ${buildIssueDetailsTable(issue, 'Issue details')}

    ${buildImagesBlock(images)}

    ${note ? `<div style="margin:0 0 14px;font-size:15px;line-height:1.6;color:#334155;">${sanitizeHtml(note)}</div>` : ''}

    <p style="margin:0;">You can reply directly to this email — your response will be recorded against this report. Thank you for your attention to this matter.</p>`;
}

module.exports = { buildEmailHtml, sanitizeHtml, buildIssueThankYouMessage, buildIssueEscalationMessage };
