(function () {
  const canvas = document.getElementById('corralCanvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');

  const ROUNDS = [
    {
      particleCount: 250,
      brownian:      0.3,
      damping:       0.96,
      attractForce:  0.9,
      attractRadius: 130,
      collidePush:   0.2,
      crowdForce:    0.0,
    },
    {
      particleCount: 350,
      brownian:      0.5,
      damping:       0.955,
      attractForce:  0.7,
      attractRadius: 110,
      collidePush:   0.4,
      crowdForce:    0.15,
    },
    {
      particleCount: 450,
      brownian:      0.7,
      damping:       0.95,
      attractForce:  0.55,
      attractRadius: 95,
      collidePush:   0.5,
      crowdForce:    0.3,
    },
  ];

  const TOTAL_ROUNDS    = ROUNDS.length;
  const TARGET_RADIUS   = 26;
  const WALKER_RADIUS   = 4;
  const DOT_RADIUS_BASE = 2;
  const CAPTURE_DIST    = TARGET_RADIUS + WALKER_RADIUS;
  const CROWD_RANGE     = 40;

  const ACCENT       = '#FF47E9';
  const DOT_COLOR    = 'rgba(0,0,0,0.12)';
  const WALKER_COLOR = ACCENT;
  const TARGET_COLOR = ACCENT;

  let W = 0, H = 0;
  let particles = [];
  let walker = null;
  let target = { x: 0, y: 0 };
  let mouseX = 0, mouseY = 0;
  let mouseHeld = false;

  let currentRound = 0;
  let roundSolved  = false;
  let allSolved    = false;
  let imploding    = false;
  let implodeStart = 0;
  const IMPLODE_DUR = 1200;

  let cfg = ROUNDS[0];

  function resize() {
    const container = canvas.parentElement;
    const oldW = W || 1;
    const oldH = H || 1;
    W = container.clientWidth;
    H = container.clientHeight;
    const dpr = Math.min(window.devicePixelRatio, 2);
    canvas.width = W * dpr;
    canvas.height = H * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    if (particles.length && oldW > 1 && oldH > 1) {
      const sx = W / oldW;
      const sy = H / oldH;
      for (const p of particles) {
        p.x *= sx;
        p.y *= sy;
      }
      if (walker) {
        walker.x *= sx;
        walker.y *= sy;
      }
      target.x *= sx;
      target.y *= sy;
    }
  }

  function initRound() {
    cfg = ROUNDS[currentRound];
    roundSolved = false;

    target.x = W * 0.2 + Math.random() * W * 0.6;
    target.y = H * 0.2 + Math.random() * H * 0.6;

    particles = [];
    for (let i = 0; i < cfg.particleCount; i++) {
      particles.push({
        x:  Math.random() * W,
        y:  Math.random() * H,
        vx: (Math.random() - 0.5) * 0.5,
        vy: (Math.random() - 0.5) * 0.5,
        size: DOT_RADIUS_BASE + Math.random() * 1.5,
      });
    }

    let wx, wy;
    do {
      wx = W * 0.1 + Math.random() * W * 0.8;
      wy = H * 0.1 + Math.random() * H * 0.8;
    } while (Math.hypot(wx - target.x, wy - target.y) < Math.min(W, H) * 0.3);

    walker = { x: wx, y: wy, vx: 0, vy: 0, size: WALKER_RADIUS };

    const hint = document.getElementById('corralHint');
    if (hint) {
      hint.classList.remove('is-hidden');
      hint.textContent = currentRound === 0
        ? 'Guide the walker to the crossing point'
        : `Round ${currentRound + 1} — the drift intensifies`;
    }
  }

  function step() {
    const all = [...particles, walker];

    for (const p of all) {
      p.vx += (Math.random() - 0.5) * cfg.brownian;
      p.vy += (Math.random() - 0.5) * cfg.brownian;

      if (mouseHeld) {
        const dx = mouseX - p.x;
        const dy = mouseY - p.y;
        const dist = Math.hypot(dx, dy);
        if (dist < cfg.attractRadius && dist > 1) {
          const strength = cfg.attractForce * (1 - dist / cfg.attractRadius);
          p.vx += (dx / dist) * strength;
          p.vy += (dy / dist) * strength;
        }
      }

      p.vx *= cfg.damping;
      p.vy *= cfg.damping;

      p.x += p.vx;
      p.y += p.vy;

      const m = 4;
      if (p.x < m)     { p.x = m;     p.vx = Math.abs(p.vx) * 0.5; }
      if (p.x > W - m) { p.x = W - m; p.vx = -Math.abs(p.vx) * 0.5; }
      if (p.y < m)     { p.y = m;     p.vy = Math.abs(p.vy) * 0.5; }
      if (p.y > H - m) { p.y = H - m; p.vy = -Math.abs(p.vy) * 0.5; }
    }

    for (const p of particles) {
      const dx = walker.x - p.x;
      const dy = walker.y - p.y;
      const dist = Math.hypot(dx, dy);

      const minD = walker.size + p.size + 3;
      if (dist < minD && dist > 0.1) {
        const nx = dx / dist;
        const ny = dy / dist;
        const push = cfg.collidePush * (1 - dist / minD);
        walker.vx += nx * push;
        walker.vy += ny * push;
        p.vx -= nx * push * 0.3;
        p.vy -= ny * push * 0.3;
      }

      if (cfg.crowdForce > 0 && dist < CROWD_RANGE && dist > minD) {
        const nx = dx / dist;
        const ny = dy / dist;
        const force = cfg.crowdForce * (1 - dist / CROWD_RANGE);
        walker.vx += nx * force;
        walker.vy += ny * force;
      }
    }

    const dx = walker.x - target.x;
    const dy = walker.y - target.y;
    if (Math.hypot(dx, dy) < CAPTURE_DIST) {
      onRoundSolved();
    }
  }

  let frameCount = 0;

  function draw(now) {
    ctx.clearRect(0, 0, W, H);
    frameCount++;

    if (imploding) {
      drawImplode(now);
      return;
    }

    const pulse = 1 + Math.sin(frameCount * 0.06) * 0.15;
    ctx.beginPath();
    ctx.arc(target.x, target.y, TARGET_RADIUS * pulse, 0, Math.PI * 2);
    ctx.strokeStyle = TARGET_COLOR;
    ctx.lineWidth = 1.5;
    ctx.globalAlpha = 0.3 + Math.sin(frameCount * 0.06) * 0.15;
    ctx.stroke();
    ctx.globalAlpha = 1;

    ctx.beginPath();
    ctx.arc(target.x, target.y, 3, 0, Math.PI * 2);
    ctx.fillStyle = TARGET_COLOR;
    ctx.globalAlpha = 0.4;
    ctx.fill();
    ctx.globalAlpha = 1;

    for (const p of particles) {
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      ctx.fillStyle = DOT_COLOR;
      ctx.fill();
    }

    ctx.beginPath();
    ctx.arc(walker.x, walker.y, walker.size, 0, Math.PI * 2);
    ctx.fillStyle = WALKER_COLOR;
    ctx.fill();

    ctx.beginPath();
    ctx.arc(walker.x, walker.y, walker.size + 5, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(255, 71, 233, 0.12)';
    ctx.fill();

    if (mouseHeld) {
      ctx.beginPath();
      ctx.arc(mouseX, mouseY, cfg.attractRadius, 0, Math.PI * 2);
      ctx.strokeStyle = 'rgba(0,0,0,0.04)';
      ctx.lineWidth = 1;
      ctx.stroke();
    }
  }

  function drawImplode(now) {
    const elapsed = now - implodeStart;
    const t = Math.min(elapsed / IMPLODE_DUR, 1);
    const ease = 1 - Math.pow(1 - t, 3);

    for (const p of particles) {
      const ix = p._sx + (target.x - p._sx) * ease;
      const iy = p._sy + (target.y - p._sy) * ease;
      ctx.beginPath();
      ctx.arc(ix, iy, p.size * (1 - ease * 0.5), 0, Math.PI * 2);
      ctx.fillStyle = `rgba(0,0,0,${0.12 * (1 - ease)})`;
      ctx.fill();
    }

    const wx = walker._sx + (target.x - walker._sx) * ease;
    const wy = walker._sy + (target.y - walker._sy) * ease;
    ctx.beginPath();
    ctx.arc(wx, wy, walker.size * (1 - ease * 0.3), 0, Math.PI * 2);
    ctx.fillStyle = WALKER_COLOR;
    ctx.fill();

    if (t > 0.5) {
      const glowT = (t - 0.5) * 2;
      ctx.beginPath();
      ctx.arc(target.x, target.y, 8 + glowT * 60, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(255, 71, 233, ${0.2 * (1 - glowT)})`;
      ctx.fill();
    }

    if (t >= 1) {
      imploding = false;
      afterImplode();
    }
  }

  function onRoundSolved() {
    if (roundSolved) return;
    roundSolved = true;

    const hint = document.getElementById('corralHint');
    if (hint) hint.classList.add('is-hidden');

    if (currentRound >= TOTAL_ROUNDS - 1) {
      allSolved = true;
      startImplode();
    } else {
      startImplode();
    }
  }

  function startImplode() {
    for (const p of particles) { p._sx = p.x; p._sy = p.y; }
    walker._sx = walker.x;
    walker._sy = walker.y;
    imploding = true;
    implodeStart = performance.now();
  }

  function afterImplode() {
    if (allSolved) {
      showVerified();
    } else {
      currentRound++;
      setTimeout(() => {
        initRound();
      }, 400);
    }
  }

  function showVerified() {
    canvas.style.pointerEvents = 'none';
    canvas.style.cursor = 'default';

    const card = document.getElementById('corralVerified');
    if (!card) return;
    card.style.display = 'block';
    requestAnimationFrame(() => requestAnimationFrame(() => {
      card.classList.add('is-active');
    }));
  }

  const section = canvas.closest('.section');
  const eventTarget = section || canvas;

  eventTarget.addEventListener('pointerdown', (e) => {
    if (e.target.closest('.section-mark')) return;
    if (allSolved && !imploding) return;
    mouseHeld = true;
    const rect = canvas.getBoundingClientRect();
    mouseX = e.clientX - rect.left;
    mouseY = e.clientY - rect.top;
  });

  eventTarget.addEventListener('pointermove', (e) => {
    const rect = canvas.getBoundingClientRect();
    mouseX = e.clientX - rect.left;
    mouseY = e.clientY - rect.top;
  });

  eventTarget.addEventListener('pointerup', () => { mouseHeld = false; });
  eventTarget.addEventListener('pointerleave', () => { mouseHeld = false; });

  new ResizeObserver(() => {
    const w = canvas.parentElement.clientWidth;
    if (w < 60) return;
    resize();
  }).observe(canvas.parentElement);

  function frame(now) {
    requestAnimationFrame(frame);
    if (canvas.clientWidth < 60) return;
    if (!roundSolved && !imploding) step();
    draw(now);
  }

  resize();
  initRound();
  requestAnimationFrame(frame);

})();
