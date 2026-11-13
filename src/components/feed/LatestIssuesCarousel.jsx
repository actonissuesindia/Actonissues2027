import { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import IssuePlaceholder from '../common/IssuePlaceholder';
import mountDragCarousel from './dragCarouselEngine';
import { isVideoAttachment } from '../../utils/attachmentType';
import '../../styles/dragCarousel.css';

export default function LatestIssuesCarousel({ issues }) {
  const rootRef = useRef(null);
  const navigate = useNavigate();

  useEffect(() => {
    if (!issues || issues.length === 0 || !rootRef.current) return undefined;
    return mountDragCarousel(rootRef.current, {
      onItemClick: (issueId) => { if (issueId) navigate(`/issues/${issueId}`); }
    });
  }, [issues, navigate]);

  if (!issues || issues.length === 0) return null;

  return (
    <div className="dragcar" ref={rootRef}>
      <div className="dragcar__wrapper">
        {issues.map(issue => (
          <div className="dragcar__item" key={issue._id} data-issue-id={issue._id}>
            <div className="dragcar__figure">
              {issue.attachments?.[0]?.url
                ? (isVideoAttachment(issue.attachments[0])
                  ? (
                    <>
                      <video src={issue.attachments[0].url} preload="metadata" muted playsInline />
                      <i className="bi bi-play-circle-fill dragcar__play"></i>
                    </>
                  )
                  : <img src={issue.attachments[0].url} alt="" draggable={false} />)
                : <IssuePlaceholder category={issue.category} />}
              <div className="dragcar__overlay">
                <span className="dragcar__category">{issue.category}</span>
                <span className="dragcar__title">{issue.title}</span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
