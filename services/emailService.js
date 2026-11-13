const nodemailer = require('nodemailer');

let transporter = null;

function getTransporter() {
  if (!transporter) {
    transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: process.env.SMTP_PORT,
      secure: false,
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS
      }
    });
  }
  return transporter;
}

exports.sendMail = async (to, subject, html, { replyTo, cc } = {}) => {
  try {
    return await getTransporter().sendMail({ from: process.env.SMTP_FROM, to, cc, subject, html, replyTo });
  } catch (err) {
    throw new Error(`Email delivery is not configured correctly: ${err.message}`);
  }
};
