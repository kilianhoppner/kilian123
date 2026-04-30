// ==========================
//  Live Local-Time Clock
// ==========================
function setupLondonClock() {
  const clockEl = document.getElementById('londonClock');
  if (!clockEl) return;

  const hourHand = clockEl.querySelector('.hour-hand');
  const minuteHand = clockEl.querySelector('.minute-hand');
  const secondHand = clockEl.querySelector('.second-hand');
  if (!hourHand || !minuteHand || !secondHand) return;

  function updateLondonClock() {
    const now = new Date();
    const hours = now.getHours() % 12;
    const minutes = now.getMinutes();
    const seconds = now.getSeconds();

    const hourDeg = (hours + minutes / 60) * 30;
    const minuteDeg = (minutes + seconds / 60) * 6;
    const secondDeg = seconds * 6;

    hourHand.style.transform = `translate(0, -50%) rotate(${hourDeg - 90}deg)`;
    minuteHand.style.transform = `translate(0, -50%) rotate(${minuteDeg - 90}deg)`;
    secondHand.style.transform = `translate(0, -50%) rotate(${secondDeg - 90}deg)`;
  }

  updateLondonClock();
  setInterval(updateLondonClock, 1000);
}

/**
 * Desktop (≥769px): click the clock to show it enlarged in the viewport centre; click again or Escape to close.
 * Hover uses the same transform transition as nav buttons; expand/collapse snap instantly (transition cleared in JS).
 * Scale ~78% of shorter side. No dim overlay.
 */
function setupClockDesktopExpand() {
  const clockEl = document.getElementById('londonClock');
  if (!clockEl) return;

  const mq = window.matchMedia('(min-width: 769px)');

  function computeScale() {
    const v = Math.min(window.innerWidth, window.innerHeight);
    const targetDiameter = v * 0.78;
    /* Match CSS: .clock is 4.6875rem (75px at 16px root) × transform scale(1.2). */
    const rootPx = parseFloat(getComputedStyle(document.documentElement).fontSize) || 16;
    const baseVisual = (75 / 16) * rootPx * 1.2;
    return Math.min(12, Math.max(3, targetDiameter / baseVisual));
  }

  /** Avoid animating transform when toggling expanded state (hover nudge still uses CSS transition). */
  function withNoTransition(run) {
    clockEl.style.setProperty('transition', 'none');
    run();
    void clockEl.offsetWidth;
    clockEl.style.removeProperty('transition');
  }

  function collapse() {
    withNoTransition(() => {
      clockEl.classList.remove('clock--expanded');
      clockEl.style.removeProperty('--clock-scale');
      clockEl.setAttribute('aria-expanded', 'false');
    });
  }

  function expand() {
    withNoTransition(() => {
      clockEl.style.setProperty('--clock-scale', String(computeScale()));
      clockEl.classList.add('clock--expanded');
      clockEl.setAttribute('aria-expanded', 'true');
    });
  }

  function toggle(e) {
    if (!mq.matches) return;
    if (e) e.stopPropagation();
    if (clockEl.classList.contains('clock--expanded')) {
      collapse();
    } else {
      expand();
    }
  }

  clockEl.setAttribute('role', 'button');
  clockEl.tabIndex = 0;
  clockEl.setAttribute('aria-expanded', 'false');

  clockEl.addEventListener('click', toggle);

  clockEl.addEventListener('keydown', (e) => {
    if (!mq.matches) return;
    if (e.key !== 'Enter' && e.key !== ' ') return;
    e.preventDefault();
    toggle(e);
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && mq.matches && clockEl.classList.contains('clock--expanded')) {
      collapse();
    }
  });

  window.addEventListener('resize', () => {
    if (mq.matches && clockEl.classList.contains('clock--expanded')) {
      clockEl.style.setProperty('--clock-scale', String(computeScale()));
    }
    if (!mq.matches && clockEl.classList.contains('clock--expanded')) {
      collapse();
    }
  });

  mq.addEventListener('change', () => {
    if (!mq.matches) collapse();
  });
}

// Open all links with class "hyperlink" in a new tab.
function setupHyperlinks() {
  document.querySelectorAll('a.hyperlink').forEach((link) => {
    link.setAttribute('target', '_blank');
    link.setAttribute('rel', 'noopener noreferrer');
  });
}

/** Gallery tile: clock stuck in 23:59:00–23:59:59, looping forever (never midnight). */
function setupGalleryMidnightStamp() {
  let seconds = 0;
  function tick() {
    const timeEls = document.querySelectorAll('.gallery-midnight-time');
    if (!timeEls.length) return;
    const ss = String(seconds).padStart(2, '0');
    const text = `23:59:${ss}`;
    const dt = `1970-01-01T23:59:${ss}`;
    timeEls.forEach((timeEl) => {
      timeEl.textContent = text;
      timeEl.setAttribute('datetime', dt);
    });
    seconds = (seconds + 1) % 60;
  }
  tick();
  window.setInterval(tick, 1000);
}

const PORTFOLIO_GALLERY_SCROLL_Y = 'portfolioGalleryScrollY';
const PORTFOLIO_GALLERY_SCROLL_PENDING = 'portfolioGalleryScrollPending';

/**
 * Remember gallery grid scroll when opening a piece; restore when returning from
 * gallery detail (Back link, top “Gallery” nav, or browser back). Uses referrer
 * so we do not jump if the user went to Bio (etc.) before returning to index.
 */
