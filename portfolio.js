/* portfolio.js — bento hub interactions
   Typewriter, tile cursor-glow, year, circuit orb, falling keycaps,
   projects gallery, about/mission expanders, command-palette shortcuts. */

const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/* ---------- Footer year ---------- */
document.getElementById("year").textContent = new Date().getFullYear();

/* ---------- Rotating role typewriter (ported from original) ---------- */
const roles = [
  "Bridge-Builder",
  "Global Citizen",
  "Systems Thinker",
  "Lifelong Explorer",
  "Curious Mind",
  "Servant Leader",
];
const rot = document.querySelector(".rot");
if (rot) {
  if (reduceMotion) {
    rot.textContent = roles[0];
  } else {
    let ri = 0, ci = 0, deleting = false;
    (function typeLoop() {
      const word = roles[ri];
      rot.textContent = word.slice(0, ci);
      if (!deleting && ci < word.length) {
        ci++; setTimeout(typeLoop, 55);
      } else if (!deleting && ci === word.length) {
        deleting = true; setTimeout(typeLoop, 1600);
      } else if (deleting && ci > 0) {
        ci--; setTimeout(typeLoop, 28);
      } else {
        deleting = false; ri = (ri + 1) % roles.length; setTimeout(typeLoop, 250);
      }
    })();
  }
}

/* ---------- Tile cursor glow (ported --mx/--my) ---------- */
document.querySelectorAll(".tile").forEach((tile) => {
  tile.addEventListener("mousemove", (e) => {
    const r = tile.getBoundingClientRect();
    tile.style.setProperty("--mx", `${e.clientX - r.left}px`);
    tile.style.setProperty("--my", `${e.clientY - r.top}px`);
  });
});

/* ---------- Circuit traces around the orb (SVG) ---------- */
(function buildCircuit() {
  const traces = document.querySelector(".circuit .traces");
  const nodes = document.querySelector(".circuit .nodes");
  if (!traces || !nodes) return;
  const svgNS = "http://www.w3.org/2000/svg";
  // viewBox is 600x360, orb centered ~ (300,180). Traces elbow outward to node dots.
  const cx = 300, cy = 180;
  const specs = [
    { angle: 200, len: 210, warm: false, pulse: true },
    { angle: 160, len: 230, warm: true,  pulse: true },
    { angle: 340, len: 220, warm: false, pulse: true },
    { angle: 20,  len: 240, warm: true,  pulse: false },
    { angle: 250, len: 150, warm: false, pulse: false },
    { angle: 290, len: 150, warm: true,  pulse: false },
    { angle: 110, len: 150, warm: false, pulse: false },
    { angle: 70,  len: 150, warm: false, pulse: false },
  ];
  specs.forEach((s) => {
    const a = (s.angle * Math.PI) / 180;
    const startR = 96;
    const sx = cx + Math.cos(a) * startR;
    const sy = cy + Math.sin(a) * startR;
    // elbow: go out radially, then turn horizontal to the node
    const midx = cx + Math.cos(a) * (startR + s.len * 0.55);
    const midy = cy + Math.sin(a) * (startR + s.len * 0.55);
    const ex = midx + (Math.cos(a) > 0 ? 1 : -1) * s.len * 0.42;
    const ey = midy;
    const d = `M ${sx.toFixed(1)} ${sy.toFixed(1)} L ${midx.toFixed(1)} ${midy.toFixed(1)} L ${ex.toFixed(1)} ${ey.toFixed(1)}`;

    const trace = document.createElementNS(svgNS, "path");
    trace.setAttribute("d", d);
    trace.setAttribute("class", "trace" + (s.warm ? " warm" : ""));
    traces.appendChild(trace);

    if (s.pulse && !reduceMotion) {
      const pulse = document.createElementNS(svgNS, "path");
      pulse.setAttribute("d", d);
      pulse.setAttribute("class", "pulse" + (s.warm ? " warm" : ""));
      traces.appendChild(pulse);
    }

    const halo = document.createElementNS(svgNS, "circle");
    halo.setAttribute("cx", ex.toFixed(1));
    halo.setAttribute("cy", ey.toFixed(1));
    halo.setAttribute("r", "7");
    halo.setAttribute("class", "node-halo" + (s.warm ? " warm" : ""));
    nodes.appendChild(halo);

    const dot = document.createElementNS(svgNS, "circle");
    dot.setAttribute("cx", ex.toFixed(1));
    dot.setAttribute("cy", ey.toFixed(1));
    dot.setAttribute("r", "3.2");
    dot.setAttribute("class", "node" + (s.warm ? " warm" : ""));
    nodes.appendChild(dot);
  });
})();

