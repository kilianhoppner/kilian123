(() => {
  // Play is desktop-only — send phones/tablets back to the gallery
  if (window.matchMedia('(max-width: 768px)').matches) {
    window.location.replace('index.html');
    return;
  }

  const root = document.querySelector('.play-snake');
  const canvas = document.querySelector('.play-snake__canvas');
  if (!root || !canvas) return;

  const ctx = canvas.getContext('2d');
  const scoreEl = root.querySelector('[data-snake-score]');

  const COLS = 20;
  const ROWS = 20;
  const TICK_MS = 110;
  const BG = '#f3f3f3';
  const GRID = '#e4e4e4';
  const SNAKE = '#2ce02c';
  const HEAD = '#1aa81a';
  const FOOD = '#ff00d9';

  /** @type {{ x: number, y: number }[]} */
  let snake = [];
  /** @type {{ x: number, y: number }} */
  let food = { x: 0, y: 0 };
  /** @type {{ x: number, y: number }} */
  let dir = { x: 1, y: 0 };
  /** @type {{ x: number, y: number }} */
  let pendingDir = { x: 1, y: 0 };
  let score = 0;
  let alive = true;
  let started = false;
  let timer = 0;
  let cell = 20;
  let restartTimer = 0;

  function resize() {
    const stage = canvas.parentElement;
    if (!stage) return;
    const rect = stage.getBoundingClientRect();
    const size = Math.max(1, Math.floor(Math.min(rect.width, rect.height)));
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.style.width = `${size}px`;
    canvas.style.height = `${size}px`;
    canvas.width = Math.round(size * dpr);
    canvas.height = Math.round(size * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    cell = size / COLS;
    draw();
  }

  /** Size the board so nav + score + board + footer fit in the viewport (no scroll). */
  function fitStageToViewport() {
    const stage = canvas.parentElement;
    const topBar = document.querySelector('.top-bar');
    const footer = document.querySelector('footer.footer');
    const score = root.querySelector('.play-snake__score');
    if (!stage || !topBar || !footer) return;

    const bodyStyles = getComputedStyle(document.body);
    const mainStyles = getComputedStyle(root);
    const bodyMarginTop = parseFloat(bodyStyles.marginTop) || 0;
    const mainMarginTop = parseFloat(mainStyles.marginTop) || 0;
    const gap = parseFloat(mainStyles.gap) || 0;
    const desktop = window.matchMedia('(min-width: 769px)').matches;

    const chrome =
      bodyMarginTop +
      topBar.offsetHeight +
      mainMarginTop +
      (score ? score.offsetHeight : 0) +
      gap +
      footer.offsetHeight +
      (desktop ? 56 : 12);

    const maxByHeight = Math.floor(window.innerHeight - chrome);
    const maxByWidth = Math.floor(root.clientWidth || window.innerWidth);
    let size = Math.max(120, Math.min(maxByHeight, maxByWidth));
    if (desktop) size = Math.floor(size * 0.9);

    stage.style.width = `${size}px`;
    stage.style.height = `${size}px`;
    resize();
  }

  function startGame() {
    if (!alive) return;
    started = true;
    schedule();
  }

  function randomEmptyCell() {
    const taken = new Set(snake.map((p) => `${p.x},${p.y}`));
    const free = [];
    for (let y = 0; y < ROWS; y += 1) {
      for (let x = 0; x < COLS; x += 1) {
        const key = `${x},${y}`;
        if (!taken.has(key)) free.push({ x, y });
      }
    }
    if (!free.length) return { x: 0, y: 0 };
    return free[Math.floor(Math.random() * free.length)];
  }

  function reset() {
    window.clearTimeout(restartTimer);
    const midY = Math.floor(ROWS / 2);
    snake = [
      { x: 5, y: midY },
      { x: 4, y: midY },
      { x: 3, y: midY },
    ];
    dir = { x: 1, y: 0 };
    pendingDir = { x: 1, y: 0 };
    food = randomEmptyCell();
    score = 0;
    alive = true;
    window.clearInterval(timer);
    if (scoreEl) scoreEl.textContent = '0';
    draw();
    startGame();
  }

  function setDir(nx, ny) {
    if (!alive) {
      reset();
      // reset already starts; still apply new direction
    }
    if (nx === -dir.x && ny === -dir.y) return;
    pendingDir = { x: nx, y: ny };
    if (!started) startGame();
  }

  function schedule() {
    window.clearInterval(timer);
    timer = window.setInterval(tick, TICK_MS);
  }

  function gameOver() {
    alive = false;
    window.clearInterval(timer);
    restartTimer = window.setTimeout(reset, 900);
  }

  function tick() {
    if (!alive) return;
    dir = pendingDir;
    const head = snake[0];
    const next = { x: head.x + dir.x, y: head.y + dir.y };

    if (next.x < 0 || next.y < 0 || next.x >= COLS || next.y >= ROWS) {
      gameOver();
      draw();
      return;
    }
    if (snake.some((p) => p.x === next.x && p.y === next.y)) {
      gameOver();
      draw();
      return;
    }

    snake.unshift(next);
    if (next.x === food.x && next.y === food.y) {
      score += 1;
      if (scoreEl) scoreEl.textContent = String(score);
      food = randomEmptyCell();
    } else {
      snake.pop();
    }
    draw();
  }

  function draw() {
    const size = cell * COLS;
    ctx.fillStyle = BG;
    ctx.fillRect(0, 0, size, size);

    ctx.strokeStyle = GRID;
    ctx.lineWidth = 1;
    for (let i = 0; i <= COLS; i += 1) {
      const p = i * cell;
      ctx.beginPath();
      ctx.moveTo(p, 0);
      ctx.lineTo(p, size);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(0, p);
      ctx.lineTo(size, p);
      ctx.stroke();
    }

    ctx.fillStyle = FOOD;
    ctx.fillRect(food.x * cell + 1, food.y * cell + 1, cell - 2, cell - 2);

    snake.forEach((p, i) => {
      ctx.fillStyle = i === 0 ? HEAD : SNAKE;
      ctx.fillRect(p.x * cell + 1, p.y * cell + 1, cell - 2, cell - 2);
    });
  }

  function onKey(e) {
    const map = {
      ArrowUp: [0, -1],
      ArrowDown: [0, 1],
      ArrowLeft: [-1, 0],
      ArrowRight: [1, 0],
      w: [0, -1],
      W: [0, -1],
      s: [0, 1],
      S: [0, 1],
      a: [-1, 0],
      A: [-1, 0],
      d: [1, 0],
      D: [1, 0],
    };
    const next = map[e.key];
    if (!next) return;
    e.preventDefault();
    setDir(next[0], next[1]);
  }

  let touchStart = null;
  function onTouchStart(e) {
    const t = e.changedTouches[0];
    if (!t) return;
    touchStart = { x: t.clientX, y: t.clientY };
  }
  function onTouchEnd(e) {
    if (!touchStart) return;
    const t = e.changedTouches[0];
    if (!t) return;
    const dx = t.clientX - touchStart.x;
    const dy = t.clientY - touchStart.y;
    touchStart = null;
    if (Math.abs(dx) < 24 && Math.abs(dy) < 24) return;
    if (Math.abs(dx) > Math.abs(dy)) setDir(dx > 0 ? 1 : -1, 0);
    else setDir(0, dy > 0 ? 1 : -1);
  }

  window.addEventListener('keydown', onKey);
  canvas.addEventListener('touchstart', onTouchStart, { passive: true });
  canvas.addEventListener('touchend', onTouchEnd, { passive: true });

  let resizeTimer = 0;
  function onViewportChange() {
    window.clearTimeout(resizeTimer);
    resizeTimer = window.setTimeout(fitStageToViewport, 50);
  }
  window.addEventListener('resize', onViewportChange);

  reset();
  fitStageToViewport();
  requestAnimationFrame(fitStageToViewport);
})();
