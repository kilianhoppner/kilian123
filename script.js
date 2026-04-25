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
/** Bio: mobile only — expand/collapse biography after “web development.” */
function setupBioBiographyReadMore() {
  if (!document.body.classList.contains('page-bio')) return;
  const block = document.querySelector('[data-bio-biography]');
  const btn = block?.querySelector('.bio-biography__readmore');
  if (!block || !btn) return;

  const mq = window.matchMedia('(max-width: 768px)');

  function setStateFromWidth() {
    if (!mq.matches) {
      block.classList.remove('bio-biography--expanded');
      btn.setAttribute('aria-expanded', 'false');
      btn.textContent = 'Read more';
    }
  }

  btn.addEventListener('click', () => {
    if (!mq.matches) return;
    const open = block.classList.toggle('bio-biography--expanded');
    btn.setAttribute('aria-expanded', open ? 'true' : 'false');
    btn.textContent = open ? 'Read less' : 'Read more';
  });

  mq.addEventListener('change', setStateFromWidth);
}

function setupPageBackButton() {
  if (document.querySelector('.page-back-wrap')) return;
  const footer = document.querySelector('footer.footer');
  if (!footer || !footer.parentNode) return;

  const isGalleryDetail = !!document.querySelector('main.gallery-detail');
  const isBio = document.body.classList.contains('page-bio');
  if (!isGalleryDetail && !isBio) return;

  const href = isGalleryDetail
    ? new URL('../index.html', window.location.href).href
    : new URL('index.html', window.location.href).href;

  const wrap = document.createElement('div');
  wrap.className = 'page-back-wrap';
  const a = document.createElement('a');
  a.href = href;
  a.className = 'nav-button';
  a.textContent = 'Back';
  a.setAttribute('aria-label', 'Back to gallery');
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
}
