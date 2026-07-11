/* portfolio.js — bento hub interactions
   Ambient liquid-glow background, orb circuit, typewriter, tile glow,
   projects gallery + marquee, about/mission expanders, command palette. */

const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/* ---------- Footer year ---------- */
document.getElementById("year").textContent = new Date().getFullYear();

/* ---------- Ambient liquid glow (Layer 2: morphing fluid orbs) ---------- */
(function ambientGlow() {
  const canvas = document.getElementById("glow");
  if (!canvas) return;
  const ctx = canvas.getContext("2d");
  const SCALE = 0.5; // render at half-res; CSS blur(80px) hides the difference
  let W, H, raf;

  const palette = [
    [138, 92, 255],   // violet
    [88, 60, 245],    // electric indigo
    [160, 110, 255],  // bright purple
    [104, 66, 214],   // deep indigo
  ];
  const blobs = palette.map((c, i) => ({
    color: c,
    x: Math.random(), y: Math.random(),
    r: 0.3 + Math.random() * 0.2,
    dx: (Math.random() - 0.5) * 0.00018,
    dy: (Math.random() - 0.5) * 0.00018,
    phase: Math.random() * Math.PI * 2,
    wob: 0.06 + Math.random() * 0.05,
    seed: i,
  }));

  function size() {
    W = canvas.width = Math.round(window.innerWidth * SCALE);
    H = canvas.height = Math.round(window.innerHeight * SCALE);
  }
  size();
  window.addEventListener("resize", size);

  function blobPath(b, t) {
    // wobbly closed blob so shapes morph over time
    const cx = b.x * W, cy = b.y * H;
    const base = b.r * Math.min(W, H);
    const pts = 8;
    ctx.beginPath();
    for (let i = 0; i <= pts; i++) {
      const a = (i / pts) * Math.PI * 2;
      const rr = base * (1 + Math.sin(a * 3 + t * 0.0006 + b.phase) * b.wob + Math.cos(a * 2 - t * 0.0004) * b.wob * 0.6);
      const px = cx + Math.cos(a) * rr;
      const py = cy + Math.sin(a) * rr;
      if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
    }
    ctx.closePath();
    const g = ctx.createRadialGradient(cx, cy, base * 0.1, cx, cy, base);
    g.addColorStop(0, `rgba(${b.color[0]}, ${b.color[1]}, ${b.color[2]}, 0.72)`);
    g.addColorStop(0.5, `rgba(${b.color[0]}, ${b.color[1]}, ${b.color[2]}, 0.3)`);
    g.addColorStop(1, `rgba(${b.color[0]}, ${b.color[1]}, ${b.color[2]}, 0)`);
    ctx.fillStyle = g;
    ctx.fill();
  }

  function draw(t) {
    ctx.clearRect(0, 0, W, H);
    ctx.globalCompositeOperation = "lighter";
    blobs.forEach((b) => {
      b.x += b.dx; b.y += b.dy;
      if (b.x < -0.2 || b.x > 1.2) b.dx *= -1;
      if (b.y < -0.2 || b.y > 1.2) b.dy *= -1;
      blobPath(b, t);
    });
    ctx.globalCompositeOperation = "source-over";
  }

  if (reduceMotion) {
    draw(0);
  } else {
    (function loop(t) { draw(t); raf = requestAnimationFrame(loop); })(0);
    document.addEventListener("visibilitychange", () => {
      if (document.hidden) cancelAnimationFrame(raf);
      else raf = requestAnimationFrame(function loop(t) { draw(t); raf = requestAnimationFrame(loop); });
    });
  }
})();

/* ---------- Rotating role typewriter ---------- */
const roles = ["Bridge-Builder", "Global Citizen", "Systems Thinker", "Lifelong Explorer", "Curious Mind", "Servant Leader"];
const rot = document.querySelector(".rot");
if (rot) {
  if (reduceMotion) {
    rot.textContent = roles[0];
  } else {
    let ri = 0, ci = 0, deleting = false;
    (function typeLoop() {
      const word = roles[ri];
      rot.textContent = word.slice(0, ci);
      if (!deleting && ci < word.length) { ci++; setTimeout(typeLoop, 55); }
      else if (!deleting && ci === word.length) { deleting = true; setTimeout(typeLoop, 1600); }
      else if (deleting && ci > 0) { ci--; setTimeout(typeLoop, 28); }
      else { deleting = false; ri = (ri + 1) % roles.length; setTimeout(typeLoop, 250); }
    })();
  }
}

/* ---------- Tile cursor glow ---------- */
document.querySelectorAll(".tile").forEach((tile) => {
  tile.addEventListener("mousemove", (e) => {
    const r = tile.getBoundingClientRect();
    tile.style.setProperty("--mx", `${e.clientX - r.left}px`);
    tile.style.setProperty("--my", `${e.clientY - r.top}px`);
  });
});

