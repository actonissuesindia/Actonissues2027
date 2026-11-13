import { useEffect, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import BlobAvatar from '../../components/common/BlobAvatar';
import api from '../../services/api';
import { isValidPassword, PASSWORD_RULES_TEXT } from '../../utils/passwordPolicy';

const THEMES = [
  { key: 'light', label: 'Light', icon: 'bi-sun-fill' },
  { key: 'dark', label: 'Dark', icon: 'bi-moon-stars-fill' },
  { key: 'ocean', label: 'Ocean', icon: 'bi-water' },
  { key: 'forest', label: 'Forest', icon: 'bi-tree-fill' },
  { key: 'civic-teal', label: 'Civic Teal', icon: 'bi-droplet-fill' },
  { key: 'civic-blue', label: 'Civic Blue', icon: 'bi-shield-fill' },
  { key: 'system', label: 'System', icon: 'bi-display' }
];

const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

export default function Profile() {
  const { user, updateProfile, updateUserId, uploadAvatar, uploadBanner, changePassword, markTourSeen } = useAuth();
  const { theme, setTheme } = useTheme();

  const [name, setName] = useState(user?.name || '');
  const [profileMsg, setProfileMsg] = useState('');
  const [profileErr, setProfileErr] = useState('');
  const [savingProfile, setSavingProfile] = useState(false);

  const [userId, setUserId] = useState(user?.userId || '');
  const [userIdMsg, setUserIdMsg] = useState('');
  const [userIdErr, setUserIdErr] = useState('');
  const [savingUserId, setSavingUserId] = useState(false);
  // 'checking' | 'taken' | 'available' | '' — debounced, same pattern as
  // Register's email-availability check.
  const [userIdAvailability, setUserIdAvailability] = useState('');
  const userIdChangesRemaining = Math.max(0, 3 - (user?.userIdChangeCount || 0));
  const userIdLocked = userIdChangesRemaining === 0;

  useEffect(() => {
    const val = userId.trim().toLowerCase();
    if (!val || val === user?.userId) { setUserIdAvailability(''); return undefined; }
    setUserIdAvailability('checking');
    const timer = setTimeout(() => {
      api.get('/auth/check-availability', { params: { userId: val } })
        .then(res => setUserIdAvailability(res.data.available ? 'available' : 'taken'))
        .catch(() => setUserIdAvailability(''));
    }, 500);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  const saveUserId = async (e) => {
    e.preventDefault();
    setUserIdErr(''); setUserIdMsg(''); setSavingUserId(true);
    try {
      await updateUserId(userId.trim());
      setUserIdMsg(`User ID updated. ${userIdChangesRemaining - 1} change${userIdChangesRemaining - 1 === 1 ? '' : 's'} left.`);
    } catch (err) {
      setUserIdErr(err.response?.data?.message || 'Failed to update User ID');
    } finally {
      setSavingUserId(false);
    }
  };

  const [avatarBusy, setAvatarBusy] = useState(false);
  const [avatarErr, setAvatarErr] = useState('');
  const [bannerBusy, setBannerBusy] = useState(false);
  const [bannerErr, setBannerErr] = useState('');

  const pickPhoto = async (file, setBusy, setErr, upload) => {
    if (!file) return;
    if (file.size > MAX_IMAGE_BYTES) {
      setErr(`"${file.name}" is over the 5MB limit.`);
      return;
    }
    setErr(''); setBusy(true);
    try {
      await upload(file);
    } catch (err) {
      setErr(err.response?.data?.message || 'Failed to upload image');
    } finally {
      setBusy(false);
    }
  };

  const [pwd, setPwd] = useState({ current: '', next: '', confirm: '' });
  const [pwdMsg, setPwdMsg] = useState('');
  const [pwdErr, setPwdErr] = useState('');
  const [savingPwd, setSavingPwd] = useState(false);

  const saveProfile = async (e) => {
    e.preventDefault();
    setProfileErr(''); setProfileMsg(''); setSavingProfile(true);
    try {
      await updateProfile(name);
      setProfileMsg('Profile updated.');
    } catch (err) {
      setProfileErr(err.response?.data?.message || 'Failed to update profile');
    } finally {
      setSavingProfile(false);
    }
  };

  const savePassword = async (e) => {
    e.preventDefault();
    setPwdErr(''); setPwdMsg('');
    if (!isValidPassword(pwd.next)) { setPwdErr(`Password must be ${PASSWORD_RULES_TEXT}`); return; }
    if (pwd.next !== pwd.confirm) { setPwdErr('New passwords do not match.'); return; }
    setSavingPwd(true);
    try {
      await changePassword(pwd.current, pwd.next);
      setPwdMsg('Password changed.');
      setPwd({ current: '', next: '', confirm: '' });
    } catch (err) {
      setPwdErr(err.response?.data?.message || 'Failed to change password');
    } finally {
      setSavingPwd(false);
    }
  };

  return (
    <div className="container-fluid px-4 py-4" style={{ maxWidth: 760, margin: '0 auto' }}>
      <h3 className="fw-bold mb-4">Profile Settings</h3>

      <div className="card mb-4 overflow-hidden">
        <div
          className="position-relative"
          style={{
            height: 160,
            background: user?.banner ? `url(${user.banner}) center/cover no-repeat` : 'var(--grad-btn)'
          }}
        >
          <label className="btn btn-sm btn-light position-absolute d-flex align-items-center gap-1" style={{ bottom: 10, right: 10 }}>
            {bannerBusy ? 'Uploading…' : <><i className="bi bi-image"></i>Change banner</>}
            <input type="file" accept=".jpg,.jpeg,.png" hidden disabled={bannerBusy}
              onChange={e => { pickPhoto(e.target.files?.[0], setBannerBusy, setBannerErr, uploadBanner); e.target.value = ''; }} />
          </label>
        </div>
        {bannerErr && <div className="alert alert-danger py-2 mb-0 rounded-0">{bannerErr}</div>}

        <div className="p-4">
          <div
            className="d-flex flex-column flex-sm-row align-items-center align-items-sm-end text-center text-sm-start gap-3 mb-4"
            style={{ marginTop: -70 }}
          >
            <BlobAvatar
              name={user?.name}
              src={user?.avatar}
              busy={avatarBusy}
              size={200}
              waveSpeed="slow"
              onFileSelected={(file) => pickPhoto(file, setAvatarBusy, setAvatarErr, uploadAvatar)}
            />
            <div className="pb-sm-2">
              <div className="fw-bold fs-5">{user?.name}</div>
              <div className="text-muted small">{user?.email || user?.phone}</div>
              {user?.userId && <div className="text-muted small">{user.userId}</div>}
            </div>
          </div>
          {avatarBusy && <div className="text-muted small mb-3">Uploading photo…</div>}
          {avatarErr && <div className="alert alert-danger py-2">{avatarErr}</div>}

          <h6 className="fw-semibold mb-3">Profile</h6>
          {profileErr && <div className="alert alert-danger py-2">{profileErr}</div>}
          {profileMsg && <div className="alert alert-success py-2">{profileMsg}</div>}
          <form onSubmit={saveProfile} className="row g-3 align-items-end">
            <div className="col-md-8">
              <label className="form-label small fw-semibold">Full name</label>
              <input className="form-control" value={name} onChange={e => setName(e.target.value)} required />
            </div>
            <div className="col-md-4">
              <button className="btn btn-gradient w-100" disabled={savingProfile}>
                {savingProfile ? 'Saving…' : 'Save Profile'}
              </button>
            </div>
          </form>
        </div>
      </div>

      <div className="card p-4 mb-4">
        <h6 className="fw-semibold mb-1">User ID</h6>
        <p className="text-muted small mb-3">
          A third way to log in with your password, alongside your email and phone number.
          {userIdLocked
            ? " You've used all 3 changes allowed on this account, so it's now locked."
            : ` You can change this ${userIdChangesRemaining} more time${userIdChangesRemaining === 1 ? '' : 's'} — after that it's locked for good.`}
        </p>
        {userIdErr && <div className="alert alert-danger py-2">{userIdErr}</div>}
        {userIdMsg && <div className="alert alert-success py-2">{userIdMsg}</div>}
        {userIdLocked ? (
          <div className="d-flex align-items-center gap-2">
            <span className="form-control bg-light" style={{ maxWidth: 300 }}>{user?.userId}</span>
            <span className="text-muted small"><i className="bi bi-lock-fill me-1"></i>Locked</span>
          </div>
        ) : (
          <form onSubmit={saveUserId} className="row g-3 align-items-end">
            <div className="col-md-8">
              <input className="form-control" value={userId} onChange={e => setUserId(e.target.value)}
                required minLength={3} maxLength={30} />
              {userIdAvailability === 'taken' && (
                <div className="small text-danger mt-1">That User ID is already taken.</div>
              )}
              {userIdAvailability === 'available' && (
                <div className="small text-success mt-1"><i className="bi bi-check-circle-fill me-1"></i>Available</div>
              )}
            </div>
            <div className="col-md-4">
              <button
                className="btn btn-gradient w-100"
                disabled={savingUserId || userIdAvailability === 'taken' || userId.trim().toLowerCase() === user?.userId}
              >
                {savingUserId ? 'Saving…' : 'Save User ID'}
              </button>
            </div>
          </form>
        )}
      </div>

      <div className="card p-4 mb-4">
        <h6 className="fw-semibold mb-3">{user?.hasPassword ? 'Change Password' : 'Set a Password'}</h6>
        {!user?.hasPassword && (
          <p className="text-muted small">
            Your account was created via one-time code and has no password yet. Set one below to also be able to log in with a password.
          </p>
        )}
        {pwdErr && <div className="alert alert-danger py-2">{pwdErr}</div>}
        {pwdMsg && <div className="alert alert-success py-2">{pwdMsg}</div>}
        <form onSubmit={savePassword} className="row g-3">
          {user?.hasPassword && (
            <div className="col-md-4">
              <label className="form-label small fw-semibold">Current password</label>
              <input type="password" className="form-control" value={pwd.current}
                onChange={e => setPwd({ ...pwd, current: e.target.value })} required />
            </div>
          )}
          <div className="col-md-4">
            <label className="form-label small fw-semibold">New password</label>
            <input type="password" className="form-control" value={pwd.next} minLength={6} maxLength={16}
              onChange={e => setPwd({ ...pwd, next: e.target.value })} required />
          </div>
          <div className="col-md-4">
            <label className="form-label small fw-semibold">Confirm new password</label>
            <input type="password" className="form-control" value={pwd.confirm} minLength={6} maxLength={16}
              onChange={e => setPwd({ ...pwd, confirm: e.target.value })} required />
          </div>
          <div className="col-12">
            <div className="form-text mt-0">{PASSWORD_RULES_TEXT}</div>
          </div>
          <div className="col-12">
            <button className="btn btn-gradient" disabled={savingPwd}>
              {savingPwd ? 'Saving…' : user?.hasPassword ? 'Update Password' : 'Set Password'}
            </button>
          </div>
        </form>
      </div>

      <div className="card p-4 mb-4">
        <h6 className="fw-semibold mb-3">Theme</h6>
        <div className="d-flex flex-wrap gap-2">
          {THEMES.map(t => (
            <button
              key={t.key}
              className={`btn ${theme === t.key ? 'btn-gradient' : 'btn-pill-outline'} d-flex align-items-center gap-2`}
              onClick={() => setTheme(t.key)}
            >
              <i className={`bi ${t.icon}`}></i>{t.label}
            </button>
          ))}
        </div>
      </div>

      {user?.role === 'Citizen' && (
        <div className="card p-4">
          <h6 className="fw-semibold mb-2">Help</h6>
          <p className="text-muted small mb-3">Want a refresher on how the site works?</p>
          <button className="btn btn-pill-outline" onClick={() => markTourSeen(false)}>
            <i className="bi bi-signpost-2-fill me-1"></i>Retake the welcome tour
          </button>
        </div>
      )}
    </div>
  );
}