function tryRestoreGalleryScrollOnIndex() {
  if (!document.querySelector('section.gallery')) return;
  if (sessionStorage.getItem(PORTFOLIO_GALLERY_SCROLL_PENDING) !== '1') return;

  const raw = sessionStorage.getItem(PORTFOLIO_GALLERY_SCROLL_Y);
  const ref = document.referrer;
  let fromGallery = false;
  if (!ref) {
    fromGallery = true;
  } else {
    try {
      const u = new URL(ref);
      fromGallery = u.origin === window.location.origin && u.pathname.includes('/pages/');
    } catch {
      fromGallery = false;
    }
  }

  sessionStorage.removeItem(PORTFOLIO_GALLERY_SCROLL_PENDING);
  sessionStorage.removeItem(PORTFOLIO_GALLERY_SCROLL_Y);

  if (!fromGallery) return;
  if (raw == null) return;
  const y = parseFloat(raw);
  if (Number.isNaN(y) || y < 0) return;

  if ('scrollRestoration' in history) {
    history.scrollRestoration = 'manual';
  }

  const apply = () => {
    window.scrollTo(0, y);
  };

  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      apply();
      window.setTimeout(apply, 0);
      window.setTimeout(apply, 120);
    });
  });
  window.addEventListener('load', apply, { once: true });
}

function setupGalleryScrollRestore() {
  const gallery = document.querySelector('section.gallery');
  if (!gallery) return;

  gallery.addEventListener(
    'click',
    (e) => {
      if (!(e.target instanceof Element)) return;
      const a = e.target.closest('a[href]');
      if (!a || !gallery.contains(a)) return;
      const href = a.getAttribute('href');
      if (!href || href.startsWith('#')) return;
      try {
        const u = new URL(href, window.location.href);
        if (!u.pathname.includes('/pages/')) return;
      } catch {
        return;
      }
      if (e.defaultPrevented) return;
      if (e.button !== 0) return;
      if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      if (a.getAttribute('target') === '_blank') return;
      sessionStorage.setItem(PORTFOLIO_GALLERY_SCROLL_Y, String(window.scrollY));
      sessionStorage.setItem(PORTFOLIO_GALLERY_SCROLL_PENDING, '1');
    },
    true
  );
}

function registerGalleryScrollRestoreOnPageshow() {
  window.addEventListener('pageshow', () => {
    tryRestoreGalleryScrollOnIndex();
  });
}

/** Gallery detail + bio: “Back” to gallery index, above footer (all breakpoints). */
/** Bio: mobile only — one-way expand after “re-constructing” + “... more” (no Read less). */
function setupBioBiographyReadMore() {
  if (!document.body.classList.contains('page-bio')) return;
  const block = document.querySelector('[data-bio-biography]');
  const btn = block?.querySelector('.bio-biography__more-btn');
  if (!block || !btn) return;

  const mq = window.matchMedia('(max-width: 768px)');

  function setStateFromWidth() {
    if (!mq.matches) {
      block.classList.remove('bio-biography--expanded');
      btn.setAttribute('aria-expanded', 'false');
      btn.hidden = false;
    }
  }

  btn.addEventListener('click', () => {
    if (!mq.matches) return;
    if (block.classList.contains('bio-biography--expanded')) return;
    block.classList.add('bio-biography--expanded');
    btn.setAttribute('aria-expanded', 'true');
    btn.hidden = true;
  });

  mq.addEventListener('change', setStateFromWidth);
}

function setupPageBackButton() {
  if (document.querySelector('.page-back-wrap')) return;
  const footer = document.querySelector('footer.footer');
  if (!footer || !footer.parentNode) return;

  const isGalleryDetail = !!document.querySelector('main.gallery-detail');
  const isBio = document.body.classList.contains('page-bio');
  const isGalleryIndex = !!document.querySelector('section.gallery') && !isGalleryDetail;
  if (!isGalleryDetail && !isBio && !isGalleryIndex) return;

  const isTopButton = isBio || isGalleryIndex;
  const href = isTopButton
    ? '#top'
    : isGalleryDetail
      ? new URL('../index.html', window.location.href).href
      : new URL('index.html', window.location.href).href;

  const wrap = document.createElement('div');
  wrap.className = 'page-back-wrap';
  const a = document.createElement('a');
  a.href = href;
  a.className = 'nav-button';
  if (isTopButton) {
    a.textContent = 'Top';
    a.setAttribute('aria-label', 'Scroll to top');
    a.addEventListener('click', function (e) {
      e.preventDefault();
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });
  } else {
    a.textContent = 'Back';
    a.setAttribute('aria-label', 'Back to gallery');
  }
  wrap.appendChild(a);
  footer.parentNode.insertBefore(wrap, footer);
}

registerGalleryScrollRestoreOnPageshow();

/** Same distance as the mobile “scroll down” chevron under the nav (index + bio). */
function scrollMobileGalleryHintDistance() {
  const delta = Math.min(220, Math.max(100, window.innerHeight * 0.25));
  window.scrollBy({ top: delta, behavior: 'smooth' });
}

/**
 * Mobile: on index or bio, tapping the active nav label (Gallery / Bio) scrolls like the chevron.
 */
