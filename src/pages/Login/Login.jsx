import { useEffect, useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import GoogleSignInButton from '../../components/common/GoogleSignInButton';
import InfoTip from '../../components/common/InfoTip';
import usePhoneOtp from '../../hooks/usePhoneOtp';
import friendlyFirebaseError from '../../utils/friendlyFirebaseError';
import PhoneNumberInput, { DEFAULT_COUNTRY_CODE } from '../../components/common/PhoneNumberInput';
import logoIcon from '../../assets/logo/aoi-logo.png';

export default function Login() {
  const { login, requestOtp, verifyOtp, loginWithFirebasePhone } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const toast = useToast();
  const [tab, setTab] = useState('password');

  // Set by AuthContext right before it clears the session on the 1-hour
  // idle timeout (client-side timer or the server rejecting a stale
  // session) — a one-time explanation for why the user landed back here.
  useEffect(() => {
    if (sessionStorage.getItem('aoi_logout_reason') === 'idle') {
      sessionStorage.removeItem('aoi_logout_reason');
      toast('You were signed out after an hour of inactivity', 'info');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  // A specific deep link (e.g. a moderation link to an issue, or a Ludo
  // join code in the query string) is always honored; otherwise
  // Admin/Authority land on their own control panel instead of the citizen
  // feed. Preserve the query string too, not just the path — dropping it
  // silently loses things like ?join=ABC123.
  const fromLocation = location.state?.from;
  const from = fromLocation ? fromLocation.pathname + (fromLocation.search || '') : null;
  const destinationFor = (user) => from || (user.role === 'Admin' ? '/admin' : user.role === 'Authority' ? '/author' : '/feed');

  // Password tab
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [showPwd, setShowPwd] = useState(false);

  // Email OTP tab
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [otpSent, setOtpSent] = useState(false);

  // Phone OTP tab
  const phoneOtp = usePhoneOtp('login-recaptcha-container');
  const [countryCode, setCountryCode] = useState(DEFAULT_COUNTRY_CODE);
  const [phone, setPhone] = useState('');
  const [phoneCode, setPhoneCode] = useState('');
  const [phoneOtpSent, setPhoneOtpSent] = useState(false);

  const [error, setError] = useState('');
  const [info, setInfo] = useState('');
  const [busy, setBusy] = useState(false);
  // OTP login (email or phone) against an identifier with no existing
  // account fails server-side with "Name is required to create an
  // account" — Login intentionally never collects a name/Terms acceptance
  // (that's Register's job), so this is shown as "no account, go sign up"
  // instead of a confusing dead-end error.
  const [noAccountFound, setNoAccountFound] = useState(false);

  const submitPassword = async (e) => {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      const user = await login(identifier, password);
      navigate(destinationFor(user), { replace: true });
    } catch (err) {
      setError(err.response?.data?.message || 'Login failed');
    } finally {
      setBusy(false);
    }
  };

  const sendCode = async (e) => {
    e.preventDefault();
    setError(''); setInfo(''); setNoAccountFound(false);
    setBusy(true);
    try {
      await requestOtp(email);
      setOtpSent(true);
      setInfo('Code sent — check your inbox.');
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to send code');
    } finally {
      setBusy(false);
    }
  };

  const submitOtp = async (e) => {
    e.preventDefault();
    setError(''); setNoAccountFound(false);
    setBusy(true);
    try {
      const user = await verifyOtp(email, code);
      navigate(destinationFor(user), { replace: true });
    } catch (err) {
      const msg = err.response?.data?.message;
      if (msg === 'Name is required to create an account') { setNoAccountFound(true); setInfo(''); }
      else setError(msg || 'Invalid code');
    } finally {
      setBusy(false);
    }
  };

  const sendPhoneCode = async (e) => {
    e.preventDefault();
    setError(''); setInfo(''); setNoAccountFound(false);
    setBusy(true);
    try {
      await phoneOtp.sendCode(countryCode + phone);
      setPhoneOtpSent(true);
      setInfo('Code sent via SMS.');
    } catch (err) {
      setError(friendlyFirebaseError(err));
    } finally {
      setBusy(false);
    }
  };

  const submitPhoneOtp = async (e) => {
    e.preventDefault();
    setError(''); setNoAccountFound(false);
    setBusy(true);
    try {
      const idToken = await phoneOtp.confirmCode(phoneCode);
      const user = await loginWithFirebasePhone(idToken);
      navigate(destinationFor(user), { replace: true });
    } catch (err) {
      const msg = err.response?.data?.message;
      if (msg === 'Name is required to create an account') { setNoAccountFound(true); setInfo(''); }
      else setError(msg || friendlyFirebaseError(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="auth-page d-flex align-items-center justify-content-center min-vh-100 py-4">
      <div style={{ width: '100%', maxWidth: 300 }}>
        <Link to="/" className="d-inline-flex align-items-center gap-1 fw-semibold text-decoration-none text-dark mb-3">
          <i className="bi bi-arrow-left"></i>Back to home
        </Link>
        <div className="card auth-card p-4">
          <div className="mb-4">
            <img src={logoIcon} alt="Act On Issues" className="brand-mark-img-lg mb-3" />
            <h3 className="fw-bold mt-2 mb-1">Welcome back</h3>
            <p className="text-muted small mb-0">Sign in to report and track civic issues.</p>
          </div>

          <div className="auth-tab-toggle mb-4">
            <button type="button" className={tab === 'password' ? 'active' : ''} onClick={() => { setTab('password'); setError(''); setInfo(''); setNoAccountFound(false); }}>
              Password
            </button>
            <button type="button" className={tab === 'otp' ? 'active' : ''} onClick={() => { setTab('otp'); setError(''); setInfo(''); setNoAccountFound(false); }}>
              Email OTP
            </button>
            <button type="button" className={tab === 'phone' ? 'active' : ''} onClick={() => { setTab('phone'); setError(''); setInfo(''); setNoAccountFound(false); }}>
              Phone OTP
            </button>
          </div>

          {error && <div className="alert alert-danger py-2">{error}</div>}
          {info && !error && <div className="alert alert-success py-2">{info}</div>}
          {noAccountFound && (
            <div className="alert alert-warning py-2">
              No account found for that {tab === 'phone' ? 'phone number' : 'email address'} yet.
              {' '}<Link to="/register" className="fw-semibold">Create one</Link> instead — it only takes a moment.
            </div>
          )}

          {tab === 'password' ? (
            <form onSubmit={submitPassword}>
              <div className="mb-3">
                <label className="form-label small fw-semibold d-flex align-items-center gap-1">
                  User ID, email, or phone number
                  <InfoTip text="Use whichever one you signed up with — your User ID, email address, or phone number." />
                </label>
                <input className="form-control" value={identifier}
                  onChange={e => setIdentifier(e.target.value)} required />
              </div>
              <div className="mb-3">
                <label className="form-label small fw-semibold">Password</label>
                <div className="position-relative">
                  <input type={showPwd ? 'text' : 'password'} className="form-control pe-5" value={password}
                    onChange={e => setPassword(e.target.value)} required placeholder="Enter your password" />
                  <button type="button" className="btn btn-link position-absolute top-50 end-0 translate-middle-y text-muted"
                    onClick={() => setShowPwd(s => !s)} tabIndex={-1}>
                    <i className={`bi ${showPwd ? 'bi-eye-slash' : 'bi-eye'}`}></i>
                  </button>
                </div>
              </div>
              <div className="text-end mb-3">
                <Link to="/forgot-password" className="small text-decoration-none" style={{ color: 'var(--grad-a)' }}>Forgot password?</Link>
              </div>
              <button className="btn btn-gradient w-100" disabled={busy}>
                {busy ? 'Signing in…' : 'Log in'}
              </button>
            </form>
          ) : tab === 'otp' ? (
            <form onSubmit={otpSent ? submitOtp : sendCode}>
              <div className="mb-3">
                <label className="form-label small fw-semibold d-flex align-items-center gap-1">
                  Email address
                  <InfoTip text="We'll send a one-time code to this address to verify it's you." />
                </label>
                <input type="email" className="form-control" value={email}
                  onChange={e => setEmail(e.target.value)} required disabled={otpSent} />
              </div>
              {otpSent && (
                <div className="mb-3">
                  <label className="form-label small fw-semibold">Verification code</label>
                  <input className="form-control" value={code} onChange={e => setCode(e.target.value)}
                    required maxLength={6} placeholder="6-digit code" />
                  <button type="button" className="btn btn-link btn-sm px-0 mt-1" onClick={sendCode} disabled={busy}>
                    Resend code
                  </button>
                </div>
              )}
              <button className="btn btn-gradient w-100" disabled={busy}>
                {busy ? 'Please wait…' : otpSent ? 'Verify & Log in' : 'Send code'}
              </button>
            </form>
          ) : (
            <form onSubmit={phoneOtpSent ? submitPhoneOtp : sendPhoneCode}>
              <div className="mb-3">
                <label className="form-label small fw-semibold d-flex align-items-center gap-1">
                  Phone number
                  <InfoTip text="Pick your country, then enter your number without the country code. We'll text a one-time code to verify it's you." />
                </label>
                <PhoneNumberInput
                  countryCode={countryCode} onCountryCodeChange={setCountryCode}
                  number={phone} onNumberChange={setPhone}
                  disabled={phoneOtpSent}
                />
              </div>
              {phoneOtpSent && (
                <div className="mb-3">
                  <label className="form-label small fw-semibold">Verification code</label>
                  <input className="form-control" value={phoneCode} onChange={e => setPhoneCode(e.target.value)}
                    required maxLength={6} placeholder="6-digit code" />
                  <button type="button" className="btn btn-link btn-sm px-0 mt-1" onClick={sendPhoneCode} disabled={busy}>
                    Resend code
                  </button>
                </div>
              )}
              <div id="login-recaptcha-container"></div>
              <button className="btn btn-gradient w-100" disabled={busy}>
                {busy ? 'Please wait…' : phoneOtpSent ? 'Verify & Log in' : 'Send code'}
              </button>
            </form>
          )}

          <div className="d-flex align-items-center gap-2 my-3">
            <hr className="flex-grow-1" />
            <span className="text-muted small">or</span>
            <hr className="flex-grow-1" />
          </div>
          <GoogleSignInButton
            acceptedTerms
            onSuccess={(user) => navigate(destinationFor(user), { replace: true })}
            onError={setError}
          />

          <p className="text-center small mt-3 mb-0">
            <span className="text-muted">No account? </span>
            <Link to="/register" className="fw-semibold" style={{ color: 'var(--grad-a)' }}>Get started</Link>
          </p>
          <p className="text-center text-muted mt-2 mb-0" style={{ fontSize: '0.75rem' }}>
            By continuing, you agree to our <Link to="/terms" target="_blank">Terms of Use &amp; Disclaimer</Link>
            {' '}and <Link to="/privacy" target="_blank">Privacy Policy</Link>.
          </p>
        </div>
      </div>
    </div>
  );
}
