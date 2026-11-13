// Mirrors utils/accountValidation.js on the server — kept in sync manually
// since the two run in different runtimes. Used to give immediate feedback
// client-side; the server is still the authoritative check.
export const PASSWORD_RULES_TEXT = '6-16 characters.';

const PASSWORD_RE = /^.{6,16}$/;

export function isValidPassword(password) {
  return PASSWORD_RE.test(password || '');
}
