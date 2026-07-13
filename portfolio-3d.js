/* ============================================================
   Jordan Heaton — 3D scroll portfolio
   Lenis smooth scroll + GSAP ScrollTrigger
   Black-studio hero video, typewriter intro, plexus background
   ============================================================ */

(function () {
  "use strict";

  document.body.classList.add("js");
  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (reduced) document.body.classList.add("reduced");

  document.getElementById("year").textContent = new Date().getFullYear();

  /* ---------------- techy network background ---------------- */
  (function bgNet() {
    const canvas = document.getElementById("bg-net");
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    let W = 0, H = 0, pts = [];
    const LINK = 150;

    function init() {
      W = canvas.width = window.innerWidth;
      H = canvas.height = window.innerHeight;
      const n = W < 720 ? 42 : 88;
      pts = Array.from({ length: n }, () => ({
        x: Math.random() * W,
        y: Math.random() * H,
        vx: (Math.random() - 0.5) * 0.28,
        vy: (Math.random() - 0.5) * 0.28,
        r: Math.random() * 1.7 + 0.7,
      }));
    }

    function frame() {
      ctx.clearRect(0, 0, W, H);
      for (const p of pts) {
        p.x += p.vx; p.y += p.vy;
        if (p.x < -20) p.x = W + 20; else if (p.x > W + 20) p.x = -20;
        if (p.y < -20) p.y = H + 20; else if (p.y > H + 20) p.y = -20;
      }
      ctx.lineWidth = 1;
      for (let i = 0; i < pts.length; i++) {
        for (let j = i + 1; j < pts.length; j++) {
          const dx = pts[i].x - pts[j].x, dy = pts[i].y - pts[j].y;
          const d2 = dx * dx + dy * dy;
          if (d2 < LINK * LINK) {
            const a = (1 - Math.sqrt(d2) / LINK) * 0.17;
            ctx.strokeStyle = "rgba(77, 140, 255," + a.toFixed(3) + ")";
            ctx.beginPath();
            ctx.moveTo(pts[i].x, pts[i].y);
            ctx.lineTo(pts[j].x, pts[j].y);
            ctx.stroke();
          }
        }
      }
      for (const p of pts) {
        ctx.fillStyle = "rgba(130, 185, 255, 0.55)";
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fill();
      }
      if (!reduced) requestAnimationFrame(frame);
    }

    init();
    window.addEventListener("resize", init);
    frame(); // reduced-motion gets a single static render
  })();

  /* ---------------- smooth scroll ---------------- */
  gsap.registerPlugin(ScrollTrigger);

  const lenis = new Lenis({ lerp: 0.1, smoothWheel: true });
  lenis.on("scroll", ScrollTrigger.update);
  gsap.ticker.add((t) => lenis.raf(t * 1000));
  gsap.ticker.lagSmoothing(0);

  const progressFill = document.getElementById("progress-fill");
  lenis.on("scroll", ({ progress }) => {
    progressFill.style.width = (progress * 100).toFixed(2) + "%";
  });

  document.querySelectorAll("[data-nav]").forEach((a) => {
    a.addEventListener("click", (e) => {
      const id = a.getAttribute("href");
      if (id && id.startsWith("#")) {
        e.preventDefault();
        // WORK jumps past the laptop dive to where the screen is dark-blue and
        // "SELECTED WORK" is typed — compute the Y numerically (pin/sticky throws
        // off lenis's element resolution)
        if (id === "#work-desk") {
          const el = document.querySelector(id);
          if (el) {
            const y = el.getBoundingClientRect().top + window.scrollY + window.innerHeight * 0.06;
            lenis.scrollTo(y, { duration: 1.6 });
            return;
          }
        }
        lenis.scrollTo(id, { offset: 0, duration: 1.4 });
      }
    });
  });

  /* ---------------- decode / scramble text ---------------- */
  const GLYPHS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789<>/\\|=+*#";

  function scrambleTo(el, text, dur) {
    dur = dur || 900;
    const start = performance.now();
    return new Promise((resolve) => {
      function tick(now) {
        const p = Math.min(1, (now - start) / dur);
        const settled = Math.floor(p * text.length);
        let out = text.slice(0, settled);
        for (let i = settled; i < text.length; i++) {
          out += text[i] === " " ? " " : GLYPHS[(Math.random() * GLYPHS.length) | 0];
        }
        el.textContent = out;
        if (p < 1) requestAnimationFrame(tick);
        else resolve();
      }
      requestAnimationFrame(tick);
    });
  }

  document.querySelectorAll("[data-decode-onscroll]").forEach((el) => {
    const original = el.textContent;
    if (!reduced) el.style.visibility = "hidden"; // invisible until it glitches in
    ScrollTrigger.create({
      trigger: el,
      start: "top 80%",
      once: true,
      onEnter: () => {
        if (reduced) return;
        el.style.visibility = "visible";
        scrambleTo(el, original, 900);
      },
    });
  });

  /* plain typewriter (no shared cursor) — used for the WORK title */
  function typePlain(el, text, ms) {
    if (reduced) { el.textContent = text; return Promise.resolve(); }
    return new Promise((resolve) => {
      let i = 0; el.textContent = "";
      const iv = setInterval(() => {
        i++; el.textContent = text.slice(0, i);
        if (i >= text.length) { clearInterval(iv); resolve(); }
      }, ms || 80);
    });
  }

  /* ---------------- adaptive top bar ----------------
     Dark bar text (.bar--light) over the LIGHT run: skills-band + about + the
     white laptop-opening phase of WORK (until it pins). Once pinned, the WORK
     scrub controls it — flipping to light text only when the dark-blue engulfs
     the frame. Hero / dark-desk / contact / footer keep light text. */
  const bar = document.querySelector(".bar");
  if (bar) {
    ScrollTrigger.create({
      trigger: ".skills-band",
      start: "top 60px",
      endTrigger: "#work",
      end: "top top",
      onToggle: (self) => bar.classList.toggle("bar--light", self.isActive),
      onRefresh: (self) => bar.classList.toggle("bar--light", self.isActive),
    });
  }

  /* ---------------- typewriter intro ---------------- */
  const cursor = document.createElement("span");
  cursor.className = "tcur";
  cursor.setAttribute("aria-hidden", "true");

  function typeText(el, text, ms) {
    if (reduced) { el.textContent = text; return Promise.resolve(); }
    return new Promise((resolve) => {
      let i = 0;
      el.textContent = "";
      el.appendChild(cursor); // block cursor rides the text as it types
      const iv = setInterval(() => {
        i++;
        el.textContent = text.slice(0, i);
        el.appendChild(cursor);
        if (i >= text.length) { clearInterval(iv); resolve(); }
      }, ms || 55);
    });
  }

  const ROLES = ["SYSTEMS THINKER", "BRIDGE-BUILDER", "GLOBAL CITIZEN", "LIFELONG EXPLORER", "CURIOUS MIND", "SERVANT LEADER"];
  const rot = document.getElementById("role-rot");
  let rotatorStarted = false;
  function startRotator() {
    if (rotatorStarted || !rot) return;
    rotatorStarted = true;
    let ri = 0;
    scrambleTo(rot, ROLES[0], 700);
    setInterval(() => {
      ri = (ri + 1) % ROLES.length;
      if (reduced) rot.textContent = ROLES[ri];
      else scrambleTo(rot, ROLES[ri], 800);
    }, 3200);
  }

  let typed = false;
  async function typeSequence() {
    if (typed) return;
    typed = true;
    const l1 = document.getElementById("type-line1");
    const l2 = document.getElementById("type-line2");
    await typeText(l1, l1.dataset.text, 70);
    await typeText(l2, l2.dataset.text, 85);
    cursor.remove();
    l2.insertAdjacentHTML("beforeend", '<span class="ht-dot">.</span>');
    document.getElementById("hero-roles").classList.add("on");
    startRotator();
  }

  /* ---------------- generic reveals ---------------- */
  gsap.utils.toArray("[data-reveal]").forEach((el) => {
    gsap.to(el, {
      opacity: 1, y: 0, duration: reduced ? 0 : 1.1, ease: "power3.out",
      scrollTrigger: { trigger: el, start: "top 88%", once: true },
    });
  });

  const aboutLead = document.querySelector(".about-lead");
  if (aboutLead && !reduced) {
    gsap.from(aboutLead, {
      opacity: 0, y: 60, duration: 1.2, ease: "power3.out",
      scrollTrigger: { trigger: aboutLead, start: "top 85%", once: true },
    });
  }

  /* ---------------- WORK: laptop-dive intro + horizontal cards ----------------
     Phase 1 (VIDEO_PX): scroll scrubs the laptop video — it spins in, opens,
       and the camera dives into the screen, ending on black.
     Phase 2: "SELECTED WORK" types onto the black, then the cards sweep in. */
  const workGrid = document.getElementById("work-grid");
  const workCanvas = document.getElementById("work-canvas");
  const workSection = document.getElementById("work");
  if (workGrid) {
    const VIDEO_PX = 1500;  // pinned scroll: most of the open-up + the dive (in full view)
    const HOLD_PX = 0;      // release into the desk the instant the dive ends → title centers exactly when the camera stops
    const OPEN_FRAC = 0.2;  // small slice of the open-up plays during entry; most is seen pinned/centered

    /* Image-sequence player on a canvas — replaces video scrubbing (seeking a
       <video> per scroll frame is inherently janky). Frames are AI-interpolated
       (clean motion) and ALL decoded to ImageBitmaps up front and kept resident,
       so every frame is always ready → no decode-race stepping/glitch. Memory is
       bounded by keeping the count×resolution modest (~148 frames @ 1440p). */
    const SEQ_COUNT = 148; // clean AI frames — ALL decoded & kept (no windowing → no decode-race glitch)
    const seqSrc = (i) => "assets-3d/laptop-seq/frame-" + String(i + 1).padStart(3, "0") + ".jpg?r=3";
    const frames = [];          // <img> sources
    const bitmaps = new Map();  // idx -> decoded ImageBitmap (every frame kept — always ready)
    const ctx = workCanvas ? workCanvas.getContext("2d", { alpha: false }) : null;
    let seqReady = false;
    let curIdx = 0;
    let shownIdx = -1;

    function sizeCanvas() {
      if (!workCanvas) return;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      workCanvas.width = Math.round(workCanvas.clientWidth * dpr);
      workCanvas.height = Math.round(workCanvas.clientHeight * dpr);
    }
    function drawBitmap(bm) {
      const cw = workCanvas.width, ch = workCanvas.height;
      const s = Math.max(cw / bm.width, ch / bm.height); // cover fit
      const dw = bm.width * s, dh = bm.height * s;
      ctx.drawImage(bm, (cw - dw) / 2, (ch - dh) / 2, dw, dh);
    }
    function drawFrame(fidx) {
      if (!seqReady || !ctx) return;
      const idx = Math.max(0, Math.min(SEQ_COUNT - 1, Math.round(fidx)));
      curIdx = idx;
      const bm = bitmaps.get(idx);
      if (bm) { drawBitmap(bm); shownIdx = idx; }                          // always ready once loaded
      else if (bitmaps.has(shownIdx)) { drawBitmap(bitmaps.get(shownIdx)); } // only during the brief initial load
    }

    if (workCanvas && ctx) {
      for (let i = 0; i < SEQ_COUNT; i++) {
        const img = new Image();
        img.onload = () => {
          createImageBitmap(img).then((bm) => {
            bitmaps.set(i, bm); // keep every frame decoded — never released
            if (!seqReady) { seqReady = true; workSection.classList.add("work--video"); sizeCanvas(); }
            if (i === curIdx || shownIdx < 0) drawFrame(curIdx);
          });
        };
        img.src = seqSrc(i);
        frames[i] = img;
      }
      window.addEventListener("resize", () => { sizeCanvas(); drawFrame(curIdx); });
    }

    const wgTitle = document.getElementById("work-ghost-title");
    const wgTitleText = wgTitle && wgTitle.querySelector(".wg-text");
    const workGlow = document.getElementById("work-glow");
    const bar = document.querySelector(".bar");
    if (wgTitleText) wgTitleText.textContent = ""; // typed on scroll in the desk (below)

    // Phase 0 (entry, NOT pinned): the laptop is already opening as the section
    // rises into view — draws frames 0 → OPEN_FRAC. No static hold.
    if (workCanvas) {
      ScrollTrigger.create({
        trigger: "#work",
        start: "top bottom", // section top enters the viewport bottom
        end: "top top",      // section top reaches the top → pin engages
        scrub: reduced ? false : 0.8,
        invalidateOnRefresh: true,
        onUpdate: (self) => {
          drawFrame(self.progress * OPEN_FRAC * (SEQ_COUNT - 1));
          workCanvas.style.opacity = "1"; // always fully visible while opening
          if (bar) bar.classList.add("bar--light"); // laptop is on WHITE here → dark bar text
        },
      });
    }

    const scrub = { p: 0 };
    const tl = gsap.timeline({
      scrollTrigger: {
        trigger: "#work",
        start: "top top",
        end: () => "+=" + (VIDEO_PX + HOLD_PX),
        pin: "#work-pin",
        scrub: reduced ? false : 0.8,
        invalidateOnRefresh: true,
      },
    });
    // pinned phase: most of the open-up + the dive (OPEN_FRAC → 1.0),
    // then the cross-fade + title, then the cards sweep.
    tl.to(scrub, {
      p: 1, duration: VIDEO_PX, ease: "none",
      onUpdate: () => {
        const vp = OPEN_FRAC + scrub.p * (1 - OPEN_FRAC); // 0.2 → 1.0 of the sequence
        drawFrame(vp * (SEQ_COUNT - 1));
        // cross-fade: the black screen dissolves into the section's near-black as
        // "SELECTED WORK" fades in. On the way back UP the title's opacity mirrors
        // the canvas, so it recedes WITH the laptop instead of hanging on screen.
        const canvasOp = scrub.p > 0.82 ? Math.max(0, 1 - (scrub.p - 0.82) / 0.18) : 1;
        if (workCanvas) workCanvas.style.opacity = String(canvasOp);
        // bar text stays dark until the dark-blue engulfs the top of the frame
        if (bar) bar.classList.toggle("bar--light", scrub.p < 0.62);
        // power-on bloom: the screen lights up and the glow ZOOMS IN locked to the
        // laptop screen as the camera dives, then fades out (long, gentle) as the
        // title lands — so it reads like the display itself turning on.
        if (workGlow) {
          let g;
          if (scrub.p <= 0.48) g = 0;
          else if (scrub.p <= 0.60) g = (scrub.p - 0.48) / 0.12;       // bloom on (earlier)
          else g = Math.max(0, 1 - (scrub.p - 0.60) / 0.40);           // long fade → 0 by the title landing
          workGlow.style.opacity = String(g);
          // scale the glow in lockstep with the dive so it stays on the screen
          const z = Math.max(0, (scrub.p - 0.48) / 0.52);              // 0 at dive start → 1 at end
          const sc = 1 + Math.pow(z, 1.7) * 4.0;                        // accelerating zoom to match the camera
          workGlow.style.transform = "scale(" + sc.toFixed(3) + ")";
        }
      },
    });
    tl.to({}, { duration: HOLD_PX }); // brief hold on the dark screen, then the pin releases into the desk

    // staggered vertical reveal — each project window rises + fades in as it enters
    // view; clearProps afterwards so the CSS hover-lift keeps working
    if (!reduced) {
      gsap.set("#work-grid .wcard", { opacity: 0, y: 80 });
      ScrollTrigger.batch("#work-grid .wcard", {
        start: "top 90%",
        onEnter: (els) => gsap.to(els, {
          opacity: 1, y: 0, duration: 1.0, ease: "power3.out",
          stagger: 0.12, overwrite: true, clearProps: "transform,opacity",
        }),
        once: true,
      });
    }

    // "SELECTED WORK" TYPES OUT as you scroll into the dark desk (scroll-driven, so
    // no auto-type flicker) then stays as the fixed backdrop the windows float over
    if (wgTitle && wgTitleText) {
      const fullTitle = wgTitle.dataset.text;
      ScrollTrigger.create({
        trigger: "#work-desk",
        start: "top top",          // the sticky backdrop locks to CENTER exactly here → title types centered, never at the bottom
        end: "top top-=55%",       // types over the next ~half screen while it stays centered
        scrub: reduced ? false : 0.55,
        onUpdate: (self) => {
          const n = Math.round(self.progress * fullTitle.length);
          if (wgTitleText.textContent.length !== n) wgTitleText.textContent = fullTitle.slice(0, n);
          wgTitle.classList.toggle("go", self.progress > 0.985);
        },
      });
    }

    // rising "data-bit" particles drifting up the dark desktop behind the windows
    const pcv = document.getElementById("work-particles");
    if (pcv && !reduced) {
      const pctx = pcv.getContext("2d");
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      let pw = 0, ph = 0, bits = [], praf = 0, prunning = false;
      function psize() {
        pw = pcv.width = Math.round(pcv.clientWidth * dpr);
        ph = pcv.height = Math.round(pcv.clientHeight * dpr);
        const n = Math.max(28, Math.round((pw * ph) / (32000 * dpr)));
        bits = [];
        for (let i = 0; i < n; i++) {
          bits.push({
            x: Math.random() * pw, y: Math.random() * ph,
            r: (Math.random() * 1.4 + 0.5) * dpr,
            sp: (Math.random() * 0.5 + 0.18) * dpr,
            a: Math.random() * 0.45 + 0.12,
            sq: Math.random() < 0.28, // a few are tiny squares — "bits"
          });
        }
      }
      function ptick() {
        pctx.clearRect(0, 0, pw, ph);
        for (const b of bits) {
          b.y -= b.sp;
          if (b.y < -6) { b.y = ph + 6; b.x = Math.random() * pw; }
          pctx.fillStyle = "rgba(130,165,255," + b.a + ")";
          if (b.sq) { pctx.fillRect(b.x, b.y, b.r * 1.6, b.r * 1.6); }
          else { pctx.beginPath(); pctx.arc(b.x, b.y, b.r, 0, 6.2832); pctx.fill(); }
        }
        praf = requestAnimationFrame(ptick);
      }
      psize();
      window.addEventListener("resize", psize);
      // only animate while the desk is on screen (saves battery)
      new IntersectionObserver((es) => {
        es.forEach((e) => {
          if (e.isIntersecting && !prunning) { prunning = true; ptick(); }
          else if (!e.isIntersecting && prunning) { prunning = false; cancelAnimationFrame(praf); }
        });
      }, { threshold: 0 }).observe(document.getElementById("work-desk"));

      // keep the data-bits hidden until the laptop (and its bezel) is fully gone — during the
      // last of the dive the desk is already rising behind the fading screen, so un-gated dots
      // would show over the bezel. Fade them in only once the dark desktop owns the frame.
      gsap.set(pcv, { opacity: 0 });
      ScrollTrigger.create({
        trigger: "#work-desk",
        start: "top top",          // desk centered → dive done, screen fully faded
        end: "top top-=22%",
        scrub: true,
        onUpdate: (self) => { pcv.style.opacity = String(self.progress); },
      });
    }
  }

  /* ============================================================
     HERO — black-studio walk-in video, plays once per page load.
     A small analysis canvas watches for him entering the frame,
     which triggers the typewriter intro.
     ============================================================ */
  const video = document.getElementById("hero-video");
  const heroMission = document.getElementById("hero-mission");
  const stage = document.getElementById("hero-stage");

  let fellBack = false;
  function fallbackNoVideo() {
    if (fellBack) return;
    fellBack = true;
    document.body.classList.add("no-video");
    typeSequence();
    if (heroMission) heroMission.classList.add("show");
  }

  if (!video || reduced) { fallbackNoVideo(); return; }

  video.addEventListener("error", fallbackNoVideo);
  const loadTimeout = setTimeout(() => { if (video.readyState < 2) fallbackNoVideo(); }, 5000);

  let started = false;
  function tick() {
    if (video.ended) {
      typeSequence(); // safety: make sure the intro ran
      if (heroMission) heroMission.classList.add("show");
      return; // played once — stop watching
    }
    requestAnimationFrame(tick);
    if (video.readyState >= 2) {
      // type the headline as he stops and turns toward the camera (~2.5s)
      if (!typed && video.currentTime > 2.5) typeSequence();
      if (heroMission && video.currentTime > video.duration - 0.9) heroMission.classList.add("show");
    }
  }

  function startHero() {
    if (started || fellBack) return;
    started = true;
    clearTimeout(loadTimeout);
    const p = video.play();
    if (p && p.catch) p.catch(fallbackNoVideo);
    requestAnimationFrame(tick);
  }

  if (video.readyState >= 3) startHero();
  else video.addEventListener("canplay", startHero);
})();
