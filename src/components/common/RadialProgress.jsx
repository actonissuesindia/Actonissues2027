export default function RadialProgress({ percent, size = 84, stroke = 9, color = 'var(--grad-a)' }) {
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (Math.max(0, Math.min(100, percent)) / 100) * circumference;
  const center = size / 2;
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="radial-progress">
      <circle cx={center} cy={center} r={radius} fill="none" stroke="#eceef2" strokeWidth={stroke} />
      <circle
        cx={center} cy={center} r={radius} fill="none" stroke={color} strokeWidth={stroke}
        strokeDasharray={circumference} strokeDashoffset={offset} strokeLinecap="round"
        transform={`rotate(-90 ${center} ${center})`}
        className="radial-progress-arc"
      />
      <text x="50%" y="50%" textAnchor="middle" dy="0.32em" fontSize={size * 0.24} fontWeight="800" fill="var(--ink)">
        {Math.round(percent)}%
      </text>
    </svg>
  );
}