/* ---------- Falling keycaps ---------- */
(function keycaps() {
  const back = document.getElementById("keys-back");
  const front = document.getElementById("keys-front");
  if (!back || !front) return;
  const glyphs = ["⌘", "⇧", "K", "J", "H", "↵", "esc", "tab"];
  const layers = [
    { canvas: back, count: window.innerWidth < 680 ? 7 : 14, speed: 1, big: false, alpha: 0.62 },
    { canvas: front, count: window.innerWidth < 680 ? 2 : 3, speed: 1.5, big: true, alpha: 0.55 },
  ];
  let dpr = Math.min(window.devicePixelRatio || 1, 2);
  let W = window.innerWidth, H = window.innerHeight;

  function makeKey(layer) {
    const size = (layer.big ? 46 : 30) + Math.random() * (layer.big ? 26 : 22);
    return {
      x: Math.random() * W,
      y: Math.random() * H - H,
      size,
      glyph: glyphs[(Math.random() * glyphs.length) | 0],
      vy: (0.25 + Math.random() * 0.55) * layer.speed,
      sway: 0.4 + Math.random() * 0.9,
      swayPhase: Math.random() * Math.PI * 2,
      rot: (Math.random() - 0.5) * 0.5,
      vr: (Math.random() - 0.5) * 0.004,
    };
  }

  layers.forEach((layer) => {
    const ctx = layer.canvas.getContext("2d");
    layer.ctx = ctx;
    layer.keys = Array.from({ length: layer.count }, () => makeKey(layer));
  });

  function resize() {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    W = window.innerWidth; H = window.innerHeight;
    layers.forEach((layer) => {
      layer.canvas.width = W * dpr;
      layer.canvas.height = H * dpr;
      layer.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    });
  }
  resize();
  window.addEventListener("resize", resize);

  function drawKey(ctx, k, alpha) {
    ctx.save();
    ctx.translate(k.x, k.y);
    ctx.rotate(k.rot);
    ctx.globalAlpha = alpha;
    const s = k.size, r = s * 0.24;
    // 3D side (darker, offset down)
    roundRect(ctx, -s / 2, -s / 2 + 5, s, s, r);
    ctx.fillStyle = "rgba(58, 46, 100, 0.9)";
    ctx.fill();
    // top face
    roundRect(ctx, -s / 2, -s / 2, s, s, r);
    const grad = ctx.createLinearGradient(0, -s / 2, 0, s / 2);
    grad.addColorStop(0, "rgba(78, 64, 132, 0.98)");
    grad.addColorStop(1, "rgba(46, 36, 84, 0.98)");
    ctx.fillStyle = grad;
    ctx.fill();
    // purple rim-light + warm glow
    ctx.lineWidth = 1.2;
    ctx.strokeStyle = "rgba(176, 156, 255, 0.85)";
    ctx.stroke();
    ctx.shadowColor = "rgba(255, 157, 92, 0.5)";
    ctx.shadowBlur = 10;
    ctx.strokeStyle = "rgba(255, 157, 92, 0.25)";
    ctx.stroke();
    ctx.shadowBlur = 0;
    // glyph
    ctx.fillStyle = "rgba(228, 222, 255, 0.95)";
    ctx.font = `600 ${s * (k.glyph.length > 1 ? 0.26 : 0.4)}px "Space Grotesk", sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(k.glyph, 0, 0);
    ctx.restore();
  }

  function roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  let raf;
  function frame() {
    layers.forEach((layer) => {
      const ctx = layer.ctx;
      ctx.clearRect(0, 0, W, H);
      layer.keys.forEach((k) => {
        k.y += k.vy;
        k.swayPhase += 0.01;
        k.x += Math.sin(k.swayPhase) * k.sway * 0.3;
        k.rot += k.vr;
        if (k.y - k.size > H) Object.assign(k, makeKey(layer), { y: -k.size });
        drawKey(ctx, k, layer.alpha);
      });
    });
    raf = requestAnimationFrame(frame);
  }

  function renderStatic() {
    layers.forEach((layer) => {
      const ctx = layer.ctx;
      ctx.clearRect(0, 0, W, H);
      layer.keys.forEach((k) => { k.y = Math.random() * H; drawKey(ctx, k, layer.alpha); });
    });
  }

  if (reduceMotion) {
    renderStatic();
  } else {
    frame();
    document.addEventListener("visibilitychange", () => {
      if (document.hidden) { cancelAnimationFrame(raf); }
      else { raf = requestAnimationFrame(frame); }
    });
  }
})();

/* ---------- Mission + About expanders ---------- */
function wireToggle(btnSel, bodyId, labelSel) {
  const btn = document.querySelector(btnSel);
  const body = document.getElementById(bodyId);
  if (!btn || !body) return;
  btn.addEventListener("click", () => {
    const open = btn.getAttribute("aria-expanded") === "true";
    btn.setAttribute("aria-expanded", String(!open));
    body.hidden = open;
    if (labelSel) {
      const lbl = btn.querySelector(labelSel);
      if (lbl) lbl.textContent = open ? "Read more" : "Read less";
    }
  });
}
wireToggle(".mission-toggle", "mission-body", null);
wireToggle(".read-more", "about-more", ".rm-label");

/* ---------- Projects gallery ---------- */
(function gallery() {
  const trigger = document.querySelector(".projects-trigger");
  const overlay = document.getElementById("projects-panel");
  const closeBtn = overlay?.querySelector(".gallery-close");
  const track = document.getElementById("gallery-track");
  const cards = track ? Array.from(track.children) : [];
  const dotsWrap = document.getElementById("gallery-dots");
  const prev = overlay?.querySelector(".gallery-arrow.prev");
  const next = overlay?.querySelector(".gallery-arrow.next");
  if (!trigger || !overlay || !track) return;

  let lastFocus = null;

  // dots
  cards.forEach((_, i) => {
    const b = document.createElement("button");
    b.type = "button";
    b.setAttribute("aria-label", `Go to project ${i + 1}`);
    b.addEventListener("click", () => scrollToCard(i));
    dotsWrap.appendChild(b);
  });
  const dots = Array.from(dotsWrap.children);

  function currentIndex() {
    const c = track.getBoundingClientRect();
    const center = c.left + c.width / 2;
    let best = 0, bestD = Infinity;
    cards.forEach((card, i) => {
      const r = card.getBoundingClientRect();
      const d = Math.abs(r.left + r.width / 2 - center);
      if (d < bestD) { bestD = d; best = i; }
    });
    return best;
  }
  function updateDots() {
    const idx = currentIndex();
    dots.forEach((d, i) => d.classList.toggle("active", i === idx));
  }
  function scrollToCard(i) {
    const card = cards[Math.max(0, Math.min(cards.length - 1, i))];
    card.scrollIntoView({ behavior: "smooth", inline: "center", block: "nearest" });
  }
  track.addEventListener("scroll", () => window.requestAnimationFrame(updateDots), { passive: true });
  prev?.addEventListener("click", () => scrollToCard(currentIndex() - 1));
  next?.addEventListener("click", () => scrollToCard(currentIndex() + 1));

  function open() {
    lastFocus = document.activeElement;
    overlay.hidden = false;
    requestAnimationFrame(() => overlay.classList.add("open"));
    trigger.setAttribute("aria-expanded", "true");
    document.body.style.overflow = "hidden";
    closeBtn?.focus();
    updateDots();
    document.addEventListener("keydown", onKey);
  }
  function close() {
    overlay.classList.remove("open");
    trigger.setAttribute("aria-expanded", "false");
    document.body.style.overflow = "";
    document.removeEventListener("keydown", onKey);
    setTimeout(() => { overlay.hidden = true; }, 300);
    if (lastFocus) lastFocus.focus();
  }
  function onKey(e) {
    if (e.key === "Escape") { e.preventDefault(); close(); return; }
    if (e.key === "ArrowRight") { scrollToCard(currentIndex() + 1); }
    if (e.key === "ArrowLeft") { scrollToCard(currentIndex() - 1); }
    if (e.key === "Tab") {
      // simple focus trap within overlay
      const focusables = overlay.querySelectorAll('a[href], button');
      const list = Array.from(focusables).filter((el) => !el.disabled);
      if (!list.length) return;
      const first = list[0], last = list[list.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    }
  }

  trigger.addEventListener("click", open);
  closeBtn?.addEventListener("click", close);
  overlay.addEventListener("click", (e) => { if (e.target === overlay) close(); });

  // expose for command palette
  window.__openProjects = open;
})();

/* ---------- Command palette shortcuts ---------- */
(function palette() {
  const actions = {
    resume:   () => window.open("Resume/Jordan_Heaton_Resume.pdf", "_blank", "noopener"),
    email:    () => { window.location.href = "mailto:jordandheaton@gmail.com"; },
    linkedin: () => window.open("https://linkedin.com/in/jordan-heaton-589a36405", "_blank", "noopener"),
    projects: () => window.__openProjects && window.__openProjects(),
    about:    () => {
      const btn = document.querySelector(".read-more");
      if (btn && btn.getAttribute("aria-expanded") !== "true") btn.click();
      document.querySelector(".tile--about")?.scrollIntoView({ behavior: "smooth", block: "center" });
    },
  };
  const keyMap = { r: "resume", e: "email", l: "linkedin", p: "projects", a: "about" };

  function flash(action) {
    const row = document.querySelector(`.palette-row[data-action="${action}"]`);
    if (!row) return;
    row.classList.add("flash");
    setTimeout(() => row.classList.remove("flash"), 180);
  }

  // click rows
  document.querySelectorAll(".palette-row").forEach((row) => {
    row.addEventListener("click", () => {
      const a = row.dataset.action;
      flash(a); actions[a]?.();
    });
  });

  // keyboard
  document.addEventListener("keydown", (e) => {
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    const t = e.target;
    if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable)) return;
    // don't hijack keys while the projects dialog is open (it has its own handler)
    const overlay = document.getElementById("projects-panel");
    if (overlay && !overlay.hidden) return;
    const action = keyMap[e.key.toLowerCase()];
    if (!action) return;
    e.preventDefault();
    flash(action);
    actions[action]?.();
  });
})();
