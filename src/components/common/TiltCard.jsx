import useTilt from '../../hooks/useTilt';

// Wraps any card so it gets the 3D cursor-tilt + glare hover effect from
// useTilt. A component (not just calling the hook inline) because most
// cards are rendered inside .map() lists, where hooks can't be called
// per-item directly. `as` picks the rendered tag/component (div, button,
// react-router Link, ...) so this works for clickable and static cards alike.
export default function TiltCard({ as: Tag = 'div', maxDeg, className = '', children, ...rest }) {
  const tiltRef = useTilt(maxDeg);
  return (
    <Tag ref={tiltRef} className={`tilt-3d ${className}`} {...rest}>
      {children}
    </Tag>
  );
}
