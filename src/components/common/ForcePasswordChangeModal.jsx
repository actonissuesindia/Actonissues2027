import { useState } from 'react';
import { useAuth } from '../../context/AuthContext';

// Blocking overlay shown right after login when an Admin/Authority handed
// this user a password directly (new account or reset) — they must pick
// their own password before doing anything else in the app.
export default function ForcePasswordChangeModal() {
  const { user, changePassword } = useAuth();
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  if (!user?.mustChangePassword) return null;

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    if (next !== confirm) {
      setError('New passwords do not match.');
      return;
    }
    setBusy(true);
    try {
      await changePassword(current, next);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to change password');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      className="position-fixed top-0 start-0 w-100 h-100 d-flex align-items-center justify-content-center"
      style={{ background: 'rgba(0,0,0,0.6)', zIndex: 2000 }}
    >
      <div className="card p-4" style={{ width: '100%', maxWidth: 420 }}>
        <h5 className="fw-bold mb-1">Set a new password</h5>
        <p className="text-muted small mb-3">
          Your account was set up with a temporary password. Please choose your own password to continue.
        </p>
        {error && <div className="alert alert-danger py-2">{error}</div>}
        <form onSubmit={submit}>
          <div className="mb-3">
            <label className="form-label small fw-semibold">Temporary password</label>
            <input type="password" className="form-control" value={current}
              onChange={e => setCurrent(e.target.value)} required autoFocus />
          </div>
          <div className="mb-3">
            <label className="form-label small fw-semibold">New password</label>
            <input type="password" className="form-control" value={next} minLength={6} maxLength={16}
              onChange={e => setNext(e.target.value)} required placeholder="6-16 characters" />
          </div>
          <div className="mb-3">
            <label className="form-label small fw-semibold">Confirm new password</label>
            <input type="password" className="form-control" value={confirm} minLength={6} maxLength={16}
              onChange={e => setConfirm(e.target.value)} required />
          </div>
          <button className="btn btn-gradient w-100" disabled={busy}>
            {busy ? 'Saving…' : 'Set Password & Continue'}
          </button>
        </form>
      </div>
    </div>
  );
}