function setupMobileSamePageNavScrollDown() {
  const top = document.querySelector('.top-actions');
  if (!top) return;
  const galleryBtn = top.querySelector('a.nav-button[href*="index.html"]');
  const bioBtn = top.querySelector('a.nav-button[href*="bio.html"]');
  if (!galleryBtn && !bioBtn) return;

  function isNarrow() {
    return window.matchMedia('(max-width: 768px)').matches;
  }

  galleryBtn?.addEventListener('click', (e) => {
    if (!isNarrow()) return;
    if (!document.querySelector('body > section.gallery')) return;
    e.preventDefault();
    scrollMobileGalleryHintDistance();
  });

  bioBtn?.addEventListener('click', (e) => {
    if (!isNarrow()) return;
    if (!document.querySelector('body > section.profile-content')) return;
    e.preventDefault();
    scrollMobileGalleryHintDistance();
  });
}

/**
 * Mobile (index + bio): soft blinking arrow under the nav; tap scrolls a short way.
 * Fades out when main content (gallery or bio) enters view; fades back at top.
 */
function setupMobileGalleryScrollHint() {
  const wrap = document.querySelector('.mobile-scroll-hint');
  const btn = document.querySelector('.mobile-scroll-hint__btn');
  const contentSection =
    document.querySelector('section.gallery') || document.querySelector('section.profile-content');
  if (!wrap || !btn || !contentSection) return;

  const mq = window.matchMedia('(max-width: 768px)');
  const FADED = 'mobile-scroll-hint--faded';

  function update() {
    if (!mq.matches) {
      wrap.hidden = true;
      wrap.classList.remove(FADED);
      return;
    }
    const hasOverflow = document.documentElement.scrollHeight > window.innerHeight + 40;
    if (!hasOverflow) {
      wrap.hidden = true;
      wrap.classList.remove(FADED);
      return;
    }
    wrap.hidden = false;

    const contentTop = contentSection.getBoundingClientRect().top;
    const contentVisible = contentTop < window.innerHeight * 0.88;
    wrap.classList.toggle(FADED, contentVisible);
  }

  btn.addEventListener('click', scrollMobileGalleryHintDistance);
  window.addEventListener('scroll', update, { passive: true });
  window.addEventListener('resize', update);
  mq.addEventListener('change', update);
  window.addEventListener('load', update, { once: true });
  update();
}

/** Single speed during crossfade + clip edges so the overlap stays smooth (same as pre–variable-rate). */
const HORSE_RATE_CROSSFADE = 1.08;
/** First half of the clip plays a touch faster; second half a touch slower. */
const HORSE_RATE_FIRST_HALF = 1.1;
const HORSE_RATE_SECOND_HALF = 0.97;
/** Last segment before the crossfade window: a bit slower so gallop cadence matches the rest. */
const HORSE_RATE_TAIL = 0.68;
const HORSE_TAIL_START_FRAC = 0.74;

function horseRateSmoothstep(u) {
  const x = Math.min(1, Math.max(0, u));
  return x * x * (3 - 2 * x);
}

/**
 * Two stacked clips: next starts at 0 and snaps visible; previous fades out (no
 * dual semi-transparent blend over the white tile).
 */
