import { Link } from 'react-router-dom';

// config: { text, href, style?: 'gradient'|'outline'|'light', external?: boolean }
const STYLE_CLASS = {
  gradient: 'btn btn-gradient rounded-pill px-4 py-2',
  outline: 'btn btn-pill-outline px-4 py-2',
  light: 'btn btn-light fw-bold rounded-pill px-4 py-2'
};

export default function ButtonBlock({ config }) {
  const className = STYLE_CLASS[config.style] || STYLE_CLASS.gradient;
  if (config.external || /^https?:\/\//.test(config.href)) {
    return <a href={config.href} className={className} target="_blank" rel="noopener noreferrer">{config.text}</a>;
  }
  return <Link to={config.href} className={className}>{config.text}</Link>;
}
