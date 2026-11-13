const { initializeApp, cert, applicationDefault } = require('firebase-admin/app');
const { getAuth } = require('firebase-admin/auth');
const path = require('path');

let app = null;

// Lazily initializes the Admin SDK, same lazy pattern as pushService — a
// missing/incomplete config never crashes the server at boot, only surfaces
// when phone sign-in is actually attempted.
//
// Two ways to authenticate, mirroring how GCS is configured (config/gcs.js):
// - Local dev: a downloaded service account key file, path given by
//   FIREBASE_SERVICE_ACCOUNT_KEY_FILE.
// - Production (Cloud Run): no key file needed — applicationDefault() uses
//   the identity Cloud Run itself runs as, once that service account is
//   granted the "Firebase Authentication Admin" role (see docs/DEPLOYMENT.md).
function ensureInitialized() {
  if (app) return app;
  const keyFile = process.env.FIREBASE_SERVICE_ACCOUNT_KEY_FILE;
  app = initializeApp({
    credential: keyFile
      ? cert(require(path.resolve(keyFile)))
      : applicationDefault(),
    projectId: process.env.FIREBASE_PROJECT_ID
  });
  return app;
}

// Verifies a Firebase ID token from the client's completed phone sign-in and
// returns its decoded claims (includes `phone_number` once verified).
// Throws on an invalid/expired/tampered token — callers turn that into a 401.
exports.verifyIdToken = async (idToken) => {
  const firebaseApp = ensureInitialized();
  return getAuth(firebaseApp).verifyIdToken(idToken);
};
