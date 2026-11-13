const SIZES = { sm: 32, md: 40, lg: 56, xl: 72 };

function initials(name = '') {
  return name.trim().split(/\s+/).map(p => p[0]).slice(0, 2).join('').toUpperCase() || '?';
}

export default function Avatar({ name, src, size = 'md', fontSize }) {
  const px = SIZES[size] || size;
  return (
    <span className="avatar-ring" style={{ width: px, height: px }}>
      {src ? (
        <img src={src} alt={name || 'Avatar'} className="avatar-ring-inner" style={{ objectFit: 'cover', width: '100%', height: '100%' }} />
      ) : (
        <span className="avatar-ring-inner" style={{ fontSize: fontSize || px * 0.38 }}>
          {initials(name)}
        </span>
      )}
    </span>
  );
}
