import { createContext, useContext, useEffect, useState } from 'react';
import api from '../services/api';
import { useLanguage } from './LanguageContext';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const { language, setLanguage } = useLanguage();
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  // True only right after an actual sign-in action in this tab (login,
  // register, OTP verify, Google, reset) — never set by the silent
  // /auth/me session-restore on page load, so the welcome banner shows
  // once per real login, not on every refresh while already signed in.
  const [justLoggedIn, setJustLoggedIn] = useState(false);
  const clearJustLoggedIn = () => setJustLoggedIn(false);

  // Restore session on first load.
  useEffect(() => {
    api.get('/auth/me')
      .then(res => setUser(res.data.user))
      .catch(() => setUser(null))
      .finally(() => setLoading(false));
  }, []);

  // Reacts to the backend independently expiring an idle session (see
  // services/api.js's response interceptor) — clears local state so
  // ProtectedRoute redirects to /login instead of the app sitting on a
  // session the server has already destroyed.
  useEffect(() => {
    const onIdleTimeout = () => {
      sessionStorage.setItem('aoi_logout_reason', 'idle');
      setUser(null);
    };
    window.addEventListener('auth:idle-timeout', onIdleTimeout);
    return () => window.removeEventListener('auth:idle-timeout', onIdleTimeout);
  }, []);

  // A signed-in account's saved language (set via the LanguageSwitcher on
  // any device — see components/common/LanguageSwitcher.jsx) takes effect
  // here on login/session-restore, so the choice follows the account
  // rather than staying stuck to whichever browser it was picked in. A
  // no-op when they already match (e.g. right after using the switcher
  // itself, which updates both together).
  useEffect(() => {
    if (user?.preferredLanguage && user.preferredLanguage !== language) {
      setLanguage(user.preferredLanguage);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  // Proactive client-side half of the same 1-hour idle rule enforced
  // server-side (middleware/auth.js) — logs out the moment idleness is
  // detected in this tab, rather than waiting for the next API call to
  // fail against an already-expired session. Only runs while signed in.
  useEffect(() => {
    if (!user) return;
    const IDLE_LIMIT_MS = 60 * 60 * 1000;
    let timer;
    const handleIdle = () => {
      sessionStorage.setItem('aoi_logout_reason', 'idle');
      logout();
    };
    const resetTimer = () => {
      clearTimeout(timer);
      timer = setTimeout(handleIdle, IDLE_LIMIT_MS);
    };
    const activityEvents = ['mousemove', 'mousedown', 'keydown', 'scroll', 'touchstart'];
    activityEvents.forEach(e => window.addEventListener(e, resetTimer));
    resetTimer();
    return () => {
      clearTimeout(timer);
      activityEvents.forEach(e => window.removeEventListener(e, resetTimer));
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  // identifier can be an email address or a phone number.
  const login = async (identifier, password) => {
    const res = await api.post('/auth/login', { identifier, password });
    setUser(res.data.user);
    setJustLoggedIn(true);
    return res.data.user;
  };

  // The only self-registration path — idToken comes from a completed
  // Firebase phone sign-in (see usePhoneOtp), confirming the phone number
  // before the account is actually created with the rest of these details.
  const registerWithPhone = async ({ idToken, firstName, lastName, userId, password, email, acceptedTerms }) => {
    const res = await api.post('/auth/register-with-phone', { idToken, firstName, lastName, userId, password, email, acceptedTerms });
    setUser(res.data.user);
    setJustLoggedIn(true);
    return res.data.user;
  };

  const requestOtp = async (identifier) => {
    await api.post('/auth/otp/request', { identifier });
  };

  // name/acceptedTerms are only needed the first time (creates the account); ignored for existing users.
  const verifyOtp = async (identifier, code, name, acceptedTerms) => {
    const res = await api.post('/auth/otp/verify', { identifier, code, name, acceptedTerms });
    setUser(res.data.user);
    setJustLoggedIn(true);
    return res.data.user;
  };

  const loginWithGoogle = async (credential, acceptedTerms) => {
    const res = await api.post('/auth/google', { credential, acceptedTerms });
    setUser(res.data.user);
    setJustLoggedIn(true);
    return res.data.user;
  };

  // idToken comes from a completed Firebase phone sign-in (see usePhoneOtp).
  // name/acceptedTerms are only needed the first time (creates the account).
  const loginWithFirebasePhone = async (idToken, name, acceptedTerms) => {
    const res = await api.post('/auth/firebase-phone', { idToken, name, acceptedTerms });
    setUser(res.data.user);
    setJustLoggedIn(true);
    return res.data.user;
  };

  const forgotPassword = async (email) => {
    await api.post('/auth/forgot-password', { email });
  };

  const resetPassword = async (email, code, newPassword) => {
    const res = await api.post('/auth/reset-password', { email, code, newPassword });
    setUser(res.data.user);
    setJustLoggedIn(true);
    return res.data.user;
  };

  const logout = async () => {
    await api.post('/auth/logout');
    setUser(null);
    setJustLoggedIn(false);
  };

  const updateProfile = async (name) => {
    const res = await api.patch('/auth/me', { name });
    setUser(res.data.user);
    return res.data.user;
  };

  const updateUserId = async (userId) => {
    const res = await api.patch('/auth/me/user-id', { userId });
    setUser(res.data.user);
    return res.data.user;
  };

  const uploadAvatar = async (file) => {
    const fd = new FormData();
    fd.append('avatar', file);
    const res = await api.post('/auth/me/avatar', fd);
    setUser(res.data.user);
    return res.data.user;
  };

  const uploadBanner = async (file) => {
    const fd = new FormData();
    fd.append('banner', file);
    const res = await api.post('/auth/me/banner', fd);
    setUser(res.data.user);
    return res.data.user;
  };

  const changePassword = async (currentPassword, newPassword) => {
    const res = await api.post('/auth/change-password', { currentPassword, newPassword });
    setUser(res.data.user);
  };

  const markTourSeen = async (seen = true) => {
    const res = await api.post('/auth/me/tour-seen', { seen });
    setUser(res.data.user);
  };

  return (
    <AuthContext.Provider value={{
      user, loading, login, registerWithPhone, requestOtp, verifyOtp, loginWithGoogle, loginWithFirebasePhone,
      forgotPassword, resetPassword,
      logout, updateProfile, updateUserId, uploadAvatar, uploadBanner, changePassword, markTourSeen,
      justLoggedIn, clearJustLoggedIn
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
