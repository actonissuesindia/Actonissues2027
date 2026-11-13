import { useEffect, useRef, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';

// Each step optionally names a real on-screen element to spotlight
// (`selector`) and, if that element only exists on a specific page
// (`route`), which page to navigate to first. Steps with no `selector`
// (the welcome/closing slides) render as a plain centered card instead —
// there's nothing on screen yet worth pointing at.
const STEPS = [
  {
    icon: 'bi-hand-thumbs-up-fill',
    title: 'Welcome to Act On Issues',
    text: "A place to report civic problems in your area — potholes, water supply, street lighting, and more — and see them tracked in the open until they're actually fixed."
  },
  {
    icon: 'bi-megaphone-fill',
    title: 'Raise an Issue',
    text: 'This button is always here at the top of the site — snap a photo or video, drop a pin for the location, and describe what\'s wrong. Takes under a minute.',
    selector: '[data-tour="raise-issue"]'
  },
  {
    icon: 'bi-hand-thumbs-up',
    title: 'Support, comment, follow along',
    text: 'Support issues you care about here, add a comment, and watch its status move from Open to In Progress to Resolved — right on its own page.',
    selector: '.btn-support',
    route: '/feed'
  },
  {
    icon: 'bi-send-fill',
    title: 'Escalation & Legal Advice',
    text: 'Staff can escalate a stuck issue straight to the right authority by email — you\'ll see who it went to and any reply, right there on the post. Need legal guidance instead? It\'s under this account menu.',
    selector: '[data-tour="profile-menu"]'
  },
  {
    icon: 'bi-rocket-takeoff-fill',
    title: "You're all set",
    text: 'Browse Latest and Trending on the feed, or raise your first issue right now. You can always find this tour again from Profile Settings.'
  }
];

const SEARCH_TIMEOUT_MS = 2500;

// A one-time guided tour for a first-time Citizen — gated on
// user.hasSeenWelcomeTour (see models/User.js), so it shows once per
// account, not once per device/browser. Mounted at the app root (see
// App.jsx), same pattern as ForcePasswordChangeModal, and deliberately
// doesn't close on an outside click — same reasoning as the Raise an Issue
// modal fix: a stray click shouldn't silently lose someone's place in it.
//
// Steps that name a real element are shown as a spotlight — a dimmed
// backdrop with a cutout around that element (see .tour-spotlight-ring in
// app.css) plus a callout near it — rather than just describing it in text,
// so the tour actually points at the thing it's talking about.
export default function WelcomeTourModal() {
  const { user, markTourSeen } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [step, setStep] = useState(0);
  const [busy, setBusy] = useState(false);
  const [targetRect, setTargetRect] = useState(null);
  const [searching, setSearching] = useState(false);
  const searchTokenRef = useRef(0);

  const STAFF_ROLES = ['Admin', 'Authority'];
  const active = !!user && !user.mustChangePassword && !user.hasSeenWelcomeTour && !STAFF_ROLES.includes(user.role);

  const slide = STEPS[step];
  const isLast = step === STEPS.length - 1;

  // Navigate to the step's page (if any), then wait for its target element
  // to actually mount before drawing the spotlight — a fresh account's feed
  // can be a beat slower to render its first card than the route change
  // itself. Falls back to a plain centered card (no cutout) if the element
  // never shows up, rather than leaving the tour stuck looking for it.
  useEffect(() => {
    if (!active) return;
    const token = ++searchTokenRef.current;
    setTargetRect(null);

    if (!slide.selector) return;

    if (slide.route && location.pathname !== slide.route) {
      navigate(slide.route);
      return; // the location change re-runs this effect once we've arrived
    }

    setSearching(true);
    const measure = () => {
      const el = document.querySelector(slide.selector);
      if (!el) return false;
      const r = el.getBoundingClientRect();
      if (r.width === 0 && r.height === 0) return false;
      el.scrollIntoView({ block: 'center', behavior: 'smooth' });
      setTargetRect(r);
      setSearching(false);
      return true;
    };

    if (measure()) return;

    const observer = new MutationObserver(() => { if (searchTokenRef.current === token) measure(); });
    observer.observe(document.body, { childList: true, subtree: true });
    const timeout = setTimeout(() => {
      if (searchTokenRef.current === token) setSearching(false);
    }, SEARCH_TIMEOUT_MS);

    return () => { observer.disconnect(); clearTimeout(timeout); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, step, location.pathname]);

  // Keep the cutout aligned with its target while scrolling/resizing.
  useEffect(() => {
    if (!targetRect || !slide.selector) return;
    const reposition = () => {
      const el = document.querySelector(slide.selector);
      if (el) setTargetRect(el.getBoundingClientRect());
    };
    window.addEventListener('scroll', reposition, { passive: true });
    window.addEventListener('resize', reposition);
    return () => {
      window.removeEventListener('scroll', reposition);
      window.removeEventListener('resize', reposition);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [targetRect !== null, step]);

  if (!active) return null;

  const finish = async (destination) => {
    setBusy(true);
    try {
      await markTourSeen();
    } finally {
      setBusy(false);
    }
    if (destination) navigate(destination);
  };

  const controls = (
    <>
      <div className="d-flex justify-content-center gap-2 my-3">
        {STEPS.map((_, i) => (
          <span
            key={i}
            className="rounded-circle"
            style={{ width: 8, height: 8, background: i === step ? 'var(--grad-a)' : '#e2e2ef', display: 'inline-block' }}
          ></span>
        ))}
      </div>
      <div className="d-flex border-top pt-3 justify-content-between">
        <button type="button" className="btn btn-pill-outline" disabled={step === 0 || busy} onClick={() => setStep(s => s - 1)}>
          Back
        </button>
        {isLast ? (
          <div className="d-flex gap-2">
            <button type="button" className="btn btn-pill-outline" disabled={busy} onClick={() => finish('/feed')}>
              Explore the feed
            </button>
            <button type="button" className="btn btn-gradient" disabled={busy} onClick={() => finish('/feed?post=1')}>
              {busy ? 'Getting ready…' : 'Raise your first issue'}
            </button>
          </div>
        ) : (
          <button type="button" className="btn btn-gradient" disabled={searching} onClick={() => setStep(s => s + 1)}>
            {searching ? 'One sec…' : 'Next'}
          </button>
        )}
      </div>
    </>
  );

  const cardBody = (
    <>
      <div
        className="d-inline-flex align-items-center justify-content-center rounded-circle mb-3"
        style={{ width: 56, height: 56, background: 'var(--grad-a)', color: '#fff', fontSize: '1.4rem' }}
      >
        <i className={`bi ${slide.icon}`}></i>
      </div>
      <h5 className="fw-bold mb-2">{slide.title}</h5>
      <p className="text-muted mb-0">{slide.text}</p>
    </>
  );

  // Spotlight variant: dimmed backdrop with a cutout ring around the real
  // element, plus a callout card placed just below (or above, if there's no
  // room) it — rather than the plain centered dialog.
  if (targetRect) {
    const pad = 8;
    const ringTop = targetRect.top - pad;
    const ringLeft = targetRect.left - pad;
    const ringWidth = targetRect.width + pad * 2;
    const ringHeight = targetRect.height + pad * 2;
    const spaceBelow = window.innerHeight - (ringTop + ringHeight);
    const placeAbove = spaceBelow < 220 && ringTop > 220;
    const cardWidth = 340;
    const cardLeft = Math.min(Math.max(ringLeft, 16), window.innerWidth - cardWidth - 16);

    return (
      <div className="tour-overlay" role="dialog" aria-modal="true">
        <div
          className="tour-spotlight-ring"
          style={{ top: ringTop, left: ringLeft, width: ringWidth, height: ringHeight }}
        ></div>
        <div
          className="tour-callout"
          style={{
            top: placeAbove ? undefined : ringTop + ringHeight + 14,
            bottom: placeAbove ? window.innerHeight - ringTop + 14 : undefined,
            left: cardLeft,
            width: cardWidth
          }}
        >
          <div className="d-flex justify-content-end mb-1">
            <button type="button" className="btn btn-sm btn-link text-muted text-decoration-none p-0" disabled={busy} onClick={() => finish()}>
              Skip
            </button>
          </div>
          {cardBody}
          {controls}
        </div>
      </div>
    );
  }

  // Plain centered variant: the intro/closing slides, or a highlighted step
  // whose target never showed up in time.
  return (
    <div className="modal d-block" tabIndex="-1" style={{ background: 'rgba(15, 23, 42, 0.55)' }}>
      <div className="modal-dialog modal-dialog-centered">
        <div className="modal-content">
          <div className="modal-header border-0 pb-0">
            <button type="button" className="btn btn-sm btn-link text-muted ms-auto text-decoration-none" disabled={busy} onClick={() => finish()}>
              Skip
            </button>
          </div>
          <div className="modal-body text-center px-4 pb-2">
            {cardBody}
          </div>
          <div className="modal-footer border-0 pt-0 d-block">
            {controls}
          </div>
        </div>
      </div>
    </div>
  );
}