function setupHorseVideoSeamlessLoop() {
  function initSlot(slot, activeClass) {
    const videos = slot.querySelectorAll('video');
    if (videos.length < 2) return;

    /** Outgoing opacity transition + setTimeout cleanup stay aligned (see CSS). */
    const CROSSFADE_SEC = 0.35;
    const fadeMs = Math.round(CROSSFADE_SEC * 1000) + 40;

    let activeIdx = 0;
    let transitioning = false;
    /** rAF loop — timeupdate is too sparse, so we’d often start the crossfade late and the seam feels choppy. */
    let crossfadeMonitorId = null;

    /** Blend second-half → tail and tail → crossfade rate so playbackRate doesn’t jump. */
    const MID_BLEND_FRAC = 0.02;
    const TAIL_IN_BLEND_FRAC = 0.04;
    const TAIL_TO_CROSSFADE_SEC = 0.14;

    videos.forEach((v) => {
      v.removeAttribute('loop');
    });

    function active() {
      return videos[activeIdx];
    }
    function standby() {
      return videos[1 - activeIdx];
    }

    function crossfadeWindowSec(dur) {
      return Math.min(CROSSFADE_SEC, Math.max(0.04, dur * 0.32));
    }

    function applyPlaybackRateForVideo(v) {
      const dur = v.duration;
      if (!dur || Number.isNaN(dur)) return;
      const t = v.currentTime;
      const cf = crossfadeWindowSec(dur);
      const nearStart = t <= cf;
      const inCrossfadeWindow = t >= dur - cf || v.ended;
      let rate;

      if (transitioning || nearStart) {
        rate = HORSE_RATE_CROSSFADE;
      } else if (inCrossfadeWindow) {
        rate = HORSE_RATE_CROSSFADE;
      } else {
        const half = dur / 2;
        const midW = dur * MID_BLEND_FRAC;
        const tailStart = dur * HORSE_TAIL_START_FRAC;
        const tailInLen = dur * TAIL_IN_BLEND_FRAC;
        const tailInFrom = tailStart - tailInLen;
        const rampEnd = dur - cf;
        const rampStart = Math.max(tailStart, rampEnd - TAIL_TO_CROSSFADE_SEC);

        if (t >= rampStart) {
          const u = (t - rampStart) / Math.max(1e-6, rampEnd - rampStart);
          rate =
            HORSE_RATE_TAIL +
            (HORSE_RATE_CROSSFADE - HORSE_RATE_TAIL) * horseRateSmoothstep(u);
        } else if (t >= tailStart) {
          rate = HORSE_RATE_TAIL;
        } else if (t >= tailInFrom) {
          const u = (t - tailInFrom) / Math.max(1e-6, tailStart - tailInFrom);
          rate =
            HORSE_RATE_SECOND_HALF +
            (HORSE_RATE_TAIL - HORSE_RATE_SECOND_HALF) * horseRateSmoothstep(u);
        } else if (t >= half + midW) {
          rate = HORSE_RATE_SECOND_HALF;
        } else if (t >= half - midW) {
          const u = (t - (half - midW)) / Math.max(1e-6, 2 * midW);
          rate =
            HORSE_RATE_FIRST_HALF +
            (HORSE_RATE_SECOND_HALF - HORSE_RATE_FIRST_HALF) * horseRateSmoothstep(u);
        } else {
          rate = HORSE_RATE_FIRST_HALF;
        }
      }

      if (Math.abs(v.playbackRate - rate) > 0.0005) {
        v.defaultPlaybackRate = rate;
        v.playbackRate = rate;
      }
    }

    function startCrossfadeMonitor() {
      if (crossfadeMonitorId != null) return;
      crossfadeMonitorId = requestAnimationFrame(crossfadeMonitorTick);
    }

    function crossfadeMonitorTick() {
      crossfadeMonitorId = null;
      const anyPlaying = videos.some((v) => !v.paused);
      if (!anyPlaying && !transitioning) return;

      if (!transitioning) {
        const cur = active();
        if (cur && !cur.paused) {
          const dur = cur.duration;
          if (dur && !Number.isNaN(dur)) {
            const crossfade = crossfadeWindowSec(dur);
            if (cur.currentTime >= dur - crossfade || cur.ended) {
              armCrossfade();
            }
          }
        }
      }

      videos.forEach((v) => {
        if (!v.paused || transitioning) applyPlaybackRateForVideo(v);
      });

      if (videos.some((v) => !v.paused) || transitioning) {
        crossfadeMonitorId = requestAnimationFrame(crossfadeMonitorTick);
      }
    }

    function armCrossfade() {
      if (transitioning) return;
      const cur = active();
      const next = standby();
      const dur = cur.duration;
      if (!dur || Number.isNaN(dur)) return;

      const crossfade = crossfadeWindowSec(dur);
      const nearEnd = cur.currentTime >= dur - crossfade || cur.ended;
      if (!nearEnd) return;

      transitioning = true;
      next.currentTime = 0;
      applyPlaybackRateForVideo(next);
      const playPromise = next.play();
      const swapLayers = () => {
        requestAnimationFrame(() => {
          next.classList.add(activeClass);
          cur.classList.remove(activeClass);
        });
      };
      const finish = () => {
        if (typeof next.requestVideoFrameCallback === 'function') {
          next.requestVideoFrameCallback(() => swapLayers());
        } else {
          swapLayers();
        }
        window.setTimeout(() => {
          cur.pause();
          cur.currentTime = 0;
          activeIdx = 1 - activeIdx;
          transitioning = false;
          videos.forEach((el) => applyPlaybackRateForVideo(el));
        }, fadeMs);
      };
      if (playPromise !== undefined) {
        playPromise.then(finish).catch(() => {
          transitioning = false;
        });
      } else {
        finish();
      }
    }

    videos.forEach((v, i) => {
      v.addEventListener('timeupdate', () => {
        applyPlaybackRateForVideo(v);
      });
      v.addEventListener('playing', () => {
        startCrossfadeMonitor();
      });
      v.addEventListener('ended', () => {
        if (i !== activeIdx || transitioning) return;
        armCrossfade();
      });
    });

    videos[0].classList.add(activeClass);
    videos[1].classList.remove(activeClass);
    videos.forEach((v) => {
      applyPlaybackRateForVideo(v);
      v.addEventListener('loadedmetadata', () => applyPlaybackRateForVideo(v), { once: true });
    });

    requestAnimationFrame(() => {
      if (videos.some((video) => !video.paused)) {
        startCrossfadeMonitor();
      }
    });
  }

  document.querySelectorAll('.gallery-video-slot').forEach((slot) => {
    initSlot(slot, 'gallery-video-slot__video--active');
  });
  document.querySelectorAll('.gallery-detail__video-slot').forEach((slot) => {
    initSlot(slot, 'gallery-detail__video--active');
  });
}

/** Infinite horizontal ticker (duplicate segment + translate) for all footers. */
function setupFooterMarquee() {
  document.querySelectorAll('footer.footer').forEach((footer) => {
    if (footer.dataset.footerMarqueeInit === '1') return;
    if (footer.querySelector('.footer-marquee')) return;
    if (!footer.childNodes.length) return;

    const track = document.createElement('div');
    track.className = 'footer-marquee__track';

    const seg1 = document.createElement('div');
    seg1.className = 'footer-marquee__segment';

    while (footer.firstChild) {
      seg1.appendChild(footer.firstChild);
    }

    const seg2 = seg1.cloneNode(true);
    seg2.classList.add('footer-marquee__segment--duplicate');
    seg2.setAttribute('aria-hidden', 'true');
    seg2.querySelectorAll('a').forEach((a) => a.setAttribute('tabindex', '-1'));

    track.appendChild(seg1);
    track.appendChild(seg2);

    const wrap = document.createElement('div');
    wrap.className = 'footer-marquee';
    wrap.setAttribute('role', 'presentation');
    wrap.appendChild(track);

    footer.appendChild(wrap);
    footer.dataset.footerMarqueeInit = '1';
  });
}

