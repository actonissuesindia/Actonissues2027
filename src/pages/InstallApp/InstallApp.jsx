import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import QRCode from 'qrcode';
import logoIcon from '../../assets/logo/aoi-logo.png';
import usePageTitle from '../../hooks/usePageTitle';
import { useToast } from '../../context/ToastContext';

// A standalone, public, unauthenticated help page for the one question that
// keeps coming up over WhatsApp: "how do I get this app?" There's no real
// APK — what people install is a PWA shortcut (see public/manifest.webmanifest),
// so the answer is "open this link and add it to your home screen," not a
// file to send. This page exists so that sentence has somewhere to point to,
// plus a QR code and a ready-made WhatsApp message for forwarding it.
export default function InstallApp() {
  usePageTitle('Install the App');
  const toast = useToast();
  const [qrDataUrl, setQrDataUrl] = useState(null);
  const url = typeof window !== 'undefined' ? window.location.origin : '';

  useEffect(() => {
    if (!url) return;
    QRCode.toDataURL(url, { width: 220, margin: 1, color: { dark: '#0F172A', light: '#FFFFFF' } })
      .then(setQrDataUrl)
      .catch(() => setQrDataUrl(null));
  }, [url]);

  const copyLink = async () => {
    await navigator.clipboard.writeText(url);
    toast('Link copied');
  };

  const shareOnWhatsApp = () => {
    const text = `Install the Act On Issues app: open this link and tap "Add to Home screen" (Android) or "Add to Home Screen" from the Share menu (iPhone).\n\n${url}`;
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank', 'noopener,noreferrer');
  };

  return (
    <div className="container-fluid px-4 py-4">
      <div className="mx-auto" style={{ maxWidth: 720 }}>
        <Link to="/" className="d-inline-flex align-items-center gap-1 fw-semibold text-decoration-none text-dark mb-3">
          <i className="bi bi-arrow-left"></i>Back to home
        </Link>
        <div className="card p-4 p-md-5">
          <div className="d-flex align-items-center gap-2 mb-2">
            <img src={logoIcon} alt="Act On Issues" style={{ height: 36 }} />
            <h3 className="fw-bold mb-0">Install Act On Issues</h3>
          </div>
          <p className="text-muted">
            There's no separate app-store download — open this page's link in your phone's browser
            and add it to your home screen. It then opens just like a regular app, with its own icon
            and no browser address bar.
          </p>

          <div className="border rounded-4 p-3 d-flex flex-wrap align-items-center gap-3 my-4">
            {qrDataUrl
              ? <img src={qrDataUrl} alt="QR code linking to Act On Issues" width={140} height={140} style={{ borderRadius: 8, flexShrink: 0 }} />
              : <div style={{ width: 140, height: 140, flexShrink: 0 }} className="skeleton-shimmer rounded-3" />}
            <div>
              <p className="small text-muted mb-2">
                Scan this with your phone's camera, or share this page's link directly.
              </p>
              <div className="d-flex flex-wrap gap-2">
                <button type="button" className="btn btn-sm btn-gradient" onClick={shareOnWhatsApp}>
                  <i className="bi bi-whatsapp me-1"></i>Share on WhatsApp
                </button>
                <button type="button" className="btn btn-sm btn-pill-outline" onClick={copyLink}>
                  <i className="bi bi-link-45deg me-1"></i>Copy link
                </button>
              </div>
            </div>
          </div>

          <h5 className="fw-semibold mt-4">On Android (Chrome)</h5>
          <ol className="mb-4">
            <li>Open this link in Chrome.</li>
            <li>Tap the <strong>⋮</strong> (three dots) menu in the top right.</li>
            <li>Tap <strong>"Add to Home screen"</strong> (or <strong>"Install app"</strong>).</li>
            <li>Confirm — the Act On Issues icon appears on your home screen.</li>
          </ol>

          <h5 className="fw-semibold">On iPhone (Safari)</h5>
          <ol className="mb-0">
            <li>Open this link in Safari (not Chrome — this only works from Safari on iPhone).</li>
            <li>Tap the <strong>Share</strong> icon (square with an arrow pointing up) at the bottom of the screen.</li>
            <li>Scroll down and tap <strong>"Add to Home Screen"</strong>.</li>
            <li>Tap <strong>"Add"</strong> — the icon appears on your home screen.</li>
          </ol>
        </div>
      </div>
    </div>
  );
}
