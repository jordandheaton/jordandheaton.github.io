/* portfolio.js — bento hub interactions
   Typewriter, tile glow, orb centering, projects gallery + marquee,
   about/mission toggles, command palette. (Lava-lamp background is pure CSS.) */

const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/* ---------- Footer year ---------- */
document.getElementById("year").textContent = new Date().getFullYear();

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

/* ---------- Center the orb exactly on the hero/projects seam ---------- */
function positionOrb() {
  const bento = document.getElementById("bento");
  const hero = document.querySelector(".tile--hero");
  const orb = document.querySelector(".orb-layer");
  if (!bento || !hero || !orb) return;
  // only when the orb is an absolute overlay (desktop); on mobile it flows inline
  if (getComputedStyle(orb).position !== "absolute") { orb.style.left = orb.style.top = ""; return; }
  const b = bento.getBoundingClientRect();
  const h = hero.getBoundingClientRect();
  orb.style.left = `${h.left - b.left + h.width / 2}px`;
  orb.style.top = `${h.bottom - b.top}px`;
}
window.addEventListener("load", positionOrb);
window.addEventListener("resize", positionOrb);
if (document.fonts && document.fonts.ready) document.fonts.ready.then(positionOrb);
positionOrb();

/* ---------- Mission popover ---------- */
(function mission() {
  const btn = document.querySelector(".mission-toggle");
  const body = document.getElementById("mission-body");
  if (!btn || !body) return;
  btn.addEventListener("click", () => {
    const open = btn.getAttribute("aria-expanded") === "true";
    btn.setAttribute("aria-expanded", String(!open));
    body.hidden = open;
  });
  // the popover overlays its own toggle button; clicking it dismisses it
  body.addEventListener("click", () => btn.click());
})();

/* ---------- About overlay (photos + full story) ---------- */
(function aboutModal() {
  const trigger = document.querySelector(".about-trigger");
  const overlay = document.getElementById("about-panel");
  const closeBtn = overlay?.querySelector(".about-close");
  if (!trigger || !overlay) return;
  let lastFocus = null;

  function open() {
    lastFocus = document.activeElement;
    overlay.hidden = false;
    requestAnimationFrame(() => overlay.classList.add("open"));
    trigger.setAttribute("aria-expanded", "true");
    document.body.classList.add("modal-open");
    document.body.style.overflow = "hidden";
    closeBtn?.focus();
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
  window.__openAbout = open;
})();

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
    about:    () => window.__openAbout && window.__openAbout(),
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
    if (document.body.classList.contains("modal-open")) return; // a dialog owns the keys
    const action = keyMap[e.key.toLowerCase()];
    if (!action) return;
    e.preventDefault();
    flash(action);
    actions[action]?.();
  });
})();