// ==========================
//  Dotline A–Z stroke animation
// ==========================
function setupDotlineAZAnimation() {
  const hosts = Array.from(document.querySelectorAll('[data-dotline-az]'));
  if (!hosts.length) return;
  if (!('opentype' in window)) return;

  const VIEW = 626.5333333333334;
  const NS = 'http://www.w3.org/2000/svg';
  const LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');
  const LETTER_MS = 11000;

  const fontCache = new Map();
  function loadFont(url) {
    if (fontCache.has(url)) return fontCache.get(url);
    const p = new Promise((resolve, reject) => {
      window.opentype.load(url, (err, font) => {
        if (err) reject(err);
        else resolve(font);
      });
    });
    fontCache.set(url, p);
    return p;
  }

  function buildSvgHost(host) {
    host.textContent = '';

    const svg = document.createElementNS(NS, 'svg');
    svg.setAttribute('viewBox', `0 0 ${VIEW} ${VIEW}`);
    svg.setAttribute('width', String(VIEW));
    svg.setAttribute('height', String(VIEW));
    svg.setAttribute('preserveAspectRatio', 'xMidYMid meet');
    svg.setAttribute('aria-hidden', 'true');

    host.appendChild(svg);
    return svg;
  }

  function buildLetterPath(font, letter, gridSrc) {
    // Start with a generous font size; we’ll scale into the square viewBox.
    const baseSize = 520;
    const p = font.getPath(letter, 0, 0, baseSize);
    const bb = p.getBoundingBox();
    const w = Math.max(1, bb.x2 - bb.x1);
    const h = Math.max(1, bb.y2 - bb.y1);

    const target = VIEW * 0.82;
    const s = target / Math.max(w, h);
    const tx = (VIEW - w * s) / 2 - bb.x1 * s;
    const ty = (VIEW - h * s) / 2 - bb.y1 * s;

    const wrap = document.createElementNS(NS, 'g');

    const img = gridSrc ? document.createElementNS(NS, 'image') : null;
    if (img) {
      // Use both href and xlink:href for maximum compatibility.
      img.setAttribute('href', gridSrc);
      img.setAttributeNS('http://www.w3.org/1999/xlink', 'xlink:href', gridSrc);
      img.setAttribute('preserveAspectRatio', 'none');
      img.style.pointerEvents = 'none';
      wrap.appendChild(img);
    }

    const g = document.createElementNS(NS, 'g');
    g.setAttribute('transform', `translate(${tx.toFixed(3)} ${ty.toFixed(3)}) scale(${s.toFixed(6)})`);

    const fill = document.createElementNS(NS, 'path');
    fill.setAttribute('d', p.toPathData(2));
    fill.setAttribute('class', 'dotline-az__fill');
    g.appendChild(fill);

    // Split glyph outlines into contours so each contour can be stroked.
    const commands = Array.isArray(p.commands) ? p.commands : [];
    const contours = [];
    let cur = [];
    commands.forEach((cmd) => {
      if (cmd.type === 'M' && cur.length) {
        contours.push(cur);
        cur = [];
      }
      cur.push(cmd);
      if (cmd.type === 'Z') {
        contours.push(cur);
        cur = [];
      }
    });
    if (cur.length) contours.push(cur);

    const stroke = Math.max(1.5, Math.min(18, 12 / s));
    const circleMax = baseSize * 0.42;
    const contourMeta = contours.map((c) => {
      const cp = new window.opentype.Path();
      cp.commands = c;
      const cbb = cp.getBoundingBox();
      const w = Math.max(0, cbb.x2 - cbb.x1);
      const h = Math.max(0, cbb.y2 - cbb.y1);
      const ratio = w && h ? w / h : 0;
      const squareish = ratio > 0.82 && ratio < 1.22;
      const smallish = w < circleMax && h < circleMax;
      const isCircle = squareish && smallish;
      const size = Math.max(w, h);
      return { cp, cbb, w, h, isCircle, size };
    });

    const circleSizes = contourMeta.filter((m) => m.isCircle).map((m) => m.size);
    const minCircleSize = circleSizes.length ? Math.min(...circleSizes) : null;
    const minTolerance = 0.75;

    // Fit the grid (and the circle radius) based on the node circle centers.
    // grid-5x5.svg uses viewBox 0..800 with node centers spanning [GRID_MIN..GRID_MAX]
    // and node radius GRID_R.
    const GRID_VIEW = 800;
    const GRID_R = 76.31357123;
    const GRID_MIN = GRID_R;
    const GRID_MAX = 723.68642877;
    const GRID_SPAN = GRID_MAX - GRID_MIN;
    let gridScale = null;
    let gridX = null;
    let gridY = null;
    let gridSize = null;

    if (minCircleSize != null) {
      const pts = contourMeta
        .filter((m) => m.isCircle && m.size <= minCircleSize + minTolerance)
        .map((m) => {
          const cx = (m.cbb.x1 + m.cbb.x2) / 2;
          const cy = (m.cbb.y1 + m.cbb.y2) / 2;
          return { x: tx + cx * s, y: ty + cy * s };
        });

      if (pts.length >= 2) {
        let minX = pts[0].x;
        let maxX = pts[0].x;
        let minY = pts[0].y;
        let maxY = pts[0].y;
        for (let i = 1; i < pts.length; i += 1) {
          const p = pts[i];
          if (p.x < minX) minX = p.x;
          if (p.x > maxX) maxX = p.x;
          if (p.y < minY) minY = p.y;
          if (p.y > maxY) maxY = p.y;
        }

        const sx = (maxX - minX) / GRID_SPAN;
        const sy = (maxY - minY) / GRID_SPAN;
        gridScale = (sx + sy) / 2;
        gridX = minX - gridScale * GRID_MIN;
        gridY = minY - gridScale * GRID_MIN;
        gridSize = gridScale * GRID_VIEW;
      }
    }

    if (img && gridScale != null && gridX != null && gridY != null && gridSize != null) {
      img.setAttribute('x', gridX.toFixed(3));
      img.setAttribute('y', gridY.toFixed(3));
      img.setAttribute('width', gridSize.toFixed(3));
      img.setAttribute('height', gridSize.toFixed(3));
    } else if (img) {
      // Fallback: map to glyph bounding box if we can't fit from circles.
      const x0 = (VIEW - w * s) / 2;
      const y0 = (VIEW - h * s) / 2;
      img.setAttribute('x', x0.toFixed(3));
      img.setAttribute('y', y0.toFixed(3));
      img.setAttribute('width', (w * s).toFixed(3));
      img.setAttribute('height', (h * s).toFixed(3));
    }

    contourMeta.forEach((m) => {
      const { cp, cbb, w, h, isCircle, size } = m;
      const isSmallestCircle =
        isCircle && minCircleSize != null && size <= minCircleSize + minTolerance;

      if (isSmallestCircle) {
        // Normalize smallest circle contours to real <circle> primitives.
        const circle = document.createElementNS(NS, 'circle');
        const cx = (cbb.x1 + cbb.x2) / 2;
        const cy = (cbb.y1 + cbb.y2) / 2;
        const r = Math.max(0.1, (w + h) / 4);

        circle.setAttribute('cx', cx.toFixed(3));
        circle.setAttribute('cy', cy.toFixed(3));
        circle.setAttribute('r', r.toFixed(3));
        circle.setAttribute('fill', '#fff');
        circle.setAttribute('stroke', 'currentColor');
        circle.setAttribute('stroke-linecap', 'round');
        circle.setAttribute('stroke-linejoin', 'round');
        circle.setAttribute('stroke-width', stroke.toFixed(2));
        circle.setAttribute('class', 'dotline-az__circle');
        g.appendChild(circle);

        // Fill-state hole circle (only visible during filled end-state).
        // If a grid is fitted, match its circle radius, with a tiny compensation so the
        // visible hole (fill + outline) matches the grid circle more closely.
        const rFill =
          gridScale != null
            ? Math.max(0.1, (gridScale * GRID_R) / s + stroke / 2)
            : r;
        const circleFill = document.createElementNS(NS, 'circle');
        circleFill.setAttribute('cx', cx.toFixed(3));
        circleFill.setAttribute('cy', cy.toFixed(3));
        circleFill.setAttribute('r', rFill.toFixed(3));
        circleFill.setAttribute('fill', '#fff');
        circleFill.setAttribute('stroke', 'currentColor');
        circleFill.setAttribute('stroke-linecap', 'round');
        circleFill.setAttribute('stroke-linejoin', 'round');
        circleFill.setAttribute('stroke-width', stroke.toFixed(2));
        circleFill.setAttribute('class', 'dotline-az__circle dotline-az__circle--fill');
        g.appendChild(circleFill);
      } else {
        const path = document.createElementNS(NS, 'path');
        path.setAttribute('d', cp.toPathData(2));
        path.setAttribute('fill', 'none');
        path.setAttribute('stroke', 'currentColor');
        path.setAttribute('stroke-linecap', 'round');
        path.setAttribute('stroke-linejoin', 'round');
        path.setAttribute('pathLength', '1000');
        path.setAttribute('stroke-width', stroke.toFixed(2));
        path.setAttribute('class', 'dotline-az__path');
        g.appendChild(path);
      }
    });

    wrap.appendChild(g);
    return wrap;
  }

  // Group all animations by font URL so every instance stays perfectly in sync.
  const groups = new Map();
  hosts.forEach((host) => {
    const fontUrl = host.getAttribute('data-dotline-font') || '';
    if (!fontUrl) return;
    if (!groups.has(fontUrl)) groups.set(fontUrl, []);
    groups.get(fontUrl).push(host);
  });

  groups.forEach((groupHosts, fontUrl) => {
    const svgs = groupHosts.map((host) => {
      const svg = buildSvgHost(host);
      host.style.color = '#000';
      return { host, svg };
    });

    loadFont(fontUrl)
      .then((font) => {
        let idx = 0;
        let timer = null;
        let active = true;

        const renderAll = () => {
          const letter = LETTERS[idx % LETTERS.length];
          // Keep all instances in sync by letter index, but allow per-host grid underlays.
          svgs.forEach(({ host, svg }) => {
            const gridSrc = host.getAttribute('data-dotline-grid') || '';
            svg.replaceChildren(buildLetterPath(font, letter, gridSrc));
          });
          idx += 1;
        };

        const tick = () => {
          if (!active) return;
          renderAll();
          timer = window.setTimeout(tick, LETTER_MS);
        };

        renderAll();
        timer = window.setTimeout(tick, LETTER_MS);

        // If the page unloads, stop timers (avoid orphan timeouts).
        window.addEventListener(
          'pagehide',
          () => {
            active = false;
            if (timer != null) window.clearTimeout(timer);
          },
          { once: true }
        );
      })
      .catch(() => {
        svgs.forEach(({ host }) => {
          const fallback = host.getAttribute('data-dotline-fallback');
          if (!fallback) return;
          host.textContent = '';
          const img = document.createElement('img');
          img.src = fallback;
          img.alt = 'Animated line symbol';
          img.decoding = 'async';
          img.loading = 'eager';
          img.style.width = '100%';
          img.style.height = '100%';
          img.style.objectFit = 'contain';
          host.appendChild(img);
        });
      });
  });
}

