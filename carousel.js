/**
 * Gallery detail carousels (infinite loop): any [data-infinite-carousel] with
 * .gallery-detail__carousel-track slides. Used on #Surveillancecore, Weather Room, dollhouse,
 * t-shirt, Nonsense, Take it slow, Hammersmith Flyover UV, globe sphere + Triangle, TACO, I love daddy, Daddy's Girl, etc. Clone last slide before first and first after last so wrap always
 * animates one step, then the track jumps invisibly to the real slide.
 * Life Cycles: recycling arrows + White Book edit (images only).
 * Dollhouse: #sketch opens on the ink-sketch slide (by class).
 * Any carousel: #slide-1 … #slide-N (1-based) opens that slide — use from gallery index when
 * multiple tiles share one detail URL.
 */
(function () {
  function slideEls(track) {
    return Array.from(track.querySelectorAll(':scope > .gallery-detail__carousel-slide'));
  }

  function stripFaceTrackClone(cloneRoot) {
    var slot = cloneRoot.querySelector('.face-track-slot#faceTrackSlot');
    if (slot) {
      slot.removeAttribute('id');
    }
    slot = cloneRoot.querySelector('.face-track-slot');
    if (slot) {
      slot.setAttribute('aria-hidden', 'true');
      slot.classList.add('face-track-slot--carousel-clone');
    }
    var v = cloneRoot.querySelector('.face-track-video');
    if (v) {
      v.removeAttribute('id');
      v.removeAttribute('autoplay');
    }
  }

  /** Infinite-loop clones must not re-run Three.js on [data-globe-sphere-three]. */
  function stripGlobeSphereCarouselClone(cloneRoot) {
    cloneRoot.querySelectorAll('[data-globe-sphere-three]').forEach(function (mount) {
      mount.removeAttribute('data-globe-sphere-three');
      mount.innerHTML = '';
      mount.setAttribute('aria-hidden', 'true');
      mount.classList.add('gallery-globe-sphere--carousel-clone');
    });
  }

  /** Carousel loop clones must not instantiate a second model-viewer (self-portrait GLB). */
  function stripModelViewerCarouselClone(cloneRoot) {
    cloneRoot.querySelectorAll('model-viewer').forEach(function (mv) {
      var ph = document.createElement('div');
      ph.className = 'gallery-detail__model-viewer--carousel-clone-placeholder';
      ph.setAttribute('aria-hidden', 'true');
      mv.replaceWith(ph);
    });
  }

  function syncSurveillanceEmbedForSlide(root, originals, logicalIndex) {
    var slide = originals[logicalIndex];
    var embed = slide && slide.querySelector('.surveillance-embed');
    if (!embed) return;
    if (embed.dataset.carouselWasActive === '1') {
      embed.classList.add('surveillance-embed--camera-active');
      return;
    }
    if (embed.classList.contains('surveillance-embed--camera-active')) {
      return;
    }
    embed.classList.remove('surveillance-embed--camera-active');
    if (typeof window.armSurveillanceEmbedFallback === 'function') {
      window.armSurveillanceEmbedFallback(embed);
    }
  }

  function prefersReducedMotion() {
    return window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  }

  function pauseCarouselVideos(track) {
    if (!track) return;
    track.querySelectorAll('video').forEach(function (v) {
      v.pause();
    });
  }

  function init(root) {
    var track = root.querySelector('.gallery-detail__carousel-track');
    var viewport = root.querySelector('.gallery-detail__carousel-viewport');
    var prevBtn = root.querySelector('.gallery-detail__carousel-nav--prev');
    var nextBtn = root.querySelector('.gallery-detail__carousel-nav--next');
    if (!track || !viewport || !prevBtn || !nextBtn) return;

    var originals = slideEls(track);
    var realN = originals.length;
    if (realN < 2) return;

    var lastClone = originals[realN - 1].cloneNode(true);
    var firstClone = originals[0].cloneNode(true);
    stripFaceTrackClone(firstClone);
    stripGlobeSphereCarouselClone(lastClone);
    stripGlobeSphereCarouselClone(firstClone);
    stripModelViewerCarouselClone(lastClone);
    stripModelViewerCarouselClone(firstClone);

    track.insertBefore(lastClone, originals[0]);
    track.appendChild(firstClone);

    var trackIndex = 1;
    var isDollhouse = root.closest && root.closest('main.gallery-detail--dollhouse');
    var hash = typeof location !== 'undefined' ? location.hash || '' : '';
    if (isDollhouse && /^#sketch$/i.test(hash)) {
      var sketchSlideIdx = -1;
      for (var si = 0; si < originals.length; si++) {
        if (originals[si].classList.contains('gallery-detail__carousel-slide--dollhouse-sketch')) {
          sketchSlideIdx = si;
          break;
        }
      }
      if (sketchSlideIdx >= 0) {
        trackIndex = sketchSlideIdx + 1;
      }
    } else {
      var slideHash = /^#slide-(\d+)$/i.exec(hash);
      if (slideHash) {
        var slideNum = parseInt(slideHash[1], 10);
        if (slideNum >= 1 && slideNum <= realN) {
          trackIndex = slideNum;
        }
      }
    }
    var locked = false;

    function logicalFromTrackIndex(ti) {
      if (ti === 0) return realN - 1;
      if (ti === realN + 1) return 0;
      return ti - 1;
    }

    function slideWidth() {
      return viewport.getBoundingClientRect().width || 0;
    }

    function applyTransform(animated) {
      var w = slideWidth();
      if (!w) {
        if (animated) locked = false;
        return;
      }
      track.classList.toggle('gallery-detail__carousel-track--no-transition', !animated);
      track.style.transform = 'translateX(' + -trackIndex * w + 'px)';
    }

    function bindIfNeeded() {
      if (typeof window.bindSurveillanceIframePlaceholders === 'function') {
        window.bindSurveillanceIframePlaceholders(root);
      }
    }

    function syncFromTrackIndex() {
      syncSurveillanceEmbedForSlide(root, originals, logicalFromTrackIndex(trackIndex));
      bindIfNeeded();
    }

    function triggerViewportSlideFade() {
      if (prefersReducedMotion()) return;
      viewport.classList.remove('gallery-detail__carousel-viewport--fading');
      void viewport.offsetWidth;
      viewport.classList.add('gallery-detail__carousel-viewport--fading');
    }

    viewport.addEventListener('animationend', function (e) {
      if (e.target !== viewport) return;
      if (e.animationName !== 'gallery-detail-carousel-viewport-fade') return;
      viewport.classList.remove('gallery-detail__carousel-viewport--fading');
    });

    function go(delta) {
      if (locked) return;
      pauseCarouselVideos(track);
      var prevTi = trackIndex;
      trackIndex += delta;
      if (trackIndex < 0) trackIndex = 0;
      if (trackIndex > realN + 1) trackIndex = realN + 1;

      var prevLogical = logicalFromTrackIndex(prevTi);
      var prevSlide = originals[prevLogical];
      var prevEmbed = prevSlide && prevSlide.querySelector('.surveillance-embed');
      if (prevEmbed) {
        prevEmbed.dataset.carouselWasActive = prevEmbed.classList.contains(
          'surveillance-embed--camera-active'
        )
          ? '1'
          : '0';
        prevEmbed.classList.remove('surveillance-embed--camera-active');
      }

      syncFromTrackIndex();

      if (prefersReducedMotion()) {
        if (trackIndex === 0) trackIndex = realN;
        else if (trackIndex === realN + 1) trackIndex = 1;
        applyTransform(false);
        syncFromTrackIndex();
        return;
      }

      locked = true;
      triggerViewportSlideFade();
      applyTransform(true);
    }

    track.addEventListener('transitionend', function (e) {
      if (e.target !== track || e.propertyName !== 'transform') return;
      if (trackIndex === 0) {
        trackIndex = realN;
        applyTransform(false);
        syncFromTrackIndex();
      } else if (trackIndex === realN + 1) {
        trackIndex = 1;
        applyTransform(false);
        syncFromTrackIndex();
      }
      locked = false;
    });

    prevBtn.addEventListener('click', function () {
      go(-1);
    });
    nextBtn.addEventListener('click', function () {
      go(1);
    });

    window.addEventListener(
      'resize',
      function () {
        applyTransform(false);
      },
      { passive: true }
    );

    if (typeof ResizeObserver !== 'undefined') {
      var ro = new ResizeObserver(function () {
        applyTransform(false);
      });
      ro.observe(viewport);
    }

    applyTransform(false);
    syncFromTrackIndex();
    bindIfNeeded();
  }

  function boot() {
    document.querySelectorAll('[data-infinite-carousel]').forEach(init);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
