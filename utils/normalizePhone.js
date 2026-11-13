// Best-effort normalization to E.164 for a bare Indian mobile number typed
// without a country code (e.g. "7842456778" -> "+917842456778"). A number
// that already looks like E.164 (starts with "+") is left untouched;
// anything else unrecognized is also left untouched rather than guessed
// wrong — a silently mismatched phone number breaks phone-based login
// (password login by phone, and Firebase Phone OTP, both compare against
// the exact stored value).
function normalizePhone(phone) {
  if (!phone) return phone;
  const trimmed = phone.trim();
  if (trimmed.startsWith('+')) return trimmed;
  const digits = trimmed.replace(/\D/g, '');
  if (digits.length === 10) return `+91${digits}`;
  if (digits.length === 11 && digits.startsWith('0')) return `+91${digits.slice(1)}`;
  return trimmed;
}

module.exports = { normalizePhone };
