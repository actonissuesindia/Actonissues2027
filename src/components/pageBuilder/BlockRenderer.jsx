import HeadingBlock from './blockRenderers/HeadingBlock';
import RichTextBlock from './blockRenderers/RichTextBlock';
import ImageBlock from './blockRenderers/ImageBlock';
import ButtonBlock from './blockRenderers/ButtonBlock';
import CardGridBlock from './blockRenderers/CardGridBlock';
import SpacerBlock from './blockRenderers/SpacerBlock';

// Tier-1 (freeform) block types only — Footer/TopNav 'link' blocks and
// Feed's 'toggle' blocks are consumed directly by their own components
// (Footer.jsx, NavLinks.jsx, Feed.jsx), not through this generic renderer.
const BLOCK_RENDERERS = {
  heading: HeadingBlock,
  richtext: RichTextBlock,
  image: ImageBlock,
  button: ButtonBlock,
  cardgrid: CardGridBlock,
  spacer: SpacerBlock
};

export default function BlockRenderer({ block }) {
  const Cmp = BLOCK_RENDERERS[block.type];
  return Cmp ? <Cmp config={block.config} /> : null;
}

// Renders a region's full block list, grouping consecutive 'button' blocks
// into one flex row instead of letting each stack on its own line — matches
// how every migrated hero/CTA originally laid out its 1-2 buttons side by
// side. Pages call this instead of a raw blocks.map(...) once they're
// rendering a fetched block list.
export function renderBlockList(blocks) {
  const nodes = [];
  let buttonGroup = null;
  for (const block of blocks) {
    if (block.type === 'button') {
      if (!buttonGroup) {
        buttonGroup = [];
        nodes.push(<div className="d-flex flex-wrap justify-content-center gap-3" key={`btns-${block._id}`}>{buttonGroup}</div>);
      }
      buttonGroup.push(<BlockRenderer key={block._id} block={block} />);
    } else {
      buttonGroup = null;
      nodes.push(<BlockRenderer key={block._id} block={block} />);
    }
  }
  return nodes;
}