/* ---------- Circuit traces from the orb ring ---------- */
(function buildCircuit() {
  const traces = document.querySelector(".circuit .traces");
  const nodes = document.querySelector(".circuit .nodes");
  if (!traces || !nodes) return;
  const svgNS = "http://www.w3.org/2000/svg";
  const cx = 200, cy = 200;       // viewBox center = orb center
  const startR = 112;             // just outside the binary band (r≈104)
  const specs = [
    { angle: 210, len: 70, warm: false, pulse: true },
    { angle: 150, len: 80, warm: true,  pulse: true },
    { angle: 330, len: 78, warm: false, pulse: true },
    { angle: 30,  len: 82, warm: true,  pulse: false },
    { angle: 255, len: 60, warm: false, pulse: false },
    { angle: 285, len: 58, warm: true,  pulse: false },
    { angle: 105, len: 60, warm: false, pulse: false },
    { angle: 75,  len: 58, warm: false, pulse: false },
  ];
  specs.forEach((s) => {
    const a = (s.angle * Math.PI) / 180;
    const sx = cx + Math.cos(a) * startR;
    const sy = cy + Math.sin(a) * startR;
    const midx = cx + Math.cos(a) * (startR + s.len * 0.55);
    const midy = cy + Math.sin(a) * (startR + s.len * 0.55);
    const ex = midx + (Math.cos(a) > 0 ? 1 : -1) * s.len * 0.6;
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
    halo.setAttribute("cx", ex.toFixed(1)); halo.setAttribute("cy", ey.toFixed(1)); halo.setAttribute("r", "7");
    halo.setAttribute("class", "node-halo" + (s.warm ? " warm" : ""));
    nodes.appendChild(halo);

    const dot = document.createElementNS(svgNS, "circle");
    dot.setAttribute("cx", ex.toFixed(1)); dot.setAttribute("cy", ey.toFixed(1)); dot.setAttribute("r", "3.2");
    dot.setAttribute("class", "node" + (s.warm ? " warm" : ""));
    nodes.appendChild(dot);
  });
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
    if (labelSel) { const lbl = btn.querySelector(labelSel); if (lbl) lbl.textContent = open ? "Read more" : "Read less"; }
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

  cards.forEach((_, i) => {
    const b = document.createElement("button");
    b.type = "button"; b.setAttribute("aria-label", `Go to project ${i + 1}`);
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
  function updateDots() { const idx = currentIndex(); dots.forEach((d, i) => d.classList.toggle("active", i === idx)); }
  function scrollToCard(i) { cards[Math.max(0, Math.min(cards.length - 1, i))].scrollIntoView({ behavior: "smooth", inline: "center", block: "nearest" }); }
  track.addEventListener("scroll", () => window.requestAnimationFrame(updateDots), { passive: true });
  prev?.addEventListener("click", () => scrollToCard(currentIndex() - 1));
  next?.addEventListener("click", () => scrollToCard(currentIndex() + 1));

  function open() {
    lastFocus = document.activeElement;
    overlay.hidden = false;
    requestAnimationFrame(() => overlay.classList.add("open"));
    trigger.setAttribute("aria-expanded", "true");
    document.body.classList.add("modal-open");
    document.body.style.overflow = "hidden";
    closeBtn?.focus();
    updateDots();
    document.addEventListener("keydown", onKey);
  }
  function close() {
    overlay.classList.remove("open");
    trigger.setAttribute("aria-expanded", "false");
    document.body.classList.remove("modal-open");
    document.body.style.overflow = "";
    document.removeEventListener("keydown", onKey);
    setTimeout(() => { overlay.hidden = true; }, 300);
    if (lastFocus) lastFocus.focus();
  }
  function onKey(e) {
    if (e.key === "Escape") { e.preventDefault(); close(); return; }
    if (e.key === "ArrowRight") scrollToCard(currentIndex() + 1);
    if (e.key === "ArrowLeft") scrollToCard(currentIndex() - 1);
    if (e.key === "Tab") {
      const list = Array.from(overlay.querySelectorAll('a[href], button')).filter((el) => !el.disabled);
      if (!list.length) return;
      const first = list[0], last = list[list.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    }
  }

  trigger.addEventListener("click", open);
  closeBtn?.addEventListener("click", close);
  overlay.addEventListener("click", (e) => { if (e.target === overlay) close(); });
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

  document.querySelectorAll(".palette-row").forEach((row) => {
    row.addEventListener("click", () => { const a = row.dataset.action; flash(a); actions[a]?.(); });
  });

  document.addEventListener("keydown", (e) => {
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    const t = e.target;
    if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable)) return;
    const overlay = document.getElementById("projects-panel");
    if (overlay && !overlay.hidden) return;
    const action = keyMap[e.key.toLowerCase()];
    if (!action) return;
    e.preventDefault();
    flash(action);
    actions[action]?.();
  });
})();
