// Google's OAuth Client ID is a public identifier, not a secret — safe to
// ship in the frontend bundle. Must match the value used server-side in
// controllers/authController.js and be registered under this project's
// Authorized JavaScript origins in Google Cloud Console.
export const GOOGLE_CLIENT_ID = '458645747669-30fvbrdm54kj18gl437n51ung4rak1er.apps.googleusercontent.com';

// Firebase's web config is meant to be public (unlike GCS/Twilio/SMTP
// credentials) — it identifies the project, it doesn't authenticate as it.
// Real access control happens server-side in services/firebaseAdminService.js
// when verifying the ID token a client gets back from a completed sign-in.
export const FIREBASE_CONFIG = {
  apiKey: 'AIzaSyCsIsu_g2-0nfjiqYYi5Ilaf2leMtP_9jQ',
  authDomain: 'actonissue-9009.firebaseapp.com',
  projectId: 'actonissue-9009',
  storageBucket: 'actonissue-9009.firebasestorage.app',
  messagingSenderId: '458645747669',
  appId: '1:458645747669:web:541338860812cd385caf5c'
};
