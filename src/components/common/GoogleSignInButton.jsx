import { useEffect, useRef, useState } from 'react';
import { GOOGLE_CLIENT_ID } from '../../config';
import { useAuth } from '../../context/AuthContext';

// Renders Google's own "Sign in with Google" button via the Google
// Identity Services script (loaded in index.html). On success it hands us
// a signed credential (a JWT), which the backend verifies — we never see
// or handle the user's Google password ourselves.
export default function GoogleSignInButton({ onSuccess, onError, acceptedTerms }) {
  const { loginWithGoogle } = useAuth();
  const buttonRef = useRef(null);
  const [unavailable, setUnavailable] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const render = () => {
      if (cancelled || !window.google?.accounts?.id || !buttonRef.current) return;
      window.google.accounts.id.initialize({
        client_id: GOOGLE_CLIENT_ID,
        callback: async (response) => {
          try {
            const user = await loginWithGoogle(response.credential, acceptedTerms);
            onSuccess && onSuccess(user);
          } catch (err) {
            onError && onError(err.response?.data?.message || 'Google sign-in failed');
          }
        }
      });
      // Google's button takes a fixed pixel width, not "100%" — measure
      // the actual space available so it matches the other full-width
      // buttons instead of overflowing (or leaving a gap in) its card.
      const width = Math.round(buttonRef.current.getBoundingClientRect().width) || 300;
      window.google.accounts.id.renderButton(buttonRef.current, {
        theme: 'outline', size: 'large', width, text: 'continue_with'
      });
    };

    if (window.google?.accounts?.id) {
      render();
    } else {
      // The GSI script loads with `defer` — poll briefly until it's ready
      // rather than assuming it's already there.
      const interval = setInterval(() => {
        if (window.google?.accounts?.id) {
          clearInterval(interval);
          render();
        }
      }, 200);
      const timeout = setTimeout(() => { clearInterval(interval); if (!window.google?.accounts?.id) setUnavailable(true); }, 6000);
      return () => { cancelled = true; clearInterval(interval); clearTimeout(timeout); };
    }

    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (unavailable) return null;
  return <div ref={buttonRef}></div>;
}
