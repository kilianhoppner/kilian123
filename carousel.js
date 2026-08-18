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

  /** Nonsense + The Big Issue: one live magazine/3D; strip hook + cancel WAAPI on wrap clones. */
  function stripTbiMagazineCarouselClone(cloneRoot) {
    var root = cloneRoot.querySelector('[data-tbi-magazine]');
    if (!root) return;
    root.removeAttribute('data-tbi-magazine');
    var book = root.querySelector('.gallery-magazine-3d__book');
    if (book && book.getAnimations) {
      book.getAnimations().forEach(function (a) {
        a.cancel();
      });
    }
  }

  /**
   * TBI carousel wrap clone should visually match the live slide before transition.
   * WAAPI transforms aren't cloned as inline styles, so copy computed transform + face textures.
   */
  function syncTbiMagazineCloneVisual(sourceSlide, cloneSlide) {
    if (!sourceSlide || !cloneSlide) return;
    var srcBook = sourceSlide.querySelector('.gallery-magazine-3d__book');
    var cloneBook = cloneSlide.querySelector('.gallery-magazine-3d__book');
    if (srcBook && cloneBook) {
      var t = window.getComputedStyle(srcBook).transform;
      cloneBook.style.transform = t && t !== 'none' ? t : '';
    }

    var srcFront = sourceSlide.querySelector('.gallery-magazine-3d__face--front');
    var srcBack = sourceSlide.querySelector('.gallery-magazine-3d__face--back');
    var cloneFront = cloneSlide.querySelector('.gallery-magazine-3d__face--front');
    var cloneBack = cloneSlide.querySelector('.gallery-magazine-3d__face--back');
    if (srcFront && cloneFront) {
      var frontBg = srcFront.style.backgroundImage || window.getComputedStyle(srcFront).backgroundImage;
      cloneFront.style.backgroundImage = frontBg;
    }
    if (srcBack && cloneBack) {
      var backBg = srcBack.style.backgroundImage || window.getComputedStyle(srcBack).backgroundImage;
      cloneBack.style.backgroundImage = backBg;
    }
  }

  /**
   * During wrap animation, keep clone in lockstep with the live TBI slide so it doesn't appear static.
   * Returns a stop function.
   */
  function followTbiMagazineCloneVisual(sourceSlide, cloneSlide) {
    var rafId = 0;
    var stopped = false;

    function tick() {
      if (stopped) return;
      syncTbiMagazineCloneVisual(sourceSlide, cloneSlide);
      rafId = window.requestAnimationFrame(tick);
    }

    tick();
    return function stop() {
      stopped = true;
      if (rafId) {
        window.cancelAnimationFrame(rafId);
      }
    };
  }

  /**
   * White Horse carousel: keep wrap clone video in sync so infinite wrap doesn't look like a refresh.
   */
  function syncWhitehorseVideoClone(sourceSlide, cloneSlide) {
    if (!sourceSlide || !cloneSlide) return;
    var srcVideos = sourceSlide.querySelectorAll('.gallery-detail__video-slot video');
    var cloneVideos = cloneSlide.querySelectorAll('.gallery-detail__video-slot video');
    if (!srcVideos.length || !cloneVideos.length) return;

    var activeIdx = 0;
    for (var i = 0; i < srcVideos.length; i++) {
      if (srcVideos[i].classList.contains('gallery-detail__video--active')) {
        activeIdx = i;
        break;
      }
    }
    var srcActive = srcVideos[activeIdx] || srcVideos[0];
    var t = srcActive.currentTime || 0;
    var rate = srcActive.playbackRate || 1;
    var paused = !!srcActive.paused;

    cloneVideos.forEach(function (v, idx) {
      try {
        v.currentTime = t;
      } catch (e) {}
      v.defaultPlaybackRate = rate;
      v.playbackRate = rate;
      if (idx === activeIdx) v.classList.add('gallery-detail__video--active');
      else v.classList.remove('gallery-detail__video--active');
      if (paused) {
        v.pause();
      } else {
        var p = v.play();
        if (p && typeof p.catch === 'function') p.catch(function () {});
      }
    });
  }

  function followWhitehorseVideoClone(sourceSlide, cloneSlide) {
    var rafId = 0;
    var stopped = false;
    function tick() {
      if (stopped) return;
      syncWhitehorseVideoClone(sourceSlide, cloneSlide);
      rafId = window.requestAnimationFrame(tick);
    }
    tick();
    return function stop() {
      stopped = true;
      if (rafId) window.cancelAnimationFrame(rafId);
    };
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

  /** Infinite-loop clones must not spin up a second Garden House Three.js viewer. */
  function stripGardenhouseCarouselClone(cloneRoot) {
    cloneRoot.querySelectorAll('[data-gardenhouse-init]').forEach(function (mount) {
      mount.removeAttribute('data-gardenhouse-init');
      mount.innerHTML = '';
      mount.setAttribute('aria-hidden', 'true');
      mount.classList.add('gallery-gardenhouse-3d__viewer--carousel-clone');
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
    var finiteCarousel = root.hasAttribute('data-finite-carousel');

    var lastClone = null;
    var firstClone = null;
    if (!finiteCarousel) {
      lastClone = originals[realN - 1].cloneNode(true);
      firstClone = originals[0].cloneNode(true);
      stripFaceTrackClone(firstClone);
      stripGlobeSphereCarouselClone(lastClone);
      stripGlobeSphereCarouselClone(firstClone);
      stripModelViewerCarouselClone(lastClone);
      stripModelViewerCarouselClone(firstClone);
      stripGardenhouseCarouselClone(lastClone);
      stripGardenhouseCarouselClone(firstClone);
      stripTbiMagazineCarouselClone(firstClone);
      stripTbiMagazineCarouselClone(lastClone);
      syncTbiMagazineCloneVisual(originals[0], firstClone);
      syncTbiMagazineCloneVisual(originals[realN - 1], lastClone);

      track.insertBefore(lastClone, originals[0]);
      track.appendChild(firstClone);
    }

    var trackIndex = finiteCarousel ? 0 : 1;
    var stopTbiCloneFollow = null;
    var stopWhitehorseCloneFollow = null;
    var isDollhouse = root.closest && root.closest('main.gallery-detail--dollhouse');
    var isWhitehorse = root.closest && root.closest('main.gallery-detail--whitehorse');
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
          trackIndex = finiteCarousel ? slideNum - 1 : slideNum;
        }
      }
    }
    var locked = false;

    function logicalFromTrackIndex(ti) {
      if (finiteCarousel) return Math.max(0, Math.min(realN - 1, ti));
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

    function applyDragTransform(deltaX) {
      var w = slideWidth();
      if (!w) return;
      track.classList.add('gallery-detail__carousel-track--no-transition');
      track.style.transform = 'translateX(' + (-trackIndex * w + deltaX) + 'px)';
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
      if (locked) return false;
      if (stopTbiCloneFollow) {
        stopTbiCloneFollow();
        stopTbiCloneFollow = null;
      }
      if (stopWhitehorseCloneFollow) {
        stopWhitehorseCloneFollow();
        stopWhitehorseCloneFollow = null;
      }
      if (!isWhitehorse) {
        pauseCarouselVideos(track);
      }
      var prevTi = trackIndex;
      trackIndex += delta;
      if (finiteCarousel) {
        if (trackIndex < 0) trackIndex = 0;
        if (trackIndex > realN - 1) trackIndex = realN - 1;
        if (trackIndex === prevTi) return false;
      } else {
        if (trackIndex < 0) trackIndex = 0;
        if (trackIndex > realN + 1) trackIndex = realN + 1;
      }

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
        if (!finiteCarousel) {
          if (trackIndex === 0) trackIndex = realN;
          else if (trackIndex === realN + 1) trackIndex = 1;
        }
        applyTransform(false);
        syncFromTrackIndex();
        return true;
      }

      if (!finiteCarousel && trackIndex === realN + 1) {
        syncTbiMagazineCloneVisual(originals[0], firstClone);
        stopTbiCloneFollow = followTbiMagazineCloneVisual(originals[0], firstClone);
        if (isWhitehorse) {
          syncWhitehorseVideoClone(originals[0], firstClone);
          stopWhitehorseCloneFollow = followWhitehorseVideoClone(originals[0], firstClone);
        }
      } else if (!finiteCarousel && trackIndex === 0) {
        syncTbiMagazineCloneVisual(originals[realN - 1], lastClone);
        stopTbiCloneFollow = followTbiMagazineCloneVisual(originals[realN - 1], lastClone);
        if (isWhitehorse) {
          syncWhitehorseVideoClone(originals[realN - 1], lastClone);
          stopWhitehorseCloneFollow = followWhitehorseVideoClone(originals[realN - 1], lastClone);
        }
      }

      locked = true;
      triggerViewportSlideFade();
      applyTransform(true);
      return true;
    }

    track.addEventListener('transitionend', function (e) {
      if (e.target !== track || e.propertyName !== 'transform') return;
      if (stopTbiCloneFollow) {
        stopTbiCloneFollow();
        stopTbiCloneFollow = null;
      }
      if (stopWhitehorseCloneFollow) {
        stopWhitehorseCloneFollow();
        stopWhitehorseCloneFollow = null;
      }
      if (!finiteCarousel && trackIndex === 0) {
        trackIndex = realN;
        applyTransform(false);
        syncFromTrackIndex();
      } else if (!finiteCarousel && trackIndex === realN + 1) {
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

    var drag = {
      active: false,
      pointerId: null,
      startX: 0,
      startY: 0,
      lastX: 0,
      lastY: 0,
      moved: false,
      horizontal: false
    };

    function resetDrag() {
      drag.active = false;
      drag.pointerId = null;
      drag.startX = 0;
      drag.startY = 0;
      drag.lastX = 0;
      drag.lastY = 0;
      drag.moved = false;
      drag.horizontal = false;
    }

    function onPointerDown(e) {
      if (locked) return;
      if (e.button != null && e.button !== 0) return;
      if (e.target && e.target.closest && e.target.closest('.gallery-detail__carousel-nav')) return;
      drag.active = true;
      drag.pointerId = e.pointerId;
      drag.startX = e.clientX;
      drag.startY = e.clientY;
      drag.lastX = e.clientX;
      drag.lastY = e.clientY;
      drag.moved = false;
      drag.horizontal = false;
      if (viewport.setPointerCapture) {
        try {
          viewport.setPointerCapture(e.pointerId);
        } catch (err) {}
      }
    }

    function onPointerMove(e) {
      if (!drag.active || e.pointerId !== drag.pointerId) return;
      var dx = e.clientX - drag.startX;
      var dy = e.clientY - drag.startY;
      drag.lastX = e.clientX;
      drag.lastY = e.clientY;
      if (!drag.horizontal && Math.abs(dx) > 8 && Math.abs(dx) > Math.abs(dy) * 1.15) {
        drag.horizontal = true;
      }
      if (!drag.horizontal) return;
      e.preventDefault();
      drag.moved = Math.abs(dx) > 4;
      applyDragTransform(dx);
    }

    function onPointerEnd(e) {
      if (!drag.active || e.pointerId !== drag.pointerId) return;
      var dx = drag.lastX - drag.startX;
      var w = slideWidth();
      var threshold = Math.min(96, Math.max(42, w * 0.14));
      var shouldAdvance = drag.horizontal && Math.abs(dx) >= threshold;
      var delta = dx < 0 ? 1 : -1;
      var wasMoved = drag.moved;
      resetDrag();
      if (viewport.releasePointerCapture) {
        try {
          viewport.releasePointerCapture(e.pointerId);
        } catch (err) {}
      }
      if (shouldAdvance) {
        if (!go(delta)) {
          applyTransform(true);
        }
      } else {
        applyTransform(true);
      }
      if (wasMoved) {
        root.addEventListener(
          'click',
          function preventDraggedClick(clickEvent) {
            clickEvent.preventDefault();
            clickEvent.stopPropagation();
          },
          { capture: true, once: true }
        );
      }
    }

    viewport.addEventListener('pointerdown', onPointerDown);
    viewport.addEventListener('pointermove', onPointerMove);
    viewport.addEventListener('pointerup', onPointerEnd);
    viewport.addEventListener('pointercancel', onPointerEnd);
    viewport.addEventListener('dragstart', function (e) {
      e.preventDefault();
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
