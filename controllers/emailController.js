const email = require('../services/emailService');

exports.issueAssigned = async (user, issue) => {
  if (!user.email) return;
  await email.sendMail(
    user.email,
    'Issue Assigned',
    `<h3>${issue.title}</h3><p>You have been assigned issue ${issue.issueNumber}.</p>`
  );
};

exports.statusChanged = async (user, issue) => {
  if (!user.email) return;
  await email.sendMail(
    user.email,
    'Issue Status Updated',
    `<p>${issue.issueNumber} status is now <b>${issue.status}</b>.</p>`
  );
};
