/**
 * TBI index tile: two-face book, Y rotation, new cover every 180°.
 * One WAAPI clock for rotation + textures so swaps stay at edge-on moments (no visible face is retextured).
 * Cover state from floor(animTime / 4000) % 4 — only the hidden face’s image changes at each 180° boundary.
 * Edge colours: the cover facing the camera paints its left edge; the opposite edge stays paper.
 */
(function initTbiMagazine() {
  const roots = document.querySelectorAll('[data-tbi-magazine]');
  if (!roots.length) return;

  const PAPER = '#f3eee6';

  function sampleLeftEdgeColor(img) {
    try {
      const w = img.naturalWidth || img.width;
      const h = img.naturalHeight || img.height;
      if (!w || !h) return null;
      const canvas = document.createElement('canvas');
      /* Skip any anti-aliased / white fringe on the absolute left of the PNG */
      const x0 = Math.max(1, Math.round(w * 0.02));
      const strip = Math.max(2, Math.round(w * 0.04));
      canvas.width = strip;
      canvas.height = Math.min(h, 256);
      const ctx = canvas.getContext('2d', { willReadFrequently: true });
      if (!ctx) return null;
      ctx.drawImage(img, x0, 0, strip, h, 0, 0, strip, canvas.height);
      const data = ctx.getImageData(0, 0, strip, canvas.height).data;
      let r = 0;
      let g = 0;
      let b = 0;
      let n = 0;
      for (let i = 0; i < data.length; i += 4) {
        /* Ignore near-white pixels so fringe doesn't wash / stripe the spine */
        if (data[i] > 245 && data[i + 1] > 245 && data[i + 2] > 245) continue;
        r += data[i];
        g += data[i + 1];
        b += data[i + 2];
        n += 1;
      }
      if (!n) return null;
      return (
        '#' +
        [r, g, b]
          .map((v) => Math.round(v / n).toString(16).padStart(2, '0'))
          .join('')
      );
    } catch {
      return null;
    }
  }

  function loadCover(url) {
    return new Promise((resolve) => {
      const img = new Image();
      img.decoding = 'async';
      img.onload = () => resolve(img);
      img.onerror = () => resolve(null);
      img.src = url;
    });
  }

  roots.forEach((root) => {
    const book = root.querySelector('.gallery-magazine-3d__book');
    const front = root.querySelector('.gallery-magazine-3d__face--front');
    const back = root.querySelector('.gallery-magazine-3d__face--back');
    if (!book || !front || !back) return;

    const raw = root.getAttribute('data-asset-base') || 'files';
    const base = raw.replace(/\/$/, '') + '/tbi-magazine-cover-';
    const coverColors = ['#8ab6e1', '#e1e54d', '#73c169', '#f06d39'];

    const setBg = (el, n) => {
      el.style.backgroundImage = 'url("' + base + n + '.png")';
    };

    let frontCover = 1;
    let backCover = 2;

    /** Left-of-viewer edge = cover colour; opposite edge = paper. Depends on which face is toward the camera. */
    function applyEdgeColors(frontFacing) {
      if (frontFacing) {
        book.style.setProperty('--magazine-spine-color', coverColors[frontCover - 1] || PAPER);
        book.style.setProperty('--magazine-fore-color', PAPER);
        book.dataset.magazineEdgeMode = 'front';
      } else {
        book.style.setProperty('--magazine-spine-color', PAPER);
        book.style.setProperty('--magazine-fore-color', coverColors[backCover - 1] || PAPER);
        book.dataset.magazineEdgeMode = 'back';
      }
    }

    Promise.all([1, 2, 3, 4].map((n) => loadCover(base + n + '.png'))).then((images) => {
      images.forEach((img, i) => {
        if (!img) return;
        const sampled = sampleLeftEdgeColor(img);
        if (sampled) coverColors[i] = sampled;
      });
      applyEdgeColors(true);
    });

    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setBg(front, 1);
      setBg(back, 2);
      frontCover = 1;
      backCover = 2;
      applyEdgeColors(true);
      return;
    }

    if (typeof book.animate !== 'function') {
      setBg(front, 1);
      setBg(back, 2);
      frontCover = 1;
      backCover = 2;
      applyEdgeColors(true);
      return;
    }

    const DURATION_MS = 9200;
    /** 0,1,2,3: which cover (0..3) on front / back for that 4s segment */
    const FRONT = [0, 2, 2, 0];
    const BACK = [1, 1, 3, 3];

    const anim = book.animate(
      [{ transform: 'rotateY(0deg)' }, { transform: 'rotateY(-360deg)' }],
      { duration: DURATION_MS, iterations: Number.POSITIVE_INFINITY, easing: 'linear' }
    );

    let lastK = -1;

    function applySegment(k) {
      frontCover = FRONT[k] + 1;
      backCover = BACK[k] + 1;
      setBg(front, frontCover);
      setBg(back, backCover);
    }

    function frame() {
      const t = Math.max(0, anim.currentTime || 0);
      const k = Math.floor(t / (DURATION_MS / 2)) % 4;
      if (k !== lastK) {
        lastK = k;
        applySegment(k);
      }

      /* Book rotates Y from 0 → -360. Front faces camera when |angle| near 0/360; back near 180. */
      const turns = (t / DURATION_MS) % 1;
      const angleRad = turns * Math.PI * 2;
      const frontFacing = Math.cos(angleRad) >= 0;
      applyEdgeColors(frontFacing);

      requestAnimationFrame(frame);
    }

    applySegment(0);
    lastK = 0;
    applyEdgeColors(true);
    requestAnimationFrame(frame);
  });
})();
