// config: { eyebrow?: string, text: string, level: 'h1'|'h2' }
export default function HeadingBlock({ config }) {
  const Tag = config.level === 'h1' ? 'h1' : 'h2';
  return (
    <>
      {config.eyebrow && <div className="eyebrow mb-2">{config.eyebrow}</div>}
      <Tag className={`display-heading ${config.level === 'h1' ? 'fs-1' : 'fs-2'} mb-4`}>{config.text}</Tag>
    </>
  );
}
