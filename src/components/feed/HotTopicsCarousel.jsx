import { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { CATEGORY_ICONS, hueFor } from '../common/IssuePlaceholder';
import MzaCarousel from './mzaCarouselEngine';
import { isVideoAttachment } from '../../utils/attachmentType';
import '../../styles/carousel3d.css';

// A photo is the common case for a Hot Topic, but not guaranteed — falls
// back to the same category-derived gradient IssuePlaceholder uses
// elsewhere, so an unphotographed issue still gets a distinct, on-brand
// background instead of a blank card. Values only ever come from this
// app's own upload pipeline (Cloud Storage / local disk), but the quotes
// are still escaped since this string gets embedded directly into a CSS
// custom property.
//
// A video attachment can't be a CSS background-image (the browser just
// fails to paint it, leaving the card blank) — videos are rendered as a
// real <video> element instead (see mzaCard-video below), so this only
// ever needs to produce a photo URL or the gradient fallback.
function backgroundFor(issue) {
  const url = issue.attachments?.[0]?.url;
  if (url && !isVideoAttachment(issue.attachments[0])) return `url('${url.replace(/['\\]/g, '\\$&')}')`;
  const hue = hueFor(issue.category || 'Other');
  return `linear-gradient(135deg, hsl(${hue} 68% 38%), hsl(${(hue + 40) % 360} 60% 18%))`;
}

// The 3D layout wants a symmetric ring of cards around the active one —
// with fewer than this many real Hot Topics, it otherwise reads as a big
// empty gap on one side rather than a deliberate, filled-out spread.
// Padding out to this count by repeating existing issues (rendered faded,
// via data-duplicate below) keeps the layout looking intentional either way.
const MIN_SLIDES = 5;

export default function HotTopicsCarousel({ issues }) {
  const rootRef = useRef(null);
  const navigate = useNavigate();

  const displaySlides = issues && issues.length > 0
    ? Array.from({ length: Math.max(issues.length, MIN_SLIDES) }, (_, i) => ({
      issue: issues[i % issues.length],
      duplicate: i >= issues.length
    }))
    : [];

  useEffect(() => {
    if (!issues || issues.length === 0 || !rootRef.current) return undefined;
    const instance = new MzaCarousel(rootRef.current, {
      transitionMs: 900,
      // The original demo's rotateY/zDepth/activeLeftBias were tuned for
      // a hero view showing ~1 card at a time — at that strength, the
      // outer cards in a 5-wide row rotate up to ±68° and foreshorten
      // almost edge-on, visually shrinking well below their actual slot
      // width and reading as empty space rather than a filled row.
      rotateY: 14,
      zDepth: 60,
      scaleDrop: 0.05,
      activeLeftBias: 0,
      onCardTap: (card) => {
        const id = card.dataset.issueId;
        if (id) navigate(`/issues/${id}`);
      }
    });
    return () => instance.destroy();
  }, [issues, navigate]);

  if (!issues || issues.length === 0) return null;

  return (
    <section className="py-5 border-top">
      <div className="container-fluid px-4 px-lg-5">
        <div className="eyebrow mb-2"><i className="bi bi-fire me-1"></i>Trending right now</div>
        <h2 className="display-heading fs-2 mb-3">Trending Topics</h2>

        <div className="mzaCarousel" ref={rootRef} aria-roledescription="carousel" aria-label="Trending topics">
          <div className="mzaCarousel-viewport" tabIndex={0}>
            <div className="mzaCarousel-track">
              {displaySlides.map(({ issue, duplicate }, i) => (
                <article
                  className="mzaCarousel-slide"
                  role="group"
                  aria-roledescription="slide"
                  aria-label={`${i + 1} of ${displaySlides.length}`}
                  aria-hidden={duplicate || undefined}
                  data-duplicate={duplicate || undefined}
                  key={`${issue._id}-${i}`}
                >
                  <div
                    className="mzaCard"
                    style={{ '--mzaCard-bg': backgroundFor(issue) }}
                    data-issue-id={issue._id}
                  >
                    {issue.attachments?.[0]?.url && isVideoAttachment(issue.attachments[0]) && (
                      <video className="mzaCard-video" src={issue.attachments[0].url} muted loop autoPlay playsInline />
                    )}
                    <header className="mzaCard-head mzaPar-1">
                      <h3 className="mzaCard-title">{issue.title}</h3>
                      <p className="mzaCard-kicker">
                        <i className={`bi ${CATEGORY_ICONS[issue.category] || CATEGORY_ICONS.Other} me-1`}></i>{issue.category}
                      </p>
                    </header>
                    <p className="mzaCard-text mzaPar-2">{issue.description}</p>
                    <footer className="mzaCard-actions mzaPar-3">
                      <button
                        type="button"
                        className="mzaBtn"
                        onClick={(e) => { e.stopPropagation(); navigate(`/issues/${issue._id}`); }}
                      >
                        <i className="bi bi-box-arrow-up-right me-1"></i>View issue
                      </button>
                    </footer>
                  </div>
                </article>
              ))}
            </div>
          </div>

          <div className="mzaCarousel-controls" aria-label="Controls">
            <button className="mzaCarousel-prev" aria-label="Previous slide" type="button">‹</button>
            <button className="mzaCarousel-next" aria-label="Next slide" type="button">›</button>
          </div>

          <div className="mzaCarousel-pagination" role="tablist" aria-label="Slide navigation"></div>
          <div className="mzaCarousel-progress" aria-hidden="true"><span className="mzaCarousel-progressBar"></span></div>
        </div>
      </div>
    </section>
  );
}
