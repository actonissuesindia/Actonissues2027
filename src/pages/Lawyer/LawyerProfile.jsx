import { useEffect, useState } from 'react';
import api from '../../services/api';
import { useToast } from '../../context/ToastContext';

const SPECIALIZATION_OPTIONS = ['RTI', 'Criminal Case', 'Civil Case', 'Registration', 'Land Dispute', 'Mortgage/Sale', 'Other'];

export default function LawyerProfile() {
  const toast = useToast();
  const [role, setRole] = useState('Lawyer');
  const [isListed, setIsListed] = useState(true);
  const [accountName, setAccountName] = useState('');
  const [form, setForm] = useState({
    displayName: '', bio: '', specializations: [], contactPhone: '', contactEmail: '', upiId: '',
    bankDetails: { accountName: '', accountNumber: '', ifsc: '', bankName: '' }
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api.get('/lawyers/me').then(res => {
      const p = res.data.lawyerProfile || {};
      setRole(res.data.role);
      setAccountName(res.data.accountName || '');
      // Same default-by-role semantics as the backend directory query
      // (controllers/lawyerController.js) — unset means listed for
      // Lawyer, not listed for Admin.
      setIsListed(res.data.role === 'Admin' ? p.isListed === true : p.isListed !== false);
      setForm({
        displayName: p.displayName || '',
        bio: p.bio || '',
        specializations: p.specializations || [],
        contactPhone: p.contactPhone || '',
        contactEmail: p.contactEmail || '',
        upiId: p.upiId || '',
        bankDetails: {
          accountName: p.bankDetails?.accountName || '',
          accountNumber: p.bankDetails?.accountNumber || '',
          ifsc: p.bankDetails?.ifsc || '',
          bankName: p.bankDetails?.bankName || ''
        }
      });
    }).catch(() => {}).finally(() => setLoading(false));
  }, []);

  const toggleSpecialization = (s) => {
    setForm(f => ({
      ...f,
      specializations: f.specializations.includes(s)
        ? f.specializations.filter(x => x !== s)
        : [...f.specializations, s]
    }));
  };

  const save = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await api.patch('/lawyers/me', { ...form, isListed });
      toast('Profile saved', 'success');
    } catch (err) {
      toast(err.response?.data?.message || 'Something went wrong', 'error');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="container-fluid px-4 py-4">Loading…</div>;

  return (
    <div className="container-fluid px-4 py-4" style={{ maxWidth: 640 }}>
      <h3 className="fw-bold mb-3">My Lawyer Profile</h3>

      <div className="card p-3 mb-4 bg-light">
        <div className="form-check form-switch">
          <input className="form-check-input" type="checkbox" role="switch" id="isListed"
            checked={isListed} onChange={e => setIsListed(e.target.checked)} />
          <label className="form-check-label fw-semibold" htmlFor="isListed">
            Show my profile on "Find a Lawyer"
          </label>
        </div>
        <p className="text-muted small mb-0 mt-1">
          {role === 'Admin'
            ? (isListed
              ? 'Your Super Admin account is currently listed as a lawyer — citizens see only the details you fill in below (name, bio, specializations, contact), never your admin role.'
              : 'Off: you\'re just the Super Admin, not shown on the directory. Turn this on to also appear as a lawyer citizens can request help from, using your own details below.')
            : (isListed
              ? 'You\'re currently listed and can receive requests. Turn this off to pause your availability at any time.'
              : 'You\'re currently hidden from the directory. Turn this on to start receiving requests again.')}
        </p>
      </div>

      <p className="text-muted small mb-4">
        This bio, your specializations, and your contact details are shown publicly on the "Find a Lawyer" directory.
        Your UPI ID and bank details are never shown there — they're only shared with a citizen once you've quoted a
        fee on their specific request.
      </p>

      <form onSubmit={save}>
        <div className="mb-3">
          <label className="form-label">Display name</label>
          <input className="form-control" value={form.displayName} onChange={e => setForm(f => ({ ...f, displayName: e.target.value }))}
            placeholder={accountName ? `Leave blank to show "${accountName}"` : 'e.g. Adv. Priya Sharma'} />
          <div className="form-text">
            This is the name citizens see everywhere — the directory, requests, and payment details — instead of
            your account name{accountName ? ` ("${accountName}")` : ''}. Use this to keep your account identity
            separate from your public lawyer identity.
          </div>
        </div>

        <div className="mb-3">
          <label className="form-label">Bio</label>
          <textarea className="form-control" rows={3} value={form.bio} onChange={e => setForm(f => ({ ...f, bio: e.target.value }))}
            placeholder="A short introduction citizens will see on your profile" />
        </div>

        <div className="mb-3">
          <label className="form-label">Specializations</label>
          <div className="d-flex flex-wrap gap-2">
            {SPECIALIZATION_OPTIONS.map(s => (
              <button type="button" key={s}
                className={`btn btn-sm ${form.specializations.includes(s) ? 'btn-gradient' : 'btn-outline-secondary'}`}
                onClick={() => toggleSpecialization(s)}>
                {s}
              </button>
            ))}
          </div>
        </div>

        <div className="row">
          <div className="col-md-6 mb-3">
            <label className="form-label">Contact phone (public)</label>
            <input className="form-control" value={form.contactPhone} onChange={e => setForm(f => ({ ...f, contactPhone: e.target.value }))} />
          </div>
          <div className="col-md-6 mb-3">
            <label className="form-label">Contact email (public)</label>
            <input className="form-control" type="email" value={form.contactEmail} onChange={e => setForm(f => ({ ...f, contactEmail: e.target.value }))} />
          </div>
        </div>

        <hr className="my-4" />
        <h5 className="fw-semibold mb-2">Payment details (private)</h5>
        <p className="text-muted small mb-3">Only shown to a citizen once you've quoted a fee on their request.</p>

        <div className="mb-3">
          <label className="form-label">UPI ID</label>
          <input className="form-control" value={form.upiId} onChange={e => setForm(f => ({ ...f, upiId: e.target.value }))}
            placeholder="e.g. yourname@okhdfcbank" />
        </div>

        <div className="row">
          <div className="col-md-6 mb-3">
            <label className="form-label">Account holder name</label>
            <input className="form-control" value={form.bankDetails.accountName}
              onChange={e => setForm(f => ({ ...f, bankDetails: { ...f.bankDetails, accountName: e.target.value } }))} />
          </div>
          <div className="col-md-6 mb-3">
            <label className="form-label">Account number</label>
            <input className="form-control" value={form.bankDetails.accountNumber}
              onChange={e => setForm(f => ({ ...f, bankDetails: { ...f.bankDetails, accountNumber: e.target.value } }))} />
          </div>
          <div className="col-md-6 mb-3">
            <label className="form-label">IFSC</label>
            <input className="form-control" value={form.bankDetails.ifsc}
              onChange={e => setForm(f => ({ ...f, bankDetails: { ...f.bankDetails, ifsc: e.target.value } }))} />
          </div>
          <div className="col-md-6 mb-3">
            <label className="form-label">Bank name</label>
            <input className="form-control" value={form.bankDetails.bankName}
              onChange={e => setForm(f => ({ ...f, bankDetails: { ...f.bankDetails, bankName: e.target.value } }))} />
          </div>
        </div>

        <button type="submit" className="btn btn-gradient" disabled={saving}>{saving ? 'Saving…' : 'Save Profile'}</button>
      </form>
    </div>
  );
}
