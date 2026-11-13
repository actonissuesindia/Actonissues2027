// Mirrors src/utils/roleLabel.js — stored "Admin" (the sole full-access
// owner role) is displayed as "Super Admin", stored "Authority" is displayed
// as "Admin", and stored "Citizen" is displayed as "Member". Authorization
// logic below always checks the raw stored role; this is used only to word
// user-facing messages the way the requester actually sees their own role
// on screen.
const DISPLAY_LABELS = { Admin: 'Super Admin', Authority: 'Admin', Citizen: 'Member', Lawyer: 'Lawyer' };

module.exports = function roleLabel(role) {
  return DISPLAY_LABELS[role] || role;
};
