import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import api from '../../services/api';

const LEGAL_DISCLAIMER = 'This form provides general assistance in requesting help from a lawyer and does not constitute legal advice. Procedures vary by state — consult a local lawyer or the relevant authority for guidance specific to your situation.';

export default function FileRTIRequest() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const preselectedLawyer = searchParams.get('lawyer') || '';
  const preselectedType = searchParams.get('type') || 'RTI';

  const [requestTypes, setRequestTypes] = useState(['RTI']);
  const [states, setStates] = useState([]);
  const [lawyer, setLawyer] = useState(null);
  const [form, setForm] = useState({
    requestType: preselectedType,
    subject: '',
    description: '',
    publicAuthority: '',
    jurisdiction: 'State',
    state: '',
    applicantAddress: ''
  });
  const [files, setFiles] = useState([]);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    api.get('/rti-requests/meta').then(res => {
      setStates(res.data.states || []);
      setRequestTypes(res.data.requestTypes || ['RTI']);
    }).catch(() => {});
    if (preselectedLawyer) {
      api.get(`/lawyers/${preselectedLawyer}`).then(res => setLawyer(res.data.lawyer)).catch(() => {});
    }
  }, [preselectedLawyer]);

  const update = (field) => (e) => setForm(f => ({ ...f, [field]: e.target.value }));
  const isRTI = form.requestType === 'RTI';

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    if (isRTI && form.jurisdiction === 'State' && !form.state) {
      setError('Please select a state.');
      return;
    }
    setSubmitting(true);
    try {
      const payload = { ...form, lawyer: preselectedLawyer || undefined };
      const res = await api.post('/rti-requests', payload);
      const request = res.data.request;
      if (files.length) {
        const data = new FormData();
        files.forEach(f => data.append('attachments', f));
        await api.post(`/rti-requests/${request._id}/attachments`, data, {
          headers: { 'Content-Type': 'multipart/form-data' }
        });
      }
      navigate(`/rti/${request._id}`);
    } catch (err) {
      setError(err.response?.data?.message || 'Something went wrong. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="container-fluid px-4 py-4" style={{ maxWidth: 720 }}>
      <h3 className="fw-bold mb-3">Request Legal Advice</h3>
      {lawyer && (
        <div className="alert alert-secondary small">
          This request will go directly to <strong>{lawyer.name}</strong>.
        </div>
      )}
      <div className="alert alert-secondary small">{LEGAL_DISCLAIMER}</div>

      <form onSubmit={submit}>
        <div className="mb-3">
          <label className="form-label">What kind of help do you need?</label>
          <select className="form-select" value={form.requestType} onChange={update('requestType')}>
            {requestTypes.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
        </div>

        <div className="mb-3">
          <label className="form-label">Subject</label>
          <input className="form-control" required value={form.subject} onChange={update('subject')}
            placeholder={isRTI ? 'e.g. Status of road repair funds sanctioned for my ward' : 'A short summary of your matter'} />
        </div>

        {isRTI && (
          <div className="mb-3">
            <label className="form-label">Public authority / department</label>
            <input className="form-control" required={isRTI} value={form.publicAuthority} onChange={update('publicAuthority')}
              placeholder="e.g. Municipal Corporation, Public Works Department" />
          </div>
        )}

        {isRTI && (
          <div className="mb-3">
            <label className="form-label">Jurisdiction</label>
            <div className="d-flex gap-3">
              <div className="form-check">
                <input className="form-check-input" type="radio" id="jur-central" checked={form.jurisdiction === 'Central'}
                  onChange={() => setForm(f => ({ ...f, jurisdiction: 'Central' }))} />
                <label className="form-check-label" htmlFor="jur-central">Central Government</label>
              </div>
              <div className="form-check">
                <input className="form-check-input" type="radio" id="jur-state" checked={form.jurisdiction === 'State'}
                  onChange={() => setForm(f => ({ ...f, jurisdiction: 'State' }))} />
                <label className="form-check-label" htmlFor="jur-state">State Government</label>
              </div>
            </div>
          </div>
        )}

        {isRTI && form.jurisdiction === 'State' && (
          <div className="mb-3">
            <label className="form-label">State</label>
            <select className="form-select" required value={form.state} onChange={update('state')}>
              <option value="">Select a state</option>
              {states.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
        )}

        <div className="mb-3">
          <label className="form-label">{isRTI ? 'What information are you seeking?' : 'Describe your matter'}</label>
          <textarea className="form-control" rows={4} required value={form.description} onChange={update('description')}
            placeholder={isRTI ? 'Describe, in as much detail as possible, exactly what information/records you want.' : 'Give as much detail as you can — what happened, who is involved, and what help you need.'} />
        </div>

        {isRTI && (
          <div className="mb-3">
            <label className="form-label">Your postal address</label>
            <textarea className="form-control" rows={2} required={isRTI} value={form.applicantAddress} onChange={update('applicantAddress')}
              placeholder="Required on every RTI application, as per the RTI Act 2005" />
          </div>
        )}

        <div className="mb-3">
          <label className="form-label">Supporting documents (optional)</label>
          <input className="form-control" type="file" multiple onChange={e => setFiles(Array.from(e.target.files))} />
        </div>

        {error && <div className="alert alert-danger small">{error}</div>}

        <button type="submit" className="btn btn-gradient" disabled={submitting}>
          {submitting ? 'Submitting…' : 'Submit Request'}
        </button>
      </form>
    </div>
  );
}
