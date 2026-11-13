import { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import QRCode from 'qrcode';
import api from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { RTIStatusBadge } from '../../components/common/StatusBadge';
import timeAgo from '../../utils/timeAgo';

export default function RTIRequestDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [request, setRequest] = useState(null);
  const [paymentDetails, setPaymentDetails] = useState(null);
  const [qrDataUrl, setQrDataUrl] = useState('');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [rejectReason, setRejectReason] = useState('');
  const [showReject, setShowReject] = useState(false);

  const load = () => {
    api.get(`/rti-requests/${id}`)
      .then(res => { setRequest(res.data.request); setPaymentDetails(res.data.paymentDetails); })
      .catch(() => setRequest(null))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, [id]);

  useEffect(() => {
    if (paymentDetails?.upiId && request) {
      const amount = request.isFree ? '' : `&am=${request.quotedFee}`;
      const upiLink = `upi://pay?pa=${encodeURIComponent(paymentDetails.upiId)}&pn=${encodeURIComponent(paymentDetails.payeeName)}${amount}&cu=INR&tn=${encodeURIComponent(request.requestNumber)}`;
      QRCode.toDataURL(upiLink).then(setQrDataUrl).catch(() => setQrDataUrl(''));
    }
  }, [paymentDetails, request]);

  const isOwner = request && user && String(request.citizen?._id || request.citizen) === String(user._id);

  const decide = async (accept) => {
    setBusy(true);
    setError('');
    try {
      await api.post(`/rti-requests/${id}/decision`, { accept, reason: rejectReason });
      setShowReject(false);
      load();
    } catch (err) {
      setError(err.response?.data?.message || 'Something went wrong.');
    } finally {
      setBusy(false);
    }
  };

  const cancel = async () => {
    if (!window.confirm('Withdraw this request?')) return;
    setBusy(true);
    try {
      await api.post(`/rti-requests/${id}/cancel`);
      load();
    } catch (err) {
      setError(err.response?.data?.message || 'Something went wrong.');
    } finally {
      setBusy(false);
    }
  };

  if (loading) return <div className="container-fluid px-4 py-4">Loading…</div>;
  if (!request) return <div className="container-fluid px-4 py-4">Request not found.</div>;

  return (
    <div className="container-fluid px-4 py-4" style={{ maxWidth: 720 }}>
      <button className="btn btn-link px-0 mb-3" onClick={() => navigate(-1)}>
        <i className="bi bi-arrow-left me-1"></i>Back
      </button>

      <div className="card p-4">
        <div className="d-flex justify-content-between align-items-start mb-2">
          <span className="text-muted small">{request.requestNumber} · {request.requestType}</span>
          <RTIStatusBadge status={request.status} />
        </div>
        <h4 className="fw-bold mb-1">{request.subject}</h4>
        {request.publicAuthority && (
          <div className="text-muted small mb-3">{request.publicAuthority}{request.jurisdiction ? ` · ${request.jurisdiction}${request.state ? ` (${request.state})` : ''}` : ''}</div>
        )}

        <p className="mb-3">{request.description}</p>

        {request.quotedFee != null && (
          <div className="alert alert-info small">
            {request.isFree ? 'This lawyer will handle your request free of charge.' : `Quoted fee: ₹${request.quotedFee}`}
            {request.quoteNote && <div className="mt-1">{request.quoteNote}</div>}
          </div>
        )}

        {paymentDetails && !request.isFree && ['Accepted', 'Filed', 'Resolved'].includes(request.status) && (
          <div className="card p-3 mb-3 bg-light">
            <div className="fw-semibold small mb-2">Pay {paymentDetails.payeeName}</div>
            {qrDataUrl && <img src={qrDataUrl} alt="UPI QR code" style={{ width: 160, height: 160 }} className="mb-2" />}
            {paymentDetails.upiId && <div className="small">UPI ID: <strong>{paymentDetails.upiId}</strong></div>}
            {paymentDetails.bankDetails?.accountNumber && (
              <div className="small mt-1">
                <div>Account name: {paymentDetails.bankDetails.accountName}</div>
                <div>Account number: {paymentDetails.bankDetails.accountNumber}</div>
                <div>IFSC: {paymentDetails.bankDetails.ifsc}</div>
                <div>Bank: {paymentDetails.bankDetails.bankName}</div>
              </div>
            )}
            <div className="text-muted small mt-2">Payment happens directly between you and the lawyer — Act On Issues does not process this payment.</div>
          </div>
        )}

        {request.status === 'Filed' && request.filedReferenceNumber && (
          <div className="alert alert-secondary small">Filed — reference number: {request.filedReferenceNumber}</div>
        )}

        {request.status === 'Resolved' && (
          <div className="alert alert-success small">
            {request.responseSummary}
            {request.responseAttachments?.length > 0 && (
              <div className="mt-2 d-flex flex-column gap-1">
                {request.responseAttachments.map(a => (
                  <a key={a._id} href={a.url} target="_blank" rel="noreferrer">{a.originalName || 'View response'}</a>
                ))}
              </div>
            )}
          </div>
        )}

        {request.rejectionReason && (
          <div className="alert alert-warning small">Reason: {request.rejectionReason}</div>
        )}

        {error && <div className="alert alert-danger small">{error}</div>}

        {isOwner && request.status === 'Fee Quoted' && (
          <div className="d-flex gap-2 mt-2">
            <button className="btn btn-gradient" disabled={busy} onClick={() => decide(true)}>Accept</button>
            <button className="btn btn-outline-danger" disabled={busy} onClick={() => setShowReject(true)}>Decline</button>
          </div>
        )}
        {isOwner && showReject && (
          <div className="mt-2">
            <textarea className="form-control mb-2" placeholder="Reason (optional)" value={rejectReason}
              onChange={e => setRejectReason(e.target.value)} />
            <button className="btn btn-outline-danger btn-sm" disabled={busy} onClick={() => decide(false)}>Confirm decline</button>
          </div>
        )}
        {isOwner && ['Submitted', 'Fee Quoted'].includes(request.status) && (
          <button className="btn btn-outline-secondary mt-3" disabled={busy} onClick={cancel}>Withdraw request</button>
        )}

        {request.attachments?.length > 0 && (
          <div className="mt-4">
            <div className="fw-semibold small mb-1">Your supporting documents</div>
            <div className="d-flex flex-column gap-1">
              {request.attachments.map(a => (
                <a key={a._id} href={a.url} target="_blank" rel="noreferrer" className="small">{a.originalName || 'Attachment'}</a>
              ))}
            </div>
          </div>
        )}

        {request.workNotes?.length > 0 && (
          <div className="mt-4">
            <div className="fw-semibold small mb-2">Updates from your lawyer</div>
            <div className="d-flex flex-column gap-2">
              {request.workNotes.map((n, i) => (
                <div key={n._id || i} className="border-start ps-3">
                  <div className="small">{n.note}</div>
                  <div className="text-muted small">{n.author?.name || 'Lawyer'} · {timeAgo(n.createdAt)}</div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      <Link to="/rti/mine" className="btn btn-link px-0 mt-3">Back to my requests</Link>
    </div>
  );
}
