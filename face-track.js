(function () {
  const slot = document.getElementById('faceTrackSlot');
  const video = slot && slot.querySelector('.face-track-video');
  const outline = slot && slot.querySelector('.face-track-outline');
  if (!video || !outline) return;

  /** Camera stream is live (user granted access and video is playing). */
  let streamActive = false;
  /** Face detection loop is running (native or BlazeFace). */
  let trackingActive = false;

  /** Latest raw target from detector (clamped to slot). null = no face. */
  let targetBox = null;
  /** Smoothed box actually drawn. */
  let displayBox = null;

  /** Position lerp per frame (desktop / tablet / large viewports — partial centre bias). */
  const SMOOTH_DEFAULT = 0.042;
  /** Phone-only: calmer lerp (see SUBTLE_TRACK_MAX_WIDTH). */
  const SMOOTH_PHONE = 0.012;

  /**
   * Blend face target toward tile centre — only on narrow phone viewports.
   * Lower = outline stays nearer the middle.
   */
  const CENTER_PULL_PHONE = 0.14;

  /**
   * Wider viewports (tablet / desktop): partial follow — outline stays closer to grid centre.
   * 1 = full follow (legacy); lower = less excursion from centre.
   */
  const CENTER_PULL_DESKTOP = 0.5;

  /** Detector low-pass before centre pull — phone-only. */
  const DETECTOR_PRE_SMOOTH_PHONE = 0.22;

  /** Outline stroke: same visual proportion as ~4px on a typical grid tile, all viewports. */
  const OUTLINE_STROKE_MIN = 3;
  const OUTLINE_STROKE_MAX = 14;
  const OUTLINE_STROKE_RATIO = 0.0295;

  /** Matches gallery: larger face box when width ≤ this (phones + iPad portrait). */
  const MOBILE_MAX_WIDTH = 768;

  /**
   * Subtle tracking (centre bias, extra smoothing, detector low-pass) — **phones only**.
   * iPad / desktop use full face follow + default smoothing.
   */
  const SUBTLE_TRACK_MAX_WIDTH = 600;

  function isMobileViewport() {
    return window.innerWidth <= MOBILE_MAX_WIDTH;
  }

  function isSubtleTrackingViewport() {
    return window.innerWidth <= SUBTLE_TRACK_MAX_WIDTH;
  }

  /** How much of the face offset from tile centre to apply (always ≤ 1). */
  function centerPullFactor() {
    if (isSubtleTrackingViewport()) return CENTER_PULL_PHONE;
    return CENTER_PULL_DESKTOP;
  }

  function displaySmoothFactor() {
    return isSubtleTrackingViewport() ? SMOOTH_PHONE : SMOOTH_DEFAULT;
  }

  let lastDetectorSmoothed = null;

  function smoothDetectorBox(box) {
    if (!box) {
      lastDetectorSmoothed = null;
      return null;
    }
    if (!isSubtleTrackingViewport()) {
      lastDetectorSmoothed = null;
      return box;
    }
    const a = DETECTOR_PRE_SMOOTH_PHONE;
    if (!lastDetectorSmoothed) {
      lastDetectorSmoothed = { x: box.x, y: box.y, w: box.w, h: box.h };
      return { ...lastDetectorSmoothed };
    }
    lastDetectorSmoothed = {
      x: lastDetectorSmoothed.x + (box.x - lastDetectorSmoothed.x) * a,
      y: lastDetectorSmoothed.y + (box.y - lastDetectorSmoothed.y) * a,
      w: box.w,
      h: box.h,
    };
    return { ...lastDetectorSmoothed };
  }

  function onGalleryDetail() {
    return Boolean(slot.closest('main.gallery-detail'));
  }

  /** #Surveillancecore detail: native camera slide (first carousel item) — class is detail-only. */
  function isSurveillancecoreDetailNativeSlide() {
    return Boolean(slot.closest('.gallery-detail__carousel-slide--facetrack'));
  }

  function faceBoxFraction() {
    if (window.innerWidth <= MOBILE_MAX_WIDTH) {
      if (onGalleryDetail() && isSurveillancecoreDetailNativeSlide()) {
        return 0.92;
      }
      return onGalleryDetail() ? 0.75 : 0.44;
    }
    /* Desktop: larger square on gallery detail (carousel) vs index grid tile */
    return onGalleryDetail() ? 0.72 : 0.34;
  }

  /** One stroke rule for index + detail: proportional to box, clamped (matches ~4px on typical grid tile). */
  function applyOutlineBorder(size) {
    const px = Math.max(
      OUTLINE_STROKE_MIN,
      Math.min(OUTLINE_STROKE_MAX, Math.round(size * OUTLINE_STROKE_RATIO))
    );
    outline.style.borderWidth = `${px}px`;
    outline.style.borderStyle = 'solid';
    outline.style.borderColor = '#00ff41';
  }

  function placeFallbackBox(W, H) {
    const size = Math.min(W, H) * faceBoxFraction();
    const x = (W - size) / 2;
    const y = (H - size) / 2;
    outline.style.opacity = '1';
    outline.style.left = `${x}px`;
    outline.style.top = `${y}px`;
    outline.style.width = `${size}px`;
    outline.style.height = `${size}px`;
    applyOutlineBorder(size);
  }

  function clampBox(b, W, H) {
    if (!W || !H) return null;
    let w = Math.min(b.w, W);
    let h = Math.min(b.h, H);
    let x = Math.max(0, Math.min(b.x, W - w));
    let y = Math.max(0, Math.min(b.y, H - h));
    return { x, y, w, h };
  }

  /** Fixed square, centered on face; only position updates from detection. */
  function mapFaceToFixedBox(vw, vh, bx, by, bw, bh) {
    const W = slot.clientWidth;
    const H = slot.clientHeight;
    if (!vw || !vh || !W || !H) return null;
    const scale = Math.max(W / vw, H / vh);
    const ox = (W - vw * scale) / 2;
    const oy = (H - vh * scale) / 2;
    const fcx = bx + bw / 2;
    const fcy = by + bh / 2;
    const cx = W - (ox + fcx * scale);
    const cy = oy + fcy * scale;
    const s = Math.min(W, H) * faceBoxFraction();
    return clampBox({ x: cx - s / 2, y: cy - s / 2, w: s, h: s }, W, H);
  }

  function renderLoop() {
    requestAnimationFrame(renderLoop);
    const W = slot.clientWidth;
    const H = slot.clientHeight;
    if (!W || !H) return;

    /* No camera yet, denied, or detector still loading / unavailable: static centered square. */
    if (!streamActive || !trackingActive) {
      displayBox = null;
      placeFallbackBox(W, H);
      return;
    }

    if (!targetBox) {
      displayBox = null;
      if (onGalleryDetail()) {
        placeFallbackBox(W, H);
      } else {
        outline.style.opacity = '0';
      }
      return;
    }

    const t = targetBox;
    const size = Math.min(W, H) * faceBoxFraction();
    const cx = (W - size) / 2;
    const cy = (H - size) / 2;
    const pull = centerPullFactor();
    const tx = cx + (t.x - cx) * pull;
    const ty = cy + (t.y - cy) * pull;
    const smooth = displaySmoothFactor();
    if (!displayBox) {
      displayBox = { x: tx, y: ty, w: size, h: size };
    } else {
      displayBox.x += (tx - displayBox.x) * smooth;
      displayBox.y += (ty - displayBox.y) * smooth;
      displayBox.w = size;
      displayBox.h = size;
    }

    const c = clampBox(displayBox, W, H);
    displayBox = { x: c.x, y: c.y, w: size, h: size };
    outline.style.opacity = '1';
    outline.style.left = `${c.x}px`;
    outline.style.top = `${c.y}px`;
    outline.style.width = `${size}px`;
    outline.style.height = `${size}px`;
    applyOutlineBorder(size);
  }

  function loadScript(src) {
    return new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = src;
      s.onload = resolve;
      s.onerror = reject;
      document.head.appendChild(s);
    });
  }

  let busy;

  function run(detect) {
    function frame() {
      requestAnimationFrame(frame);
      if (!video.videoWidth || busy) return;
      busy = true;
      detect()
        .then((box) => {
          targetBox = smoothDetectorBox(box);
        })
        .catch(() => {})
        .finally(() => {
          busy = false;
        });
    }
    requestAnimationFrame(frame);
  }

  function placeFallbackIfIdle() {
    if (streamActive && trackingActive) return;
    const W = slot.clientWidth;
    const H = slot.clientHeight;
    if (!W || !H) return;
    placeFallbackBox(W, H);
  }

  async function init() {
    requestAnimationFrame(renderLoop);

    if (typeof ResizeObserver !== 'undefined') {
      const ro = new ResizeObserver(() => placeFallbackIfIdle());
      ro.observe(slot);
    }

    requestAnimationFrame(() => {
      requestAnimationFrame(placeFallbackIfIdle);
    });

    try {
      video.srcObject = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 480 } },
        audio: false,
      });
    } catch {
      return;
    }

    await video.play();
    streamActive = true;

    const vw = () => video.videoWidth;
    const vh = () => video.videoHeight;

    if (typeof FaceDetector !== 'undefined') {
      try {
        const det = new FaceDetector({ fastMode: true, maxDetectedFaces: 1 });
        trackingActive = true;
        run(async () => {
          const faces = await det.detect(video);
          if (!faces.length) return null;
          const b = faces[0].boundingBox;
          return mapFaceToFixedBox(vw(), vh(), b.x, b.y, b.width, b.height);
        });
        return;
      } catch (_) {
        /* fall through to BlazeFace */
      }
    }

    try {
      await loadScript('https://cdn.jsdelivr.net/npm/@tensorflow/tfjs@3.21.0/dist/tf.min.js');
      await loadScript(
        'https://cdn.jsdelivr.net/npm/@tensorflow-models/blazeface@0.0.7/dist/blazeface.min.js'
      );
      if (typeof blazeface === 'undefined' || !blazeface.load) throw new Error();
      const model = await blazeface.load();
      trackingActive = true;
      run(async () => {
        const preds = await model.estimateFaces(video, false);
        if (!preds.length) return null;
        const [sx, sy] = preds[0].topLeft;
        const [ex, ey] = preds[0].bottomRight;
        return mapFaceToFixedBox(vw(), vh(), sx, sy, ex - sx, ey - sy);
      });
    } catch {
      /* Camera works but no detector — keep fallback square. */
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
