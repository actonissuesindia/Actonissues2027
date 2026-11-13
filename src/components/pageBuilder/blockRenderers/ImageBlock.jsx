// config: { url, alt?, shape?: 'round'|'square', size?: number (px) }
export default function ImageBlock({ config }) {
  const size = config.size || 200;
  return (
    <img
      src={config.url}
      alt={config.alt || ''}
      style={{
        width: size,
        height: size,
        objectFit: 'cover',
        borderRadius: config.shape === 'round' ? '50%' : '1rem'
      }}
    />
  );
}
