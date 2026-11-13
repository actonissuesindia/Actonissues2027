import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import InfoTip from '../../components/common/InfoTip';
import { isValidPassword, PASSWORD_RULES_TEXT } from '../../utils/passwordPolicy';
import logoIcon from '../../assets/logo/aoi-logo.png';

export default function ForgotPassword() {
  const { forgotPassword, resetPassword } = useAuth();
  const navigate = useNavigate();

  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');
  const [busy, setBusy] = useState(false);

  const sendCode = async (e) => {
    e.preventDefault();
    setError(''); setInfo('');
    setBusy(true);
    try {
      await forgotPassword(email);
      setSent(true);
      setInfo('A reset code has been sent to your email.');
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to send reset code');
    } finally {
      setBusy(false);
    }
  };

  const submitReset = async (e) => {
    e.preventDefault();
    setError('');
    if (!isValidPassword(newPassword)) {
      setError(`Password must be ${PASSWORD_RULES_TEXT}`);
      return;
    }
    setBusy(true);
    try {
      const user = await resetPassword(email, code, newPassword);
      const dest = user.role === 'Admin' ? '/admin' : user.role === 'Authority' ? '/author' : '/feed';
      navigate(dest, { replace: true });
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to reset password');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="auth-page d-flex align-items-center justify-content-center min-vh-100 py-4">
      <div style={{ width: '100%', maxWidth: 440 }}>
        <Link to="/login" className="d-inline-flex align-items-center gap-1 fw-semibold text-decoration-none text-dark mb-3">
          <i className="bi bi-arrow-left"></i>Back to login
        </Link>
        <div className="card auth-card p-4 p-md-5">
          <div className="mb-4">
            <img src={logoIcon} alt="Act On Issues" className="brand-mark-img-lg mb-3" />
            <h3 className="fw-bold mt-2 mb-1">Reset your password</h3>
            <p className="text-muted small mb-0">
              {sent ? 'Enter the code we emailed you, along with a new password.' : "Enter your account's email address and we'll send you a reset code."}
            </p>
          </div>

          {error && <div className="alert alert-danger py-2">{error}</div>}
          {info && !error && <div className="alert alert-success py-2">{info}</div>}

          {!sent ? (
            <form onSubmit={sendCode}>
              <div className="mb-3">
                <label className="form-label small fw-semibold d-flex align-items-center gap-1">
                  Email address
                  <InfoTip text="Enter the email address on your account — we'll send a reset code there." />
                </label>
                <input type="email" className="form-control" value={email}
                  onChange={e => setEmail(e.target.value)} required />
              </div>
              <button className="btn btn-gradient w-100" disabled={busy}>
                {busy ? 'Sending…' : 'Send reset code'}
              </button>
            </form>
          ) : (
            <form onSubmit={submitReset}>
              <div className="mb-3">
                <label className="form-label small fw-semibold">Verification code</label>
                <input className="form-control" value={code} onChange={e => setCode(e.target.value)}
                  required maxLength={6} placeholder="6-digit code" />
                <button type="button" className="btn btn-link btn-sm px-0 mt-1" onClick={sendCode} disabled={busy}>
                  Resend code
                </button>
              </div>
              <div className="mb-3">
                <label className="form-label small fw-semibold">New password</label>
                <input type="password" className="form-control" value={newPassword}
                  onChange={e => setNewPassword(e.target.value)} required minLength={6} maxLength={16} placeholder="6-16 characters" />
                <div className="form-text">{PASSWORD_RULES_TEXT}</div>
              </div>
              <button className="btn btn-gradient w-100" disabled={busy}>
                {busy ? 'Resetting…' : 'Reset password & log in'}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
