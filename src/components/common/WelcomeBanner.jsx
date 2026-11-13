import { useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import burstConfetti from '../../utils/confetti';

// A one-time "curtain raiser" shown right after a fresh sign-in (see
// justLoggedIn in AuthContext) — two panels sweep open to reveal a
// personalized welcome, then it dismisses itself. Mounted once at the app
// root (see App.jsx) so it survives whatever route the login redirected to.
export default function WelcomeBanner() {
  const { user, justLoggedIn, clearJustLoggedIn } = useAuth();

  useEffect(() => {
    if (!justLoggedIn || !user) return undefined;
    const confettiTimer = setTimeout(
      () => burstConfetti(window.innerWidth / 2, window.innerHeight * 0.4, 60),
      1100
    );
    const dismissTimer = setTimeout(clearJustLoggedIn, 3800);
    return () => { clearTimeout(confettiTimer); clearTimeout(dismissTimer); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [justLoggedIn, user]);

  if (!justLoggedIn || !user) return null;

  const firstName = (user.name || '').split(' ')[0] || 'there';

  return (
    <div className="welcome-curtain" onClick={clearJustLoggedIn}>
      <div className="welcome-curtain-panel welcome-curtain-left" />
      <div className="welcome-curtain-panel welcome-curtain-right" />
      <div className="welcome-curtain-glow" />
      <div className="welcome-curtain-content">
        <div className="welcome-curtain-badge">👋</div>
        <h2 className="welcome-curtain-title">Welcome, {firstName}!</h2>
        <p className="welcome-curtain-subtitle">Glad to have you back — let's act on some issues.</p>
      </div>
    </div>
  );
}
