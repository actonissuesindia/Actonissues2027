import { useEffect, useId, useRef } from 'react';
import mountBlob from './blobEngine';
import '../../styles/blobAvatar.css';

function initialsFor(name = '') {
  return name.trim().split(/\s+/).map(p => p[0]).slice(0, 2).join('').toUpperCase() || '?';
}

// Wobble/rotation speed presets — 'medium' is the default pace; callers that
// expose a speed control (e.g. FoundersMessage.jsx's slow/medium/fast bar)
// pass waveSpeed through explicitly.
const SPEED = {
  slow: { maskDuration: [1.2, 2.2], bgDuration: [1.8, 2.4], gradientDur: '6s' },
  medium: { maskDuration: [0.5, 1.5], bgDuration: [1, 1.5], gradientDur: '3s' },
  fast: { maskDuration: [0.25, 0.7], bgDuration: [0.5, 0.75], gradientDur: '1.2s' }
};

// Animated wobbling-blob frame around the user's profile photo. The small
// camera icon at its edge opens the same photo upload flow the page
// already had (via onFileSelected) — it just replaces the old plain
// circular avatar. See blobEngine.js for how the blob shape itself
// animates; the decorative background blob's fill is a slowly-rotating
// multi-color gradient defined below (SVG's native <animateTransform>,
// no extra JS needed for that part).
export default function BlobAvatar({ src, name, onFileSelected, busy, size, editable = true, onRemove, placeholderIcon, waveSpeed = 'medium', shape = 'blob' }) {
  const maskPathRef = useRef(null);
  const bgPathRef = useRef(null);
  const imagesRef = useRef(null);
  const fileInputRef = useRef(null);
  const uid = useId().replace(/[^a-zA-Z0-9]/g, '');
  const maskId = `blob-mask-${uid}`;
  const gradId = `blob-grad-${uid}`;
  // clip-path: url(#id) on an HTML element (the photo <div> below) reads
  // the <clipPath>'s coordinates as literal CSS pixels of that element's
  // own box (userSpaceOnUse) — not auto-scaled to fit it the way an SVG
  // viewBox scales its own contents. The path math has to be generated in
  // the actual rendered size for the clip to line up, so everything below
  // is built from `s` (in CSS pixels) instead of a fixed 0–800 space.
  const s = size || 170;
  const speed = SPEED[waveSpeed] || SPEED.medium;
  const isRound = shape === 'round';

  useEffect(() => {
    if (isRound) return;
    const cleanups = [];
    if (maskPathRef.current) {
      cleanups.push(mountBlob({
        el: maskPathRef.current,
        segments: 9,
        centerX: s / 2,
        centerY: s / 2,
        minRadius: s * 0.375,
        maxRadius: s * 0.475,
        minDuration: speed.maskDuration[0],
        maxDuration: speed.maskDuration[1],
        maskEl: imagesRef.current,
        maskID: `#${maskId}`
      }));
    }
    if (bgPathRef.current) {
      cleanups.push(mountBlob({
        el: bgPathRef.current,
        segments: 9,
        centerX: s / 2,
        centerY: s / 2,
        minRadius: s * 0.4,
        maxRadius: s * 0.5,
        minDuration: speed.bgDuration[0],
        maxDuration: speed.bgDuration[1]
      }));
    }
    return () => cleanups.forEach(fn => fn && fn());
  }, [maskId, s, speed, isRound]);

  return (
    <div className="blob-avatar" style={size ? { '--blob-size': `${size}px` } : undefined}>
      {isRound && (
        <>
          <div className="blob-avatar-glow" aria-hidden="true"></div>
          <div className="blob-avatar-ring" aria-hidden="true"></div>
        </>
      )}
      {!isRound && (
        <svg viewBox={`0 0 ${s} ${s}`} aria-hidden="true">
          <defs>
            <clipPath id={maskId}>
              <path ref={maskPathRef} />
            </clipPath>
            <linearGradient id={gradId} gradientUnits="objectBoundingBox" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="#2d4a7a" />
              <stop offset="50%" stopColor="#3e8e7e" />
              <stop offset="100%" stopColor="#e08e45" />
              <animateTransform key={speed.gradientDur} attributeName="gradientTransform" type="rotate" from="0 0.5 0.5" to="360 0.5 0.5" dur={speed.gradientDur} repeatCount="indefinite" />
            </linearGradient>
          </defs>
          <path ref={bgPathRef} fill={`url(#${gradId})`} />
        </svg>
      )}
      <div
        className={isRound ? 'blob-avatar-images blob-avatar-round' : 'blob-avatar-images'}
        ref={imagesRef}
        style={isRound ? undefined : { clipPath: `url(#${maskId})`, WebkitClipPath: `url(#${maskId})` }}
      >
        {src
          ? <img src={src} alt={name || 'Profile photo'} />
          : placeholderIcon
            ? <i className={`bi ${placeholderIcon} blob-avatar-fallback-icon`}></i>
            : <div className="blob-avatar-fallback">{initialsFor(name)}</div>}
      </div>
      {editable && (
        <>
          <button
            type="button"
            className="blob-avatar-upload-btn"
            disabled={busy}
            title="Change photo"
            onClick={() => fileInputRef.current?.click()}
          >
            <i className={`bi ${busy ? 'bi-hourglass-split' : 'bi-camera-fill'}`}></i>
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".jpg,.jpeg,.png"
            hidden
            disabled={busy}
            onChange={(e) => {
              const file = e.target.files?.[0];
              e.target.value = '';
              if (file) onFileSelected(file);
            }}
          />
          {onRemove && src && (
            <button
              type="button"
              className="blob-avatar-remove-btn"
              disabled={busy}
              title="Remove photo"
              onClick={onRemove}
            >
              <i className="bi bi-trash3"></i>
            </button>
          )}
        </>
      )}
    </div>
  );
}
