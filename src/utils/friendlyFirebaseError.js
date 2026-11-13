const MESSAGES = {
  'auth/invalid-phone-number': 'Enter a valid phone number with country code, e.g. +91XXXXXXXXXX.',
  'auth/too-many-requests': 'Too many attempts — please wait a bit before trying again.',
  'auth/code-expired': 'That code has expired — request a new one.',
  'auth/invalid-verification-code': 'Incorrect code — please check and try again.',
  'auth/quota-exceeded': 'SMS verification is temporarily unavailable — please try again later.'
};

// Firebase throws errors shaped like "Firebase: Error (auth/invalid-phone-number)."
// — this maps the known ones to plain English, and falls back to stripping
// the "Firebase: ... (code)." wrapper for anything unmapped.
export default function friendlyFirebaseError(err) {
  const code = err?.code;
  if (code && MESSAGES[code]) return MESSAGES[code];
  return err?.message?.replace(/^Firebase:\s*/, '').replace(/\s*\(auth\/[\w-]+\)\.?$/, '') || 'Something went wrong — please try again.';
}
