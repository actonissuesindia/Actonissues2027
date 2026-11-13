import gsap from 'gsap';

// Ported from a CodePen demo ("SupahBlob"): animates an SVG <path>'s `d`
// attribute into a continuously wobbling organic blob by tweening a ring
// of points (each independently oscillating between an inner and outer
// radius) and rebuilding a smooth closed Catmull-Rom-style curve through
// them every frame. When maskEl/maskID are given, the element's clip-path
// is force-reapplied each frame too — clip-path doesn't otherwise notice
// that the referenced <path> it points to has changed shape.
//
// Returns a destroy() function rather than a class instance, since the
// only thing a caller needs afterward is to stop the (otherwise infinite,
// repeat: -1) GSAP timeline on unmount.
export default function mountBlob(obj) {
  if (!obj.el) return undefined;

  const segments = obj.segments || 8;
  const centerX = obj.centerX || 400;
  const centerY = obj.centerY || 400;
  const minRadius = obj.minRadius || 300;
  const maxRadius = obj.maxRadius || 380;
  const minDuration = obj.minDuration || 1;
  const maxDuration = obj.maxDuration || 2;
  const maskEl = obj.maskEl || null;
  const maskID = obj.maskID || null;

  const points = [];

  const createPath = () => {
    const data = points;
    const size = points.length;
    let path = `M${data[0].x} ${data[0].y} C`;
    for (let i = 0; i < size; i++) {
      const p0 = data[(i - 1 + size) % size];
      const p1 = data[i];
      const p2 = data[(i + 1) % size];
      const p3 = data[(i + 2) % size];
      const x1 = p1.x + (p2.x - p0.x) * 0.15;
      const y1 = p1.y + (p2.y - p0.y) * 0.15;
      const x2 = p2.x - (p3.x - p1.x) * 0.15;
      const y2 = p2.y - (p3.y - p1.y) * 0.15;
      path += ` ${x1} ${y1} ${x2} ${y2} ${p2.x} ${p2.y}`;
    }
    return `${path}z`;
  };

  const update = () => {
    obj.el.setAttribute('d', createPath());
    if (maskEl) {
      maskEl.style.clipPath = 'none';
      maskEl.style.webkitClipPath = 'none';
      void maskEl.offsetWidth;
      maskEl.style.clipPath = `url("${maskID}")`;
      maskEl.style.webkitClipPath = `url("${maskID}")`;
    }
  };

  const slice = (Math.PI * 2) / segments;
  const tl = gsap.timeline({ onUpdate: update });

  for (let i = 0; i < segments; i++) {
    const angle = slice * i;
    const duration = gsap.utils.random(minDuration, maxDuration);
    const p = {
      x: centerX + Math.cos(angle) * minRadius,
      y: centerY + Math.sin(angle) * minRadius
    };
    const tween = gsap.to(p, {
      duration,
      x: centerX + Math.cos(angle) * maxRadius,
      y: centerY + Math.sin(angle) * maxRadius,
      ease: 'sine.inOut',
      repeat: -1,
      yoyo: true
    });
    tl.add(tween, -duration);
    points.push(p);
  }

  return () => tl.kill();
}
