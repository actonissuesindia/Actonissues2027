// config: { height: number } (px)
export default function SpacerBlock({ config }) {
  return <div style={{ height: config.height || 0 }} aria-hidden="true"></div>;
}
