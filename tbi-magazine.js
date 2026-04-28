/**
 * TBI index tile: two-face book, Y rotation, new cover every 180°.
 * One WAAPI clock for rotation + textures so swaps stay at edge-on moments (no visible face is retextured).
 * Cover state from floor(animTime / 4000) % 4 — only the hidden face’s image changes at each 180° boundary.
 */
(function initTbiMagazine() {
  const root = document.querySelector('[data-tbi-magazine]');
  if (!root) return;

  const book = root.querySelector('.gallery-magazine-3d__book');
  const front = root.querySelector('.gallery-magazine-3d__face--front');
  const back = root.querySelector('.gallery-magazine-3d__face--back');
  if (!book || !front || !back) return;

  const raw = root.getAttribute('data-asset-base') || 'files';
  const base = raw.replace(/\/$/, '') + '/tbi-magazine-cover-';
  const setBg = (el, n) => {
    el.style.backgroundImage = 'url("' + base + n + '.png")';
  };

  for (let n = 1; n <= 4; n += 1) {
    const img = new Image();
    img.src = base + n + '.png';
  }

  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    setBg(front, 1);
    setBg(back, 2);
    return;
  }

  if (typeof book.animate !== 'function') {
    setBg(front, 1);
    setBg(back, 2);
    return;
  }

  const DURATION_MS = 9200;
  /** 0,1,2,3: which cover (0..3) on front / back for that 4s segment */
  const FRONT = [0, 2, 2, 0];
  const BACK = [1, 1, 3, 3];

  const anim = book.animate(
    [{ transform: 'rotateY(0deg)' }, { transform: 'rotateY(360deg)' }],
    { duration: DURATION_MS, iterations: Number.POSITIVE_INFINITY, easing: 'linear' }
  );

  let lastK = -1;

  function applySegment(k) {
    setBg(front, FRONT[k] + 1);
    setBg(back, BACK[k] + 1);
  }

  function frame() {
    const t = Math.max(0, anim.currentTime || 0);
    const k = Math.floor(t / (DURATION_MS / 2)) % 4;
    if (k !== lastK) {
      lastK = k;
      applySegment(k);
    }
    requestAnimationFrame(frame);
  }

  applySegment(0);
  lastK = 0;
  requestAnimationFrame(frame);
})();
