import useInView from '../../hooks/useInView';

export default function Reveal({ children, className = '', id }) {
  const [ref, inView] = useInView();
  return (
    <div ref={ref} id={id} className={`reveal ${inView ? 'reveal-visible' : ''} ${className}`}>
      {children}
    </div>
  );
}
