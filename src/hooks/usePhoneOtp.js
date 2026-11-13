import { useRef } from 'react';
import { RecaptchaVerifier, signInWithPhoneNumber } from 'firebase/auth';
import { auth } from '../services/firebaseClient';

// Wraps Firebase's phone sign-in flow: an invisible reCAPTCHA (required by
// Firebase to rate-limit SMS abuse) backs a "send code" step, then a
// "confirm code" step hands back an ID token for the backend to verify
// (see /api/auth/firebase-phone). Firebase sends and checks the SMS code
// itself — the server never sees it, only the resulting token.
export default function usePhoneOtp(containerId) {
  const confirmationRef = useRef(null);
  const verifierRef = useRef(null);

  const sendCode = async (phone) => {
    if (!verifierRef.current) {
      verifierRef.current = new RecaptchaVerifier(auth, containerId, { size: 'invisible' });
    }
    confirmationRef.current = await signInWithPhoneNumber(auth, phone, verifierRef.current);
  };

  const confirmCode = async (code) => {
    const result = await confirmationRef.current.confirm(code);
    return result.user.getIdToken();
  };

  return { sendCode, confirmCode };
}
