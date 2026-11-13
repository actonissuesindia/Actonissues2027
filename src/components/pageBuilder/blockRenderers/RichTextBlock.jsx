// config: { paragraphs: string[] } — plain strings only, one <p> per entry.
// Never rendered via dangerouslySetInnerHTML — this is a deliberate XSS-risk
// tradeoff (see the page builder plan) that rules out any HTML/markdown
// parsing here, not an oversight.
export default function RichTextBlock({ config }) {
  return (
    <>
      {(config.paragraphs || []).map((p, i) => (
        <p className="mb-3" key={i}>{p}</p>
      ))}
    </>
  );
}
