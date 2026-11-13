import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import api from '../../services/api';
import GoogleSignInButton from '../../components/common/GoogleSignInButton';
import InfoTip from '../../components/common/InfoTip';
import TermsCheckbox from '../../components/common/TermsCheckbox';
import usePhoneOtp from '../../hooks/usePhoneOtp';
import friendlyFirebaseError from '../../utils/friendlyFirebaseError';
import PhoneNumberInput, { DEFAULT_COUNTRY_CODE } from '../../components/common/PhoneNumberInput';
import { isValidPassword, PASSWORD_RULES_TEXT } from '../../utils/passwordPolicy';
import logoIcon from '../../assets/logo/aoi-logo.png';

// Mirrors utils/generateUserId.js's slugify on the backend — used here only
// to suggest a starting point as the person types their name, not as the
// final say (the backend re-validates and rejects a collision either way).
const slugify = (s) => (s || '').toLowerCase().replace(/[^a-z0-9]/g, '');

export default function Register() {
  const { registerWithPhone } = useAuth();
  const navigate = useNavigate();
  const phoneOtp = usePhoneOtp('register-recaptcha-container');

  const [step, setStep] = useState('details'); // 'details' | 'verify'

  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [userId, setUserId] = useState('');
  const [userIdEdited, setUserIdEdited] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [showPwd, setShowPwd] = useState(false);
  const [countryCode, setCountryCode] = useState(DEFAULT_COUNTRY_CODE);
  const [phone, setPhone] = useState('');
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [code, setCode] = useState('');

  const [error, setError] = useState('');
  const [info, setInfo] = useState('');
  const [busy, setBusy] = useState(false);

  // 'checking' | 'taken' | 'available' | ''
  const [emailAvailability, setEmailAvailability] = useState('');
  const [userIdAvailability, setUserIdAvailability] = useState('');

  // Suggests a User ID from the name as it's typed, but stops the moment
  // someone edits the field directly — their choice always wins from then on.
  useEffect(() => {
    if (userIdEdited) return;
    const base = slugify(`${firstName}${lastName}`);
    setUserId(base ? `${base}@aoi` : '');
  }, [firstName, lastName, userIdEdited]);

  useEffect(() => {
    const val = email.trim();
    if (!val || !val.includes('@')) { setEmailAvailability(''); return undefined; }
    setEmailAvailability('checking');
    const timer = setTimeout(() => {
      api.get('/auth/check-availability', { params: { email: val } })
        .then(res => setEmailAvailability(res.data.available ? 'available' : 'taken'))
        .catch(() => setEmailAvailability(''));
    }, 500);
    return () => clearTimeout(timer);
  }, [email]);

  useEffect(() => {
    const val = userId.trim().toLowerCase();
    if (!val || val.length < 3) { setUserIdAvailability(''); return undefined; }
    setUserIdAvailability('checking');
    const timer = setTimeout(() => {
      api.get('/auth/check-availability', { params: { userId: val } })
        .then(res => setUserIdAvailability(res.data.available ? 'available' : 'taken'))
        .catch(() => setUserIdAvailability(''));
    }, 500);
    return () => clearTimeout(timer);
  }, [userId]);

  const sendCode = async (e) => {
    e.preventDefault();
    setError(''); setInfo('');
    if (!firstName.trim() || !lastName.trim()) { setError('First and last name are required.'); return; }
    if (userIdAvailability === 'taken') { setError('That User ID is already taken.'); return; }
    if (emailAvailability === 'taken') { setError('That email is already registered — try logging in instead.'); return; }
    if (!isValidPassword(password)) { setError(`Password must be ${PASSWORD_RULES_TEXT}`); return; }
    if (password !== confirm) { setError('Passwords do not match.'); return; }
    if (!phone.trim()) { setError('A phone number is required.'); return; }
    if (!acceptedTerms) { setError('You must agree to the Terms of Use & Disclaimer to create an account.'); return; }

    setBusy(true);
    try {
      await phoneOtp.sendCode(countryCode + phone);
      setStep('verify');
      setInfo('Code sent via SMS.');
    } catch (err) {
      setError(friendlyFirebaseError(err));
    } finally {
      setBusy(false);
    }
  };

  const resendCode = async () => {
    setError(''); setInfo('');
    setBusy(true);
    try {
      await phoneOtp.sendCode(countryCode + phone);
      setInfo('Code sent via SMS.');
    } catch (err) {
      setError(friendlyFirebaseError(err));
    } finally {
      setBusy(false);
    }
  };

  const verifyAndCreate = async (e) => {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      const idToken = await phoneOtp.confirmCode(code);
      await registerWithPhone({
        idToken,
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        userId: userId.trim(),
        password,
        email: email.trim(),
        acceptedTerms
      });
      navigate('/feed', { replace: true });
    } catch (err) {
      setError(err.response?.data?.message || friendlyFirebaseError(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="auth-page d-flex align-items-center justify-content-center min-vh-100 py-4">
      <div style={{ width: '100%', maxWidth: 440 }}>
        <Link to="/" className="d-inline-flex align-items-center gap-1 fw-semibold text-decoration-none text-dark mb-3">
          <i className="bi bi-arrow-left"></i>Back to home
        </Link>
        <div className="card auth-card p-4 p-md-5">
          <div className="mb-4">
            <img src={logoIcon} alt="Act On Issues" className="brand-mark-img-lg mb-3" />
            <h3 className="fw-bold mt-2 mb-1">Join Act On Issues</h3>
            <p className="text-muted small mb-0">Post civic issues, rally support, and make your city better.</p>
          </div>

          {error && <div className="alert alert-danger py-2">{error}</div>}
          {info && !error && <div className="alert alert-success py-2">{info}</div>}

          {step === 'details' ? (
            <form onSubmit={sendCode}>
              <div className="row g-3 mb-3">
                <div className="col-6">
                  <label className="form-label small fw-semibold">First name</label>
                  <input className="form-control" value={firstName} onChange={e => setFirstName(e.target.value)} required />
                </div>
                <div className="col-6">
                  <label className="form-label small fw-semibold">Last name</label>
                  <input className="form-control" value={lastName} onChange={e => setLastName(e.target.value)} required />
                </div>
              </div>

              <div className="mb-3">
                <label className="form-label small fw-semibold d-flex align-items-center gap-1">
                  User ID
                  <InfoTip text="Your third way to log in, alongside email and phone. Suggested from your name — edit it if you'd like something else." />
                </label>
                <input className="form-control" value={userId}
                  onChange={e => { setUserId(e.target.value); setUserIdEdited(true); }} required minLength={3} maxLength={30} />
                {userIdAvailability === 'taken' && <div className="small text-danger mt-1">This User ID is already taken.</div>}
                {userIdAvailability === 'available' && (
                  <div className="small text-success mt-1"><i className="bi bi-check-circle-fill me-1"></i>Available</div>
                )}
              </div>

              <div className="mb-3">
                <label className="form-label small fw-semibold d-flex align-items-center gap-1">
                  Email address
                  <InfoTip text="Used to sign in and receive updates on your reported issues." />
                </label>
                <input type="email" className="form-control" value={email} onChange={e => setEmail(e.target.value)} required />
                {emailAvailability === 'taken' && <div className="small text-danger mt-1">This email is already registered.</div>}
                {emailAvailability === 'available' && (
                  <div className="small text-success mt-1"><i className="bi bi-check-circle-fill me-1"></i>Available</div>
                )}
              </div>

              <div className="mb-3">
                <label className="form-label small fw-semibold">Password</label>
                <div className="position-relative">
                  <input type={showPwd ? 'text' : 'password'} className="form-control pe-5" value={password}
                    onChange={e => setPassword(e.target.value)} required minLength={6} maxLength={16} placeholder="6-16 characters" />
                  <button type="button" className="btn btn-link position-absolute top-50 end-0 translate-middle-y text-muted"
                    onClick={() => setShowPwd(s => !s)} tabIndex={-1}>
                    <i className={`bi ${showPwd ? 'bi-eye-slash' : 'bi-eye'}`}></i>
                  </button>
                </div>
                <div className="form-text">{PASSWORD_RULES_TEXT}</div>
              </div>

              <div className="mb-3">
                <label className="form-label small fw-semibold">Confirm password</label>
                <input type={showPwd ? 'text' : 'password'} className="form-control" value={confirm}
                  onChange={e => setConfirm(e.target.value)} required minLength={6} maxLength={16} />
              </div>

              <div className="mb-3">
                <label className="form-label small fw-semibold d-flex align-items-center gap-1">
                  Phone number
                  <InfoTip text="Pick your country, then enter your number without the country code. We'll text a one-time code to verify it's you before your account is created." />
                </label>
                <PhoneNumberInput countryCode={countryCode} onCountryCodeChange={setCountryCode} number={phone} onNumberChange={setPhone} />
              </div>

              <TermsCheckbox checked={acceptedTerms} onChange={setAcceptedTerms} id="accept-terms-register" />
              <div id="register-recaptcha-container"></div>
              <button className="btn btn-gradient w-100" disabled={busy || !acceptedTerms}>
                {busy ? 'Sending code…' : 'Send verification code'}
              </button>
            </form>
          ) : (
            <form onSubmit={verifyAndCreate}>
              <p className="text-muted small">
                Enter the code texted to <strong>{countryCode}{phone}</strong>.
              </p>
              <div className="mb-3">
                <label className="form-label small fw-semibold">Verification code</label>
                <input className="form-control" value={code} onChange={e => setCode(e.target.value)}
                  required maxLength={6} placeholder="6-digit code" autoFocus />
                <button type="button" className="btn btn-link btn-sm px-0 mt-1" onClick={resendCode} disabled={busy}>
                  Resend code
                </button>
              </div>
              <button className="btn btn-gradient w-100 mb-2" disabled={busy}>
                {busy ? 'Creating account…' : 'Verify & Create Account'}
              </button>
              <button type="button" className="btn btn-outline-secondary w-100" onClick={() => { setStep('details'); setError(''); setInfo(''); }} disabled={busy}>
                Edit details
              </button>
            </form>
          )}

          <div className="d-flex align-items-center gap-2 my-3">
            <hr className="flex-grow-1" />
            <span className="text-muted small">or</span>
            <hr className="flex-grow-1" />
          </div>
          {acceptedTerms ? (
            <div>
              <GoogleSignInButton
                acceptedTerms={acceptedTerms}
                onSuccess={() => navigate('/feed', { replace: true })}
                onError={setError}
              />
            </div>
          ) : (
            <p className="text-muted small text-center">Agree to the Terms above to continue with Google.</p>
          )}

          <p className="text-center small mt-3 mb-0">
            <span className="text-muted">Already have an account? </span>
            <Link to="/login" className="fw-semibold" style={{ color: 'var(--grad-a)' }}>Log in</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