function setupDotlineCharacterOverview() {
  const grids = document.querySelectorAll('[data-dotline-overview-grid]');
  if (!grids.length) return;

  const glyphOrder = [
    'A', 'A.ss01', 'A.ss02', 'A.ss03',
    'B', 'B.ss01', 'B.ss02', 'B.ss03', 'B.ss04',
    'C',
    'D', 'D.ss01', 'D.ss02',
    'E', 'E.ss01', 'E.ss02', 'E.ss03', 'E.ss04',
    'F', 'F.ss01', 'F.ss02', 'F.ss03',
    'G', 'G.ss01', 'G.ss02',
    'H', 'H.ss01', 'H.ss02',
    'I', 'I.ss01',
    'J', 'J.ss01',
    'K', 'K.ss01',
    'L',
    'M', 'M.ss01', 'M.ss02', 'M.ss03', 'M.ss04', 'M.ss05',
    'N', 'N.ss01', 'N.ss02',
    'O',
    'P', 'P.ss01',
    'Q', 'Q.ss01', 'Q.ss02',
    'R', 'R.ss01',
    'S', 'S.ss01',
    'T', 'T.ss01', 'T.ss02',
    'U', 'U.ss01',
    'V', 'V.ss01',
    'W', 'W.ss01', 'W.ss02', 'W.ss03', 'W.ss04', 'W.ss05',
    'X', 'X.ss01',
    'Y', 'Y.ss01',
    'Z', 'Z.ss01', 'Z.ss02',
    'zero',
    'one', 'one.ss01', 'one.ss02',
    'two', 'two.ss01', 'two.ss02', 'two.ss03',
    'three', 'three.ss01', 'three.ss02', 'three.ss03',
    'four', 'four.ss01', 'four.ss02',
    'five',
    'six', 'six.ss01',
    'seven', 'seven.ss01',
    'eight', 'eight.ss01',
    'nine', 'nine.ss01',
    'period', 'comma', 'exclam', 'question', 'question.ss01',
    'plus', 'minus', 'multiply', 'divide',
    'rightArrow', 'downArrow', 'leftArrow', 'upArrow'
  ];

  const glyphToChar = {
    zero: '0',
    one: '1',
    two: '2',
    three: '3',
    four: '4',
    five: '5',
    six: '6',
    seven: '7',
    eight: '8',
    nine: '9',
    period: '.',
    comma: ',',
    exclam: '!',
    question: '?',
    plus: '+',
    minus: '−',
    multiply: '×',
    divide: '÷',
    rightArrow: '→',
    downArrow: '↓',
    leftArrow: '←',
    upArrow: '↑',
    space: ' '
  };

  function parseAltFeature(glyphName) {
    const match = /\.ss(\d\d)$/.exec(glyphName);
    return match ? `ss${match[1]}` : null;
  }

  function baseGlyph(glyphName) {
    return glyphName.split('.')[0];
  }

  grids.forEach((grid) => {
    grid.textContent = '';

    glyphOrder.forEach((name) => {
      const cell = document.createElement('div');
      cell.className = 'dotline-specimen__glyph-cell';

      const char = document.createElement('p');
      char.className = 'dotline-specimen__glyph-char';
      const base = baseGlyph(name);
      const mapped = glyphToChar[base];
      const displayChar = mapped != null ? mapped : base;
      const isSpace = base === 'space';
      if (isSpace) {
        char.textContent = 'space';
        char.classList.add('dotline-specimen__glyph-char--space');
      } else {
        char.textContent = displayChar;
      }

      const feature = parseAltFeature(name);
      if (feature) {
        char.style.fontFeatureSettings = `"${feature}" 1`;
      }

      const label = document.createElement('p');
      label.className = 'dotline-specimen__glyph-label';
      label.textContent = name;

      cell.appendChild(char);
      cell.appendChild(label);
      grid.appendChild(cell);
    });

    const specimen = grid.closest('[data-dotline-overview]');
    if (!specimen) return;

    const items = glyphOrder.length;
    function applyDynamicOverviewLayout() {
      const rect = grid.getBoundingClientRect();
      const W = rect.width;
      const H = rect.height;
      if (!W || !H) return;

      // Keep proportions stable while ensuring all rows fit in available height.
      const isMobile = window.matchMedia('(max-width: 768px)').matches;
      const gap = isMobile
        ? Math.max(2, Math.min(6, W * 0.0048))
        : Math.max(3, Math.min(8, W * 0.006));
      let best = null;

      const minCols = isMobile ? 9 : 11;
      const maxCols = isMobile ? 12 : 21;

      for (let cols = minCols; cols <= maxCols; cols += 1) {
        const rows = Math.ceil(items / cols);
        const cellW = (W - (cols - 1) * gap) / cols;
        const cellH = (H - (rows - 1) * gap) / rows;
        if (cellW <= 0 || cellH <= 0) continue;

        // Score prefers larger readable cells that still fit.
        const score = Math.min(cellW, cellH * 1.25);
        if (!best || score > best.score) {
          best = { cols, rows, cellW, cellH, score };
        }
      }

      if (!best) return;

      const layoutCellH = isMobile ? Math.min(best.cellH, best.cellW) : best.cellH;
      const glyphSize = isMobile
        ? Math.max(8.25, Math.min(layoutCellH * 0.44, best.cellW * 0.5))
        : Math.max(10, Math.min(best.cellH * 0.54, best.cellW * 0.6));
      const labelSize = isMobile
        ? Math.max(6, Math.min(layoutCellH * 0.135, 10))
        : Math.max(7, Math.min(best.cellH * 0.17, 11.5));
      const padY = Math.max(2, layoutCellH * 0.1);
      const padX = Math.max(2, best.cellW * 0.1);
      const innerGap = Math.max(1, layoutCellH * 0.05);

      grid.style.setProperty('--dot-ov-cols', String(best.cols));
      grid.style.setProperty('--dot-ov-gap', `${gap.toFixed(2)}px`);
      grid.style.setProperty('--dot-ov-cell-h', `${layoutCellH.toFixed(2)}px`);
      grid.style.setProperty('--dot-ov-glyph-size', `${glyphSize.toFixed(2)}px`);
      grid.style.setProperty('--dot-ov-label-size', `${labelSize.toFixed(2)}px`);
      grid.style.setProperty('--dot-ov-pad-y', `${padY.toFixed(2)}px`);
      grid.style.setProperty('--dot-ov-pad-x', `${padX.toFixed(2)}px`);
      grid.style.setProperty('--dot-ov-inner-gap', `${innerGap.toFixed(2)}px`);

      // Keep hover behavior identical for all cells (no edge-specific nudging).
    }

    const ro = new ResizeObserver(() => applyDynamicOverviewLayout());
    ro.observe(specimen);
    ro.observe(grid);
    applyDynamicOverviewLayout();
  });
}

