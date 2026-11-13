// 3D parallax/glassmorphic carousel engine — imperative by design (pointer
// drag physics, a per-frame rAF loop for autoplay/progress, ResizeObserver,
// matchMedia breakpoints) rather than React state, since none of that needs
// to trigger a re-render; React only owns mounting/unmounting the container
// this attaches to (see HotTopicsCarousel.jsx). destroy() below is the one
// addition beyond a straight port — the original standalone-page version
// never needed to stop its rAF loop or detach its listeners, but embedded
// in a React tree it must, or navigating away leaves the loop running
// forever against a detached DOM subtree.
export default class MzaCarousel {
  constructor(root, opts = {}) {
    this.root = root;
    this.viewport = root.querySelector('.mzaCarousel-viewport');
    this.track = root.querySelector('.mzaCarousel-track');
    this.slides = Array.from(root.querySelectorAll('.mzaCarousel-slide'));
    this.prevBtn = root.querySelector('.mzaCarousel-prev');
    this.nextBtn = root.querySelector('.mzaCarousel-next');
    this.pagination = root.querySelector('.mzaCarousel-pagination');
    this.progressBar = root.querySelector('.mzaCarousel-progressBar');
    this.isFF = typeof InstallTrigger !== 'undefined';
    this.n = this.slides.length;
    this.state = {
      index: 0,
      pos: 0,
      width: 0,
      height: 0,
      gap: 28,
      dragging: false,
      pointerId: null,
      x0: 0,
      v: 0,
      t0: 0,
      animating: false,
      hovering: false,
      startTime: 0,
      pausedAt: 0,
      rafId: 0
    };
    this.opts = Object.assign(
      {
        gap: 28,
        peek: 0.15,
        rotateY: 34,
        zDepth: 150,
        scaleDrop: 0.09,
        blurMax: 2.0,
        activeLeftBias: 0.12,
        interval: 4500,
        transitionMs: 900,
        keyboard: true,
        breakpoints: [
          { mq: '(max-width: 1200px)', gap: 24, peek: 0.12, rotateY: 28, zDepth: 120, scaleDrop: 0.08, activeLeftBias: 0.1 },
          { mq: '(max-width: 1000px)', gap: 18, peek: 0.09, rotateY: 22, zDepth: 90, scaleDrop: 0.07, activeLeftBias: 0.09 },
          { mq: '(max-width: 768px)', gap: 14, peek: 0.06, rotateY: 16, zDepth: 70, scaleDrop: 0.06, activeLeftBias: 0.08 },
          { mq: '(max-width: 560px)', gap: 12, peek: 0.05, rotateY: 12, zDepth: 60, scaleDrop: 0.05, activeLeftBias: 0.07 }
        ]
      },
      opts
    );
    if (this.isFF) {
      this.opts.rotateY = 10;
      this.opts.zDepth = 0;
      this.opts.blurMax = 0;
    }
    this._mediaListeners = [];
    this._init();
  }
  _init() {
    this._setupDots();
    this._bind();
    this._preloadImages();
    this._measure();
    this.goTo(0, false);
    this._startCycle();
    this._loop();
  }
  _preloadImages() {
    this.slides.forEach((sl) => {
      const card = sl.querySelector('.mzaCard');
      const bg = getComputedStyle(card).getPropertyValue('--mzaCard-bg');
      const m = /url\((?:'|")?([^'")]+)(?:'|")?\)/.exec(bg);
      if (m && m[1]) {
        const img = new Image();
        img.src = m[1];
      }
    });
  }
  _setupDots() {
    this.pagination.innerHTML = '';
    this.dots = this.slides.map((_, i) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'mzaCarousel-dot';
      b.setAttribute('role', 'tab');
      b.setAttribute('aria-label', `Go to slide ${i + 1}`);
      b.addEventListener('click', () => {
        this.goTo(i);
      });
      this.pagination.appendChild(b);
      return b;
    });
  }
  _bind() {
    this._onPrevClick = () => this.prev();
    this._onNextClick = () => this.next();
    this.prevBtn.addEventListener('click', this._onPrevClick);
    this.nextBtn.addEventListener('click', this._onNextClick);
    if (this.opts.keyboard) {
      this._onKeydown = (e) => {
        if (e.key === 'ArrowLeft') this.prev();
        if (e.key === 'ArrowRight') this.next();
      };
      this.root.addEventListener('keydown', this._onKeydown);
    }
    const pe = this.viewport;
    this._onDragStartBound = (e) => this._onDragStart(e);
    this._onDragMoveBound = (e) => this._onDragMove(e);
    this._onDragEndBound = (e) => this._onDragEnd(e);
    pe.addEventListener('pointerdown', this._onDragStartBound);
    pe.addEventListener('pointermove', this._onDragMoveBound);
    pe.addEventListener('pointerup', this._onDragEndBound);
    pe.addEventListener('pointercancel', this._onDragEndBound);
    // mouseenter/mouseleave don't bubble, so binding them directly to
    // `root` (as before) pauses on hovering *anywhere* in the carousel —
    // the empty margins between cards, the arrows, the progress bar strip
    // — not just the card itself. mouseover/mouseout do bubble, so this
    // delegates from root and checks (via closest/relatedTarget) whether a
    // .mzaCard was actually entered or left, the same distinction
    // mouseenter/mouseleave make natively but scoped to a dynamic selector.
    this._onCardMouseOver = (e) => {
      if (!this.state.hovering && e.target.closest && e.target.closest('.mzaCard')) {
        this.state.hovering = true;
        this.state.pausedAt = performance.now();
      }
    };
    this._onCardMouseOut = (e) => {
      const leftCard = e.target.closest && e.target.closest('.mzaCard');
      if (!leftCard) return;
      const stillInSameCard = e.relatedTarget && e.relatedTarget.closest && e.relatedTarget.closest('.mzaCard') === leftCard;
      if (stillInSameCard) return;
      if (this.state.pausedAt) {
        this.state.startTime += performance.now() - this.state.pausedAt;
        this.state.pausedAt = 0;
      }
      this.state.hovering = false;
    };
    this.root.addEventListener('mouseover', this._onCardMouseOver);
    this.root.addEventListener('mouseout', this._onCardMouseOut);
    this.ro = new ResizeObserver(() => this._measure());
    this.ro.observe(this.viewport);
    this.opts.breakpoints.forEach((bp) => {
      const m = window.matchMedia(bp.mq);
      const apply = () => {
        Object.keys(bp).forEach((k) => {
          if (k !== 'mq') this.opts[k] = bp[k];
        });
        this._measure();
        this._render();
      };
      if (m.addEventListener) m.addEventListener('change', apply);
      else m.addListener(apply);
      if (m.matches) apply();
      this._mediaListeners.push([m, apply]);
    });
    this._onTiltBound = (e) => this._onTilt(e);
    this.viewport.addEventListener('pointermove', this._onTiltBound);
    this._onOrientation = () => setTimeout(() => this._measure(), 250);
    window.addEventListener('orientationchange', this._onOrientation);
  }
  destroy() {
    cancelAnimationFrame(this.state.rafId);
    if (this.ro) this.ro.disconnect();
    window.removeEventListener('orientationchange', this._onOrientation);
    this._mediaListeners.forEach(([m, apply]) => {
      if (m.removeEventListener) m.removeEventListener('change', apply);
      else m.removeListener(apply);
    });
    // Removing the DOM nodes (React unmount) would drop these on its own,
    // but destroy() also runs on a plain effect re-run (e.g. React 18
    // StrictMode's dev-only double-invoke) where the same nodes stick
    // around for the next instance — without this, its listeners would
    // stack on top of the torn-down instance's instead of replacing them.
    this.prevBtn.removeEventListener('click', this._onPrevClick);
    this.nextBtn.removeEventListener('click', this._onNextClick);
    if (this._onKeydown) this.root.removeEventListener('keydown', this._onKeydown);
    this.viewport.removeEventListener('pointerdown', this._onDragStartBound);
    this.viewport.removeEventListener('pointermove', this._onDragMoveBound);
    this.viewport.removeEventListener('pointerup', this._onDragEndBound);
    this.viewport.removeEventListener('pointercancel', this._onDragEndBound);
    this.viewport.removeEventListener('pointermove', this._onTiltBound);
    this.root.removeEventListener('mouseover', this._onCardMouseOver);
    this.root.removeEventListener('mouseout', this._onCardMouseOut);
  }
  _measure() {
    const viewRect = this.viewport.getBoundingClientRect();
    const rootRect = this.root.getBoundingClientRect();
    const pagRect = this.pagination.getBoundingClientRect();
    const bottomGap = Math.max(12, Math.round(rootRect.bottom - pagRect.bottom));
    const pagSpace = pagRect.height + bottomGap;
    const availH = viewRect.height - pagSpace;
    const cardH = Math.max(320, Math.min(640, Math.round(availH)));
    this.state.width = viewRect.width;
    this.state.height = viewRect.height;
    this.state.gap = this.opts.gap;
    // Read the actual rendered slide width straight from the DOM instead
    // of recomputing it via a parallel formula that has to be hand-kept in
    // sync with the CSS custom property (--mzaC-slideW, including its own
    // responsive @media overrides) that really controls it — any drift
    // between the two is exactly what let slides overlap/misalign at some
    // viewport widths. getComputedStyle reads the layout width, unaffected
    // by the scale() this same slide may currently have applied to it.
    const sampleSlide = this.slides[0];
    this.slideW = sampleSlide
      ? parseFloat(getComputedStyle(sampleSlide).width) || Math.min(300, this.state.width * (1 - this.opts.peek * 2))
      : Math.min(300, this.state.width * (1 - this.opts.peek * 2));
    this.root.style.setProperty('--mzaPagH', `${pagSpace}px`);
    this.root.style.setProperty('--mzaCardH', `${cardH}px`);
  }
  _onTilt(e) {
    const r = this.viewport.getBoundingClientRect();
    const mx = (e.clientX - r.left) / r.width - 0.5;
    const my = (e.clientY - r.top) / r.height - 0.5;
    this.root.style.setProperty('--mzaTiltX', (my * -6).toFixed(3));
    this.root.style.setProperty('--mzaTiltY', (mx * 6).toFixed(3));
  }
  _onDragStart(e) {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    e.preventDefault();
    this.state.dragging = true;
    this.state.pointerId = e.pointerId;
    this.viewport.setPointerCapture(e.pointerId);
    this.state.x0 = e.clientX;
    this.state.t0 = performance.now();
    this.state.v = 0;
    this.state.pausedAt = performance.now();
  }
  _onDragMove(e) {
    if (!this.state.dragging || e.pointerId !== this.state.pointerId) return;
    const dx = e.clientX - this.state.x0;
    const dt = Math.max(16, performance.now() - this.state.t0);
    this.state.v = dx / dt;
    const slideSpan = this.slideW + this.state.gap;
    this.state.pos = this._mod(this.state.index - dx / slideSpan, this.n);
    this._render();
  }
  _onDragEnd(e) {
    if (!this.state.dragging || (e && e.pointerId !== this.state.pointerId)) return;
    this.state.dragging = false;
    try {
      if (this.state.pointerId != null) this.viewport.releasePointerCapture(this.state.pointerId);
    } catch { /* ignore */ }
    this.state.pointerId = null;
    if (this.state.pausedAt) {
      this.state.startTime += performance.now() - this.state.pausedAt;
      this.state.pausedAt = 0;
    }
    // _onDragStart's preventDefault (needed so swiping doesn't trigger text
    // selection/native drag) also suppresses the native `click` event that
    // would otherwise fire on release — so a plain tap/click has to be
    // detected here instead, from how little the pointer actually moved,
    // rather than relying on `click` ever reaching a card's own listener.
    // e.target can't be used to find which card that was, either: with the
    // pointer captured (setPointerCapture, above), every event's target is
    // forced to be the capturing element itself regardless of where the
    // pointer actually is — elementFromPoint reads real screen position
    // instead, unaffected by capture.
    if (this.opts.onCardTap && e) {
      const dx = e.clientX - this.state.x0;
      if (Math.abs(dx) < 6) {
        const real = document.elementFromPoint(e.clientX, e.clientY);
        const card = real && real.closest ? real.closest('.mzaCard') : null;
        if (card) this.opts.onCardTap(card);
      }
    }
    const v = this.state.v;
    const threshold = 0.18;
    const target = Math.round(this.state.pos - Math.sign(v) * (Math.abs(v) > threshold ? 0.5 : 0));
    this.goTo(this._mod(target, this.n));
  }
  _startCycle() {
    this.state.startTime = performance.now();
    this._renderProgress(0);
  }
  _loop() {
    const step = (t) => {
      if (!this.state.dragging && !this.state.hovering && !this.state.animating) {
        const elapsed = t - this.state.startTime;
        const p = Math.min(1, elapsed / this.opts.interval);
        this._renderProgress(p);
        if (elapsed >= this.opts.interval) this.next();
      }
      this.state.rafId = requestAnimationFrame(step);
    };
    this.state.rafId = requestAnimationFrame(step);
  }
  _renderProgress(p) {
    this.progressBar.style.transform = `scaleX(${p})`;
  }
  prev() {
    this.goTo(this._mod(this.state.index - 1, this.n));
  }
  next() {
    this.goTo(this._mod(this.state.index + 1, this.n));
  }
  goTo(i, animate = true) {
    const start = this.state.pos || this.state.index;
    const end = this._nearest(start, i);
    const dur = animate ? this.opts.transitionMs : 0;
    const t0 = performance.now();
    const ease = (x) => 1 - (1 - x) ** 4;
    this.state.animating = true;
    const step = (now) => {
      const t = Math.min(1, (now - t0) / dur);
      const p = dur ? ease(t) : 1;
      this.state.pos = start + (end - start) * p;
      this._render();
      if (t < 1) requestAnimationFrame(step);
      else this._afterSnap(i);
    };
    requestAnimationFrame(step);
  }
  _afterSnap(i) {
    this.state.index = this._mod(Math.round(this.state.pos), this.n);
    this.state.pos = this.state.index;
    this.state.animating = false;
    this._render(true);
    this._startCycle();
  }
  _nearest(from, target) {
    let d = target - Math.round(from);
    if (d > this.n / 2) d -= this.n;
    if (d < -this.n / 2) d += this.n;
    return Math.round(from) + d;
  }
  _mod(i, n) {
    return ((i % n) + n) % n;
  }
  _render(markActive = false) {
    const span = this.slideW + this.state.gap;
    const tiltX = parseFloat(this.root.style.getPropertyValue('--mzaTiltX') || 0);
    const tiltY = parseFloat(this.root.style.getPropertyValue('--mzaTiltY') || 0);
    // With an even slide count, the signed-distance wrap below always
    // leaves one slide unpaired — it lands as the +1 extra on one side or
    // the other, reading as a lopsided gap on the opposite side rather
    // than a symmetric spread around the active card. Capping how far out
    // a slide is allowed to sit (equally on both sides) and hiding
    // whichever one slide would break that symmetry fixes it; for an odd
    // count every slide already falls within this reach, so nothing
    // changes there.
    const maxReach = Math.floor((this.n - 1) / 2);

    for (let i = 0; i < this.n; i++) {
      let d = i - this.state.pos;
      if (d > this.n / 2) d -= this.n;
      if (d < -this.n / 2) d += this.n;
      const overReach = Math.abs(d) > maxReach;
      const weight = Math.max(0, 1 - Math.abs(d) * 2);
      const biasActive = -this.slideW * this.opts.activeLeftBias * weight;
      const tx = d * span + biasActive;
      const depth = -Math.abs(d) * this.opts.zDepth;
      const rot = -d * this.opts.rotateY;
      const scale = 1 - Math.min(Math.abs(d) * this.opts.scaleDrop, 0.42);
      const blur = Math.min(Math.abs(d) * this.opts.blurMax, this.opts.blurMax);
      const z = Math.round(1000 - Math.abs(d) * 10);
      const s = this.slides[i];
      if (this.isFF) {
        s.style.transform = `translate(${tx}px,-50%) scale(${scale})`;
        s.style.filter = 'none';
      } else {
        s.style.transform = `translate3d(${tx}px,-50%,${depth}px) rotateY(${rot}deg) scale(${scale})`;
        s.style.filter = `blur(${blur}px)`;
      }
      s.style.zIndex = z;
      // A duplicate slide (data-duplicate, set by HotTopicsCarousel when
      // there aren't enough real Hot Topics to fill the ring) stays
      // rendered so the layout still looks full, but at reduced opacity so
      // it doesn't read as a distinct extra post.
      s.style.opacity = overReach ? '0' : (s.dataset.duplicate ? '0.4' : '1');
      s.style.pointerEvents = overReach ? 'none' : '';
      if (markActive) s.dataset.state = Math.round(this.state.index) === i ? 'active' : 'rest';
      const card = s.querySelector('.mzaCard');
      const parBase = Math.max(-1, Math.min(1, -d));
      const parX = parBase * 48 + tiltY * 2.0;
      const parY = tiltX * -1.5;
      const bgX = parBase * -64 + tiltY * -2.4;
      card.style.setProperty('--mzaParX', `${parX.toFixed(2)}px`);
      card.style.setProperty('--mzaParY', `${parY.toFixed(2)}px`);
      card.style.setProperty('--mzaParBgX', `${bgX.toFixed(2)}px`);
      card.style.setProperty('--mzaParBgY', `${(parY * 0.35).toFixed(2)}px`);
    }
    const active = this._mod(Math.round(this.state.pos), this.n);
    this.dots.forEach((d, i) => d.setAttribute('aria-selected', i === active ? 'true' : 'false'));
  }
}
