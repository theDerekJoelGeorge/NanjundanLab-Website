(() => {
  const canvas = document.querySelector(".site__molecules");
  if (!canvas) return;

  const reducedMotion =
    window.matchMedia &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (reducedMotion) return;

  const ctx = canvas.getContext("2d", { alpha: true, desynchronized: true });
  if (!ctx) return;

  const DPR_CAP = 2;
  const ROOT = getComputedStyle(document.documentElement);

  function cssVar(name, fallback) {
    const v = ROOT.getPropertyValue(name).trim();
    return v || fallback;
  }

  function hexToRgb(hex) {
    const h = String(hex || "").trim().replace(/^#/, "");
    const full = h.length === 3 ? h.split("").map((c) => c + c).join("") : h;
    if (full.length !== 6) return null;
    const n = Number.parseInt(full, 16);
    if (!Number.isFinite(n)) return null;
    return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
  }

  const primaryHex = cssVar("--color-primary", "#8cc63e");
  const primaryRgb = hexToRgb(primaryHex) || { r: 140, g: 198, b: 62 };

  const state = {
    w: 1,
    h: 1,
    dpr: 1,
    raf: 0,
    lastT: 0,
    paused: false,
    nodes: /** @type {Array<{x:number,y:number,vx:number,vy:number,r:number}>} */ ([]),
  };

  function clamp(v, a, b) {
    return Math.max(a, Math.min(b, v));
  }

  function rand(min, max) {
    return min + Math.random() * (max - min);
  }

  function resize() {
    const dpr = Math.min(DPR_CAP, Math.max(1, window.devicePixelRatio || 1));

    state.w = Math.max(1, Math.floor(window.innerWidth || document.documentElement.clientWidth || 1));
    state.h = Math.max(1, Math.floor(window.innerHeight || document.documentElement.clientHeight || 1));
    state.dpr = dpr;

    canvas.width = Math.max(1, Math.floor(state.w * dpr));
    canvas.height = Math.max(1, Math.floor(state.h * dpr));
    canvas.style.width = `${state.w}px`;
    canvas.style.height = `${state.h}px`;

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  function seedNodes() {
    const area = state.w * state.h;
    // Density tuned to match the "molecule mesh" look without being too busy.
    const count = clamp(Math.round(area / 18000), 34, 90);
    const speed = clamp(Math.sqrt(area) / 900, 0.18, 0.6) * 0.45;

    state.nodes = Array.from({ length: count }, () => {
      const ang = Math.random() * Math.PI * 2;
      return {
        x: rand(0, state.w),
        y: rand(0, state.h),
        vx: Math.cos(ang) * speed * rand(0.75, 1.25),
        vy: Math.sin(ang) * speed * rand(0.75, 1.25),
        r: rand(1.1, 2.4),
      };
    });
  }

  function step(dt) {
    const w = state.w;
    const h = state.h;
    for (const n of state.nodes) {
      n.x += n.vx * dt;
      n.y += n.vy * dt;

      // Soft wrap so motion feels continuous.
      if (n.x < -40) n.x = w + 40;
      if (n.x > w + 40) n.x = -40;
      if (n.y < -40) n.y = h + 40;
      if (n.y > h + 40) n.y = -40;
    }
  }

  function draw() {
    const w = state.w;
    const h = state.h;
    ctx.clearRect(0, 0, w, h);

    const nodes = state.nodes;
    const maxDist = clamp(Math.min(w, h) * 0.22, 110, 185);
    const maxDist2 = maxDist * maxDist;

    // Lines
    ctx.lineWidth = 1;
    ctx.strokeStyle = `rgba(${primaryRgb.r}, ${primaryRgb.g}, ${primaryRgb.b}, 0.35)`;
    ctx.beginPath();
    for (let i = 0; i < nodes.length; i++) {
      const a = nodes[i];
      for (let j = i + 1; j < nodes.length; j++) {
        const b = nodes[j];
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const d2 = dx * dx + dy * dy;
        if (d2 > maxDist2) continue;

        const t = 1 - d2 / maxDist2; // 0..1
        // Fade using alpha per-segment: draw as separate stroke for nicer gradient.
        ctx.strokeStyle = `rgba(${primaryRgb.r}, ${primaryRgb.g}, ${primaryRgb.b}, ${0.08 + t * 0.28})`;
        ctx.moveTo(a.x, a.y);
        ctx.lineTo(b.x, b.y);
      }
    }
    ctx.stroke();

    // Nodes
    for (const n of nodes) {
      ctx.beginPath();
      ctx.fillStyle = `rgba(${primaryRgb.r}, ${primaryRgb.g}, ${primaryRgb.b}, 0.82)`;
      ctx.arc(n.x, n.y, n.r, 0, Math.PI * 2);
      ctx.fill();
    }

    // A few brighter highlights to mimic the reference’s glowing points.
    const highlights = Math.max(4, Math.round(nodes.length * 0.09));
    for (let k = 0; k < highlights; k++) {
      const n = nodes[(k * 17) % nodes.length];
      ctx.beginPath();
      ctx.fillStyle = `rgba(${primaryRgb.r}, ${primaryRgb.g}, ${primaryRgb.b}, 0.95)`;
      ctx.arc(n.x, n.y, n.r + 1.0, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  function tick(t) {
    if (state.paused) return;
    if (!state.lastT) state.lastT = t;
    const dtMs = t - state.lastT;
    state.lastT = t;

    // Cap dt to avoid big jumps after tab returns.
    const dt = Math.min(32, Math.max(8, dtMs)) / 16.6667;

    step(dt);
    draw();
    state.raf = window.requestAnimationFrame(tick);
  }

  function start() {
    resize();
    seedNodes();
    state.lastT = 0;
    state.paused = false;
    state.raf = window.requestAnimationFrame(tick);
  }

  function stop() {
    state.paused = true;
    if (state.raf) window.cancelAnimationFrame(state.raf);
    state.raf = 0;
  }

  const ro = new ResizeObserver(() => {
    resize();
    // Keep node count roughly consistent with area changes.
    seedNodes();
  });
  ro.observe(document.documentElement);

  document.addEventListener(
    "visibilitychange",
    () => {
      if (document.hidden) stop();
      else start();
    },
    { passive: true }
  );

  window.addEventListener(
    "resize",
    () => {
      resize();
      seedNodes();
    },
    { passive: true }
  );

  start();
})();