function setupDotlineWrenchViewer() {
  const viewer = document.querySelector('.dotline-wrench-viewer');
  if (!viewer) return;
  const mq = window.matchMedia('(max-width: 768px)');
  const desktopOrientation = '90deg 180.1deg 159deg';
  const mobileOrientation = '180deg 155deg 180deg';
  let resizeRaf = 0;
  const media = viewer.closest('.gallery-detail__carousel-media');

  const apply = () => {
    viewer.setAttribute('field-of-view', mq.matches ? '10deg' : '40deg');
    viewer.setAttribute('orientation', mq.matches ? mobileOrientation : desktopOrientation);
    viewer.setAttribute('camera-orbit', mq.matches ? '0deg 100deg 110%' : '0deg 90deg 120%');
    if (typeof viewer.jumpCameraToGoal === 'function') {
      viewer.jumpCameraToGoal();
    }
  };

  const forceViewerLayout = () => {
    if (!media) return;
    const rect = media.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    // Force a concrete pixel box during resize so model-viewer redraws immediately.
    viewer.style.width = `${rect.width}px`;
    viewer.style.height = `${rect.height}px`;
    viewer.style.maxWidth = 'none';
    viewer.style.maxHeight = 'none';
    viewer.style.minWidth = '0';
    viewer.style.minHeight = '0';
    if (typeof viewer.jumpCameraToGoal === 'function') {
      viewer.jumpCameraToGoal();
    }
  };

  const scheduleApply = () => {
    if (resizeRaf) window.cancelAnimationFrame(resizeRaf);
    resizeRaf = window.requestAnimationFrame(() => {
      resizeRaf = 0;
      apply();
      forceViewerLayout();
    });
  };

  apply();
  forceViewerLayout();
  viewer.addEventListener('load', scheduleApply, { once: true });
  mq.addEventListener('change', scheduleApply);
  window.addEventListener('resize', scheduleApply, { passive: true });

  if (typeof ResizeObserver !== 'undefined') {
    if (media) {
      const ro = new ResizeObserver(scheduleApply);
      ro.observe(media);
    }
  }

  const track = viewer.closest('.gallery-detail__carousel')?.querySelector('.gallery-detail__carousel-track');
  if (track) {
    track.addEventListener('transitionend', scheduleApply);
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    setupLondonClock();
    setupClockDesktopExpand();
    setupHyperlinks();
    setupGalleryMidnightStamp();
    setupPageBackButton();
    setupBioBiographyReadMore();
    setupGalleryScrollRestore();
    tryRestoreGalleryScrollOnIndex();
    setupMobileGalleryScrollHint();
    setupMobileSamePageNavScrollDown();
    setupHorseVideoSeamlessLoop();
    setupFooterMarquee();
    setupDotlineAZAnimation();
    setupDotlineCharacterOverview();
    setupDotlineWrenchViewer();
  });
} else {
  setupLondonClock();
  setupClockDesktopExpand();
  setupHyperlinks();
  setupGalleryMidnightStamp();
  setupPageBackButton();
  setupBioBiographyReadMore();
  setupGalleryScrollRestore();
  tryRestoreGalleryScrollOnIndex();
  setupMobileGalleryScrollHint();
  setupMobileSamePageNavScrollDown();
  setupHorseVideoSeamlessLoop();
  setupFooterMarquee();
  setupDotlineAZAnimation();
  setupDotlineCharacterOverview();
  setupDotlineWrenchViewer();
}
