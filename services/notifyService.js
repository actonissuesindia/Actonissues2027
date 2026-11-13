const Notification = require('../models/Notification');
const User = require('../models/User');
const pushService = require('./pushService');
const emailService = require('./emailService');
const whatsappService = require('./whatsappService');
const { buildEmailHtml } = require('./emailTemplate');

const SITE_URL = process.env.SITE_URL || 'http://localhost:5173';

// Single entry point for "tell this user something happened" — writes the
// in-app bell notification and best-effort fires a push notification, an
// email, and a WhatsApp message
// alongside it. Every issue/comment notification site should go through this
// instead of calling Notification.create directly, so all four channels stay
// in sync. `image`, if given (e.g. an issue's first photo), is shown in the
// email only — push/bell/WhatsApp notifications stay text-only.
// `emailMessage`/`emailMessageIsHtml`/`emailButtonLabel` let a caller send a
// longer, richer email body than the short text used for push/bell/WhatsApp
// (e.g. the formal "thank you for reporting" email) without changing what
// those other three channels show.
exports.notify = async (userId, { title, message, link, image, emailMessage, emailMessageIsHtml, emailButtonLabel }) => {
  // Nothing in here may fail the action that triggered it.
  //
  // Every caller awaits this immediately after saving something — a comment, a
  // status change, an escalation, an RTI request — so anything thrown here
  // surfaced to that person as though their action had failed, when it had
  // already succeeded and could not be undone. That is precisely how one
  // report came to be filed four times (see issueController.create): told it
  // failed, the reporter pressed the button again. The bell write below was
  // the last unguarded step; push, email and WhatsApp were already best
  // effort. Telling someone about a thing is less important than the thing.
  try {
    await Notification.create({ user: userId, title, message, link });
  } catch (err) {
    console.error(`Could not write the bell notification for user ${userId}:`, err.message);
  }

  try {
    await pushService.sendPush(userId, { title, message, link, image });
  } catch (err) {
    console.error('Push notification failed:', err.message);
  }

  let user = null;
  try {
    user = await User.findById(userId).select('email phone').lean();
  } catch (err) {
    console.error('Notification recipient lookup failed:', err.message);
  }
  const url = link ? `${SITE_URL}${link}` : null;

  try {
    if (user && user.email) {
      const html = buildEmailHtml({
        title,
        message: emailMessage !== undefined ? emailMessage : message,
        messageIsHtml: emailMessage !== undefined && !!emailMessageIsHtml,
        buttonLabel: emailButtonLabel,
        url,
        image
      });
      await emailService.sendMail(user.email, title, html);
    }
  } catch (err) {
    console.error('Email notification failed:', err.message);
  }

  try {
    if (user && user.phone) {
      await whatsappService.sendWhatsApp(user.phone, { title, message, url });
    }
  } catch (err) {
    console.error('WhatsApp notification failed:', err.message);
  }
};
