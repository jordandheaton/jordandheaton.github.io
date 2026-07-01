/* portfolio.js — small interactions: nav, reveal-on-scroll, role rotator, card glow */

// Sticky nav border on scroll
const nav = document.querySelector(".nav");
window.addEventListener("scroll", () => {
  nav.classList.toggle("scrolled", window.scrollY > 20);
});

// Mobile nav toggle
const toggle = document.querySelector(".nav-toggle");
const links = document.querySelector(".nav-links");
toggle.addEventListener("click", () => links.classList.toggle("open"));
links.querySelectorAll("a").forEach((a) => a.addEventListener("click", () => links.classList.remove("open")));

// Reveal on scroll
const io = new IntersectionObserver(
  (entries) => {
    entries.forEach((e) => {
      if (e.isIntersecting) {
        e.target.classList.add("in");
        io.unobserve(e.target);
      }
    });
  },
  { threshold: 0.12 }
);
document.querySelectorAll(".reveal").forEach((el) => io.observe(el));

// Card cursor glow (sets --mx/--my for the radial highlight)
document.querySelectorAll(".card").forEach((card) => {
  card.addEventListener("mousemove", (e) => {
    const r = card.getBoundingClientRect();
    card.style.setProperty("--mx", `${e.clientX - r.left}px`);
    card.style.setProperty("--my", `${e.clientY - r.top}px`);
  });
});

// Rotating role text in the hero
const roles = [
  "Bridge-Builder",
  "Global Citizen",
  "Systems Thinker",
  "Lifelong Explorer",
  "Curious Mind",
  "Servant Leader",
];
const rot = document.querySelector(".rot");
let ri = 0, ci = 0, deleting = false;
function typeLoop() {
  const word = roles[ri];
  rot.textContent = word.slice(0, ci);
  if (!deleting && ci < word.length) {
    ci++;
    setTimeout(typeLoop, 55);
  } else if (!deleting && ci === word.length) {
    deleting = true;
    setTimeout(typeLoop, 1600);
  } else if (deleting && ci > 0) {
    ci--;
    setTimeout(typeLoop, 28);
  } else {
    deleting = false;
    ri = (ri + 1) % roles.length;
    setTimeout(typeLoop, 250);
  }
}
if (rot) typeLoop();

// Footer year
document.getElementById("year").textContent = new Date().getFullYear();

/* Interactive constellation background — drifting nodes that link up and react
   to the cursor. Custom-built, distinct from the usual blurred-blob hero. */
(function () {
  const canvas = document.getElementById("bg");
  if (!canvas) return;
  const ctx = canvas.getContext("2d");
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  let w, h, dpr, pts, raf;
  const mouse = { x: -9999, y: -9999 };

  function size() {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    w = canvas.width = canvas.offsetWidth * dpr;
    h = canvas.height = canvas.offsetHeight * dpr;
    const n = Math.min(80, Math.round((canvas.offsetWidth * canvas.offsetHeight) / 16000));
    pts = Array.from({ length: n }, () => ({
      x: Math.random() * w,
      y: Math.random() * h,
      vx: (Math.random() - 0.5) * 0.22 * dpr,
      vy: (Math.random() - 0.5) * 0.22 * dpr,
      r: (Math.random() * 1.5 + 0.7) * dpr,
    }));
  }

  function frame() {
    ctx.clearRect(0, 0, w, h);
    const link = 130 * dpr;
    const pull = 160 * dpr;
    for (let i = 0; i < pts.length; i++) {
      const p = pts[i];
      p.x += p.vx;
      p.y += p.vy;
      if (p.x < 0 || p.x > w) p.vx *= -1;
      if (p.y < 0 || p.y > h) p.vy *= -1;

      const mdx = mouse.x - p.x, mdy = mouse.y - p.y;
      const md = Math.hypot(mdx, mdy);
      if (md < pull) { p.x += mdx * 0.008; p.y += mdy * 0.008; }

      for (let j = i + 1; j < pts.length; j++) {
        const q = pts[j];
        const d = Math.hypot(p.x - q.x, p.y - q.y);
        if (d < link) {
          const t = 1 - d / link;
          ctx.strokeStyle = `rgba(90, 180, 240, ${t * 0.28})`;
          ctx.lineWidth = dpr * 0.6;
          ctx.beginPath();
          ctx.moveTo(p.x, p.y);
          ctx.lineTo(q.x, q.y);
          ctx.stroke();
        }
      }

      ctx.fillStyle = md < pull ? "rgba(67, 231, 208, 0.9)" : "rgba(120, 170, 230, 0.5)";
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.fill();
    }
    raf = requestAnimationFrame(frame);
  }

  window.addEventListener("resize", size);
  window.addEventListener("mousemove", (e) => {
    const r = canvas.getBoundingClientRect();
    mouse.x = (e.clientX - r.left) * dpr;
    mouse.y = (e.clientY - r.top) * dpr;
  });
  window.addEventListener("mouseleave", () => { mouse.x = mouse.y = -9999; });

  size();
  frame();
  if (reduce) cancelAnimationFrame(raf); // one static frame if reduced motion
})();
