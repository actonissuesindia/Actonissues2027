import TiltCard from '../../common/TiltCard';

// config: { heading?, colClass, items: [{icon?, title, text}] }
// `colClass` is admin-set (e.g. "col-md-3", "col-6 col-md-4 col-lg-2")
// because different sections use different Bootstrap breakpoints, and a
// :has()-based hover-dim rule in src/styles/app.css requires this to render
// inside a literal .row/.col-* structure — not an arbitrary flex/grid layout.
export default function CardGridBlock({ config }) {
  return (
    <>
      {config.heading && <h2 className="display-heading fs-2 mb-4">{config.heading}</h2>}
      <div className="row g-3">
        {(config.items || []).map((item, i) => (
          <div className={config.colClass} key={i}>
            <TiltCard className="card card-embossed rotating-glow p-3 h-100">
              {item.icon && <span className="step-icon mb-3"><i className={`bi ${item.icon}`}></i></span>}
              <div className="fw-bold mb-1">{item.title}</div>
              <div className="text-muted small">{item.text}</div>
            </TiltCard>
          </div>
        ))}
      </div>
    </>
  );
}
