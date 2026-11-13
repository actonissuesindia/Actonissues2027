// Display-only relabeling, everywhere a role is shown to a user: stored
// "Admin" (the sole full-access owner role) shows as "Super Admin", stored
// "Authority" shows as "Admin", and stored "Citizen" shows as "Member". The
// underlying role value (permissions, route gating, database) is unchanged
// — only what's displayed differs from the stored value.
const DISPLAY_LABELS = { Admin: 'Super Admin', Authority: 'Admin', Citizen: 'Member', Lawyer: 'Lawyer' };

export default function roleLabel(role) {
  return DISPLAY_LABELS[role] || role;
}
