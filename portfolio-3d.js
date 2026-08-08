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
  // phones: don't re-layout every pinned trigger when the URL bar slides away mid-scroll
  ScrollTrigger.config({ ignoreMobileResize: true });

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
    // phones get a lighter ride: shorter pinned scroll, every-2nd frame, and
    // frames decoded at ~canvas resolution instead of 1440p (a phone can't hold
    // 148 full-res ImageBitmaps in RAM the way a desktop can)
    // viewport-based (not window.screen) so a phone-sized frame — devtools emulation
    // or mobile-preview.html — exercises the same path a real phone does
    const seqLite = Math.min(window.innerWidth, window.innerHeight) < 700;
    const VIDEO_PX = seqLite ? 1800 : 2000;  // pinned scroll: most of the open-up + the dive (in full view). Phones get nearly the desktop distance so the push-in isn't rushed
    const HOLD_PX = 0;      // release into the desk the instant the dive ends → title centers exactly when the camera stops
    const OPEN_FRAC = 0.12; // only a sliver of the open-up whips by during entry; the REST of the lid opening plays in the big centered view
    const SEQ_STEP = seqLite ? 2 : 1;
    const SEQ_RESIZE = seqLite ? { resizeWidth: 820, resizeQuality: "high" } : null;

    /* ---- EXPERIMENTS (local only — set either back to false to restore) ----
       AUTO_TYPE_TITLE : "SELECTED WORK" types itself on a timer (not scroll-driven)
       LAPTOP_PLAY_MODE: the laptop opens as a self-playing clip that plays forward
                         when you approach and reverses when you leave (not scrub) */
    const AUTO_TYPE_TITLE  = true;   // "SELECTED WORK" types itself on a timer
    const LAPTOP_PLAY_MODE = false;  // false = scroll-scrub the laptop open (kept); true = self-playing clip
    const PLAY_SECONDS = 2.6; // (play-mode only) full open+dive duration, time-based

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
      // phones cap at 1.5x: the frames are upscaled at this point anyway, so a full
      // 2x buffer is ~1.8x the pixels to fill every frame for no visible gain
      const dpr = Math.min(window.devicePixelRatio || 1, seqLite ? 1.5 : 2);
      workCanvas.width = Math.round(workCanvas.clientWidth * dpr);
      workCanvas.height = Math.round(workCanvas.clientHeight * dpr);
      shownIdx = -1; // buffer is cleared by the resize — force a redraw
    }
    /* Portrait phones: cover-fitting the 16:9 frame would show only a center sliver
       (the laptop unrecognizable), so frame the LAPTOP instead — scale so the machine
       (the center ~SEQ_SPAN of the frame) spans the canvas width, letterboxed with
       bands stretched from the frame's own edge rows (they track the studio bg: light
       while it opens, black once dived). Past SEQ_BLEND0 of the sequence the scale
       eases up to full cover, so the bands are gone before the zoom pushes the laptop
       past the source frame's edges (whose stretched rows would smear). */
    /* The image stays CENTRED the whole way. That makes the source's bottom edge
       rows the binding constraint: they are clean floor only through frame ~82
       (the laptop base enters them at 84), so the push-in has to reach full-bleed
       — retiring both bands — by then. Hence the window below. */
    const SEQ_SPAN = 0.58;
    /* The push-in is defined in LOG space, where a constant rate is what reads as
       constant speed. Velocity ramps up from zero across Z_F0→Z_F1 while the lid
       opens, then holds CONSTANT — it never brakes. Timing is pinned so it passes
       full-bleed exactly at Z_FCOVER (both bands must be retired before frame 84,
       where the source's bottom rows stop being clean floor), and it deliberately
       keeps going past that, flying on into the screen instead of stalling the
       moment the frame is filled and leaving the power-on to happen in dead air. */
    const Z_F0 = 24, Z_F1 = 62, Z_FCOVER = 82, Z_OVER = 2.2;
    function zoomScale(fit, cover, f) {
      const R = cover / fit;
      if (!(R > 1.001)) return cover;
      const ramp = Z_F1 - Z_F0;
      // derived from R so full-bleed lands on Z_FCOVER at any screen aspect
      const cruise = Math.log(R) / (ramp / 2 + (Z_FCOVER - Z_F1));
      let u;
      if (f <= Z_F0) u = 0;
      else if (f <= Z_F1) { const d = f - Z_F0; u = cruise * d * d / (2 * ramp); }
      else u = cruise * (ramp / 2 + (f - Z_F1));
      return Math.min(fit * Math.exp(u), cover * Z_OVER);
    }

    /* Letterbox bands take their colour from the frame's own edge row so they
       track the studio background. Stretching that row directly turns its
       per-column variation into vertical streaks, so instead we average it into
       a few slabs and fill with a smooth gradient.
       The sampling is deliberately 1:1 with smoothing OFF: asking canvas to
       downscale the row in one step makes Chrome mipmap the WHOLE bitmap, which
       fills the band with a blur of the entire frame (dark in the middle, where
       the laptop is) instead of the edge row. */
    const edgeCv = document.createElement("canvas");
    const edgeCtx = edgeCv.getContext("2d", { willReadFrequently: true });
    const BAND_STOPS = 8;
    const bandCache = new Map(); // "idx|srcY" -> array of "r,g,b" slab averages

    function bandStops(bm, srcY, key) {
      const hit = bandCache.get(key);
      if (hit) return hit;
      const w = bm.width;
      if (edgeCv.width !== w) { edgeCv.width = w; edgeCv.height = 2; }
      edgeCtx.imageSmoothingEnabled = false;
      edgeCtx.drawImage(bm, 0, srcY, w, 2, 0, 0, w, 2); // 1:1 — no filtering
      const d = edgeCtx.getImageData(0, 0, w, 1).data;
      const stops = [];
      for (let i = 0; i < BAND_STOPS; i++) {
        const x0 = Math.floor((i / BAND_STOPS) * w);
        const x1 = Math.max(x0 + 1, Math.floor(((i + 1) / BAND_STOPS) * w));
        let r = 0, g = 0, b = 0, n = 0;
        for (let px = x0; px < x1; px += 3) { const o = px * 4; r += d[o]; g += d[o + 1]; b += d[o + 2]; n++; }
        stops.push(((r / n) | 0) + "," + ((g / n) | 0) + "," + ((b / n) | 0));
      }
      bandCache.set(key, stops);
      return stops;
    }

    /* Each sample is a getImageData — a GPU→CPU readback of the bitmap. Doing one
       per frame stalled the scroll: lazily it hitched the scrub, and eagerly it
       hitched page load (74 decodes × 2 readbacks, landing right as you scroll
       toward the section). But the bands barely change — measured across the whole
       banded phase the top edge holds 238.0±0.1 luma and the bottom 217.4±1.2 — so
       a few anchor frames cover all of them. */
    const BAND_ANCHORS = [0, 40, 80];
    function anchorFor(idx) {
      let best = BAND_ANCHORS[0];
      for (const a of BAND_ANCHORS) { if (Math.abs(a - idx) < Math.abs(best - idx)) best = a; }
      return best;
    }
    function primeBands(i, bm) {
      if (window.innerWidth >= window.innerHeight) return; // landscape draws no bands
      if (BAND_ANCHORS.indexOf(i) < 0) return;
      try {
        bandStops(bm, 0, i + "|t");
        bandStops(bm, bm.height - 2, i + "|b");
      } catch (e) { /* an optimisation only — drawBand still computes on demand */ }
    }

    function drawBand(bm, srcY, dy, dh, key) {
      if (dh <= 0) return;
      const stops = bandStops(bm, srcY, key);
      const grad = ctx.createLinearGradient(0, 0, workCanvas.width, 0);
      for (let i = 0; i < stops.length; i++) {
        grad.addColorStop(i / (stops.length - 1), "rgb(" + stops[i] + ")");
      }
      ctx.fillStyle = grad;
      ctx.fillRect(0, dy, workCanvas.width, dh);
    }
    function drawBitmap(bm, fidx) {
      const cw = workCanvas.width, ch = workCanvas.height;
      const cover = Math.max(cw / bm.width, ch / bm.height); // cover fit
      let s = cover;
      if (cw < ch) {
        const fit = Math.min(cover, cw / (bm.width * SEQ_SPAN));
        s = zoomScale(fit, cover, fidx);
      }
      const dw = bm.width * s, dh = bm.height * s;
      const dy = (ch - dh) / 2;
      if (dh < ch - 1) {
        const topH = Math.ceil(dy) + 1, botY = Math.floor(dy + dh) - 1;
        const a = anchorFor(fidx);
        if (topH > 0) drawBand(bm, 0, 0, topH, a + "|t");
        if (botY < ch - 1) drawBand(bm, bm.height - 2, botY, ch - botY, a + "|b");
      }
      ctx.drawImage(bm, (cw - dw) / 2, dy, dw, dh);
      fitGlowToImage(dy, dh);
    }

    /* keep the power-on bloom on the SCREEN: on portrait the image is a band that
       moves and grows, so the CSS glow box (tuned for cover fit) would spill onto
       the letterbox — track the live image rect instead */
    let glowKey = "";
    function fitGlowToImage(dy, dh) {
      if (!workGlow) return;
      const cssW = workCanvas.clientWidth, cssH = workCanvas.clientHeight;
      if (cssW >= cssH) { // landscape keeps the CSS box
        if (glowKey !== "wide") { glowKey = "wide"; workGlow.style.inset = ""; }
        return;
      }
      const k = cssH / workCanvas.height; // device px → css px
      const top = dy * k, h = dh * k;
      const key = Math.round(top) + ":" + Math.round(h);
      if (key === glowKey) return;
      glowKey = key;
      workGlow.style.inset =
        Math.round(top + h * 0.10) + "px 7% " +
        Math.round(cssH - top - h + h * 0.14) + "px 7%";
    }
    const SEQ_LAST = Math.floor((SEQ_COUNT - 1) / SEQ_STEP) * SEQ_STEP; // last index actually loaded
    function drawFrame(fidx) {
      if (!seqReady || !ctx) return;
      let idx = Math.max(0, Math.min(SEQ_COUNT - 1, Math.round(fidx)));
      if (SEQ_STEP > 1) idx = Math.min(Math.round(idx / SEQ_STEP) * SEQ_STEP, SEQ_LAST); // snap to a loaded frame
      curIdx = idx;
      if (idx === shownIdx) return; // scrub lands on the same frame for many ticks — don't repaint it
      const bm = bitmaps.get(idx);
      if (bm) { drawBitmap(bm, idx); shownIdx = idx; }                     // always ready once loaded
      else if (bitmaps.has(shownIdx)) { drawBitmap(bitmaps.get(shownIdx), shownIdx); } // only during the brief initial load
    }
    // ?seqdebug lets tooling drive the sequence without scrolling (headless checks)
    if (new URLSearchParams(location.search).has("seqdebug")) window.__pfDraw = drawFrame;

    if (workCanvas && ctx) {
      for (let i = 0; i < SEQ_COUNT; i += SEQ_STEP) {
        const img = new Image();
        img.onload = () => {
          // downscale at decode time on phones (falls back if the browser
          // doesn't support resize options)
          const decode = SEQ_RESIZE
            ? createImageBitmap(img, SEQ_RESIZE).catch(() => createImageBitmap(img))
            : createImageBitmap(img);
          decode.then((bm) => {
            bitmaps.set(i, bm); // keep every loaded frame decoded — never released
            primeBands(i, bm);  // sample edge rows NOW, never mid-scroll
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

    // power-on visuals (canvas cross-fade, bar text colour, bloom) as a function of
    // "dive progress" dp (0 = screen just opening, 1 = fully dived/dark). Shared by
    // both the scrub path and the self-playing path so they stay identical.
    function diveVisuals(dp) {
      const canvasOp = dp > 0.82 ? Math.max(0, 1 - (dp - 0.82) / 0.18) : 1;
      if (workCanvas) workCanvas.style.opacity = String(canvasOp);
      if (bar) bar.classList.toggle("bar--light", dp < 0.62);
      if (workGlow) {
        let g;
        if (dp <= 0.48) g = 0;
        else if (dp <= 0.60) g = (dp - 0.48) / 0.12;
        else g = Math.max(0, 1 - (dp - 0.60) / 0.40);
        workGlow.style.opacity = String(g);
        const z = Math.max(0, (dp - 0.48) / 0.52);
        workGlow.style.transform = "scale(" + (1 + Math.pow(z, 1.7) * 4.0).toFixed(3) + ")";
      }
    }

    // EXPERIMENT: self-playing laptop. playhead is a float frame index that drifts
    // toward playTarget (0 = closed, last = fully open/dived) at a TIME-based rate, so
    // the clip lasts PLAY_SECONDS on any monitor (60/120/144Hz) and shows every frame
    // — no skipping/judder. scrollFrame lets your scroll drag it forward faster (so you
    // can scroll past it), and it can never enter the desk before the open completes.
    let playhead = 0, playTarget = 0, scrollFrame = -1, lastT = 0, playRAF = 0, playRunning = false;
    const PLAY_FPS = (SEQ_COUNT - 1) / PLAY_SECONDS; // frames advanced per second
    function playDraw() {
      const idx = Math.max(0, Math.min(SEQ_COUNT - 1, playhead));
      drawFrame(idx);
      const dp = Math.max(0, Math.min(1, (idx / (SEQ_COUNT - 1) - OPEN_FRAC) / (1 - OPEN_FRAC)));
      diveVisuals(dp);
    }
    function playTick(now) {
      const dt = lastT ? Math.min(0.05, (now - lastT) / 1000) : 0; // clamp dt after tab-away
      lastT = now;
      // time-based drift toward the engaged target
      if (playhead < playTarget) playhead = Math.min(playTarget, playhead + PLAY_FPS * dt);
      else if (playhead > playTarget) playhead = Math.max(playTarget, playhead - PLAY_FPS * dt);
      // scroll coupling (only while pinned): forward → scroll can push it ahead; this
      // also guarantees a fully-open screen by the time the pin releases into the desk
      if (scrollFrame >= 0 && playTarget > 0) playhead = Math.max(playhead, scrollFrame);
      playhead = Math.max(0, Math.min(SEQ_COUNT - 1, playhead));
      playDraw();
      playRAF = requestAnimationFrame(playTick);
    }
    function startPlayLoop() { if (!playRunning) { playRunning = true; lastT = 0; playRAF = requestAnimationFrame(playTick); } }
    function stopPlayLoop() { playRunning = false; cancelAnimationFrame(playRAF); }
    if (LAPTOP_PLAY_MODE && workCanvas && !reduced) {
      // keep the loop running while the work section is on screen (stop off-screen)
      new IntersectionObserver((es) => es.forEach((e) => {
        if (e.isIntersecting) startPlayLoop(); else stopPlayLoop();
      }), { threshold: 0 }).observe(workSection);
      ScrollTrigger.create({
        trigger: "#work",
        start: "top 62%",                                                  // "close enough" → play forward
        onEnter:     () => { playTarget = SEQ_COUNT - 1; if (bar) bar.classList.add("bar--light"); startPlayLoop(); },
        onLeaveBack: () => { playTarget = 0; scrollFrame = -1; startPlayLoop(); }, // "far away enough" → reverse it closed
      });
    }

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
          workCanvas.style.opacity = "1"; // always fully visible while opening
          if (bar) bar.classList.add("bar--light"); // laptop is on WHITE here → dark bar text
          if (LAPTOP_PLAY_MODE) return;   // self-player draws the frames instead
          drawFrame(self.progress * OPEN_FRAC * (SEQ_COUNT - 1));
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
        if (LAPTOP_PLAY_MODE) {
          // hand the pinned scroll position to the self-player as a forward "floor"
          scrollFrame = (OPEN_FRAC + scrub.p * (1 - OPEN_FRAC)) * (SEQ_COUNT - 1);
          return; // frames + power-on visuals handled by the self-player
        }
        const vp = OPEN_FRAC + scrub.p * (1 - OPEN_FRAC); // 0.2 → 1.0 of the sequence
        drawFrame(vp * (SEQ_COUNT - 1));
        // cross-fade + bar colour + power-on bloom, all keyed to the dive progress
        diveVisuals(scrub.p);
      },
    });
    tl.to({}, { duration: HOLD_PX }); // brief hold on the dark screen, then the pin releases into the desk

    // the trio flies in from BEYOND the right edge of the screen once you've
    // scrolled a beat into the desk — the dark desktop (title + particles)
    // gets a moment to exist before the windows arrive.
    if (!reduced) {
      const featIn = () => gsap.to("#featured-grid .wcard", {
        opacity: 1, x: 0, duration: 1.0, ease: "power3.out",
        stagger: 0.18, overwrite: true, clearProps: "transform,opacity",
      });
      gsap.set("#featured-grid .wcard", { opacity: 0, x: () => window.innerWidth });
      const featST = ScrollTrigger.create({
        trigger: "#featured-grid",
        start: "top 80%",
        once: true,
        onEnter: featIn,
      });
      // refresh-mid-page: scroll restoration can land past the trigger before it
      // exists — a crossing that already happened never fires onEnter.
      if (featST.progress > 0) { featST.kill(); featIn(); }
    }

    // "SELECTED WORK" TYPES OUT as you scroll into the dark desk (scroll-driven, so
    // no auto-type flicker) then stays as the fixed backdrop the windows float over
    if (wgTitle && wgTitleText) {
      const fullTitle = wgTitle.dataset.text;
      if (AUTO_TYPE_TITLE) {
        // EXPERIMENT: types itself on a timer once the title is centered (not scroll-driven)
        let typeTimer = null;
        const startType = () => {
          clearInterval(typeTimer);
          let n = 0;
          wgTitleText.textContent = "";
          wgTitle.classList.remove("go");
          typeTimer = setInterval(() => {
            n++;
            wgTitleText.textContent = fullTitle.slice(0, n);
            if (n >= fullTitle.length) { clearInterval(typeTimer); wgTitle.classList.add("go"); }
          }, 85); // ~1.1s for "SELECTED WORK"
        };
        ScrollTrigger.create({
          trigger: "#work-desk",
          start: "top top",          // fires when the sticky title locks to centre
          onEnter: startType,        // scroll into it → type it out by itself
          onLeaveBack: () => { clearInterval(typeTimer); wgTitleText.textContent = ""; wgTitle.classList.remove("go"); },
        });
      } else {
        ScrollTrigger.create({
          trigger: "#work-desk",
          start: "top top",          // the sticky backdrop locks to CENTER exactly here → title types centered, never at the bottom
          end: seqLite ? "top top-=40%" : "top top-=55%", // types over the next ~half screen while it stays centered (quicker on phones)
          scrub: reduced ? false : 0.55,
          onUpdate: (self) => {
            const n = Math.round(self.progress * fullTitle.length);
            if (wgTitleText.textContent.length !== n) wgTitleText.textContent = fullTitle.slice(0, n);
            wgTitle.classList.toggle("go", self.progress > 0.985);
          },
        });
      }
    }

    // rising "data-bit" particles drifting up the dark screen. Reusable so the same
    // field continues from the WORK desktop down through the CONTACT section.
    function spawnBits(canvas, observeEl) {
      const pctx = canvas.getContext("2d");
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      let pw = 0, ph = 0, bits = [], praf = 0, prunning = false;
      function psize() {
        pw = canvas.width = Math.round(canvas.clientWidth * dpr);
        ph = canvas.height = Math.round(canvas.clientHeight * dpr);
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
      // only animate while that section is on screen (saves battery)
      new IntersectionObserver((es) => {
        es.forEach((e) => {
          if (e.isIntersecting && !prunning) { prunning = true; ptick(); }
          else if (!e.isIntersecting && prunning) { prunning = false; cancelAnimationFrame(praf); }
        });
      }, { threshold: 0 }).observe(observeEl);
    }

    const pcv = document.getElementById("work-particles");
    if (pcv && !reduced) {
      spawnBits(pcv, document.getElementById("work-desk"));
      // keep the WORK data-bits hidden until the laptop (and its bezel) is fully gone —
      // during the last of the dive the desk is already rising behind the fading screen,
      // so un-gated dots would show over the bezel. Fade them in once the desktop owns it.
      gsap.set(pcv, { opacity: 0 });
      ScrollTrigger.create({
        trigger: "#work-desk",
        start: "top top",          // desk centered → dive done, screen fully faded
        end: "top top-=22%",
        scrub: true,
        onUpdate: (self) => { pcv.style.opacity = String(self.progress); },
      });
    }

    // continue the same drifting bits behind the CONTACT ("Let's Build Something") section
    const ccv = document.getElementById("contact-particles");
    if (ccv && !reduced) spawnBits(ccv, document.getElementById("contact"));
  }

  /* ---------------- featured story: maximize-window expansion ----------------
     One overlay serves all three cards. Opening MOVES the card's .wexp-content
     node into #wmax-body (no cloning, no fetching); closing moves it back.
     Instant path when reduced-motion OR document.hidden — a frozen rAF loop
     must never leave the window half-open. */
  const wmax = document.getElementById("wmax");
  const wmaxBody = document.getElementById("wmax-body");
  const wmaxBackdrop = document.getElementById("wmax-backdrop");
  const WMAX_SLUGS = { myplan: "card-myplan", universe: "card-universe", process: "card-process" };
  let wmaxCard = null;      // card whose story is open
  let wmaxBusy = false;  // held through open/close tweens — the wmaxCard mutex alone frees too early (onComplete lags it by ~0.4s)
  let wmaxLastFocus = null;

  function wmaxInstant() { return reduced || document.hidden; }

  function openStory(card) {
    if (!wmax || !card || wmaxCard || wmaxBusy) return;
    const content = card.querySelector(".wexp-content");
    if (!content) return;
    wmaxCard = card;
    wmaxLastFocus = document.activeElement;

    wmaxBody.appendChild(content);
    content.hidden = false;
    document.getElementById("wmax-path").textContent = card.dataset.path || "";
    document.getElementById("wmax-open").setAttribute("href", card.dataset.href || "#");
    wmax.style.setProperty("--theme", getComputedStyle(card).getPropertyValue("--theme").trim());

    wmaxBackdrop.hidden = false;
    wmax.hidden = false;
    document.documentElement.classList.add("wmax-open");
    lenis.stop();
    if (card.dataset.slug) history.replaceState(null, "", "#" + card.dataset.slug);

    const from = card.getBoundingClientRect();      // measure BEFORE hiding the card
    card.classList.add("is-open");
    wmaxBackdrop.classList.add("show");
    wmax.classList.add("show");
    wmaxBody.scrollTop = 0;

    if (wmaxInstant()) { wmaxFocusIn(); return; }
    const to = wmax.getBoundingClientRect();
    wmaxBusy = true;
    gsap.fromTo(wmax,
      { x: from.left - to.left, y: from.top - to.top,
        scaleX: from.width / to.width, scaleY: from.height / to.height,
        transformOrigin: "top left" },
      { x: 0, y: 0, scaleX: 1, scaleY: 1, duration: 0.45, ease: "power3.inOut",
        onComplete: () => { gsap.set(wmax, { clearProps: "transform" }); wmaxFocusIn(); wmaxBusy = false; } });
  }

  function closeStory() {
    if (!wmaxCard || wmaxBusy) return;
    const card = wmaxCard;
    wmaxCard = null;
    const finish = () => {
      wmax.classList.remove("show");
      wmaxBackdrop.classList.remove("show");
      wmax.hidden = true;
      wmaxBackdrop.hidden = true;
      const content = wmaxBody.querySelector(".wexp-content");
      if (content) { content.hidden = true; card.appendChild(content); }
      card.classList.remove("is-open");
      document.documentElement.classList.remove("wmax-open");
      lenis.start();
      history.replaceState(null, "", location.pathname + location.search);
      if (wmaxLastFocus && wmaxLastFocus.focus) wmaxLastFocus.focus();
    };
    if (wmaxInstant()) { finish(); return; }
    const to = card.getBoundingClientRect();
    const from = wmax.getBoundingClientRect();
    // card scrolled far off screen → just fade instead of flying across the page
    if (to.bottom < -40 || to.top > innerHeight + 40) {
      wmaxBusy = true;
      gsap.to(wmax, { opacity: 0, duration: 0.2, onComplete: () => { gsap.set(wmax, { clearProps: "opacity" }); finish(); wmaxBusy = false; } });
      return;
    }
    wmaxBusy = true;
    gsap.to(wmax, {
      x: to.left - from.left, y: to.top - from.top,
      scaleX: to.width / from.width, scaleY: to.height / from.height,
      transformOrigin: "top left", duration: 0.4, ease: "power3.inOut",
      onComplete: () => { gsap.set(wmax, { clearProps: "transform" }); finish(); wmaxBusy = false; },
    });
  }

  function wmaxFocusIn() {
    const btn = document.getElementById("wmax-close");
    if (btn) btn.focus();
  }

  if (wmax) {
    document.querySelectorAll(".wcard-featured").forEach((card) => {
      card.querySelectorAll(".w-max, .wcard-read").forEach((btn) => {
        btn.addEventListener("click", (e) => { e.preventDefault(); e.stopPropagation(); openStory(card); });
      });
      // click anywhere on the card = open the story; real links (title, CTA)
      // and the explicit buttons keep their own behavior.
      card.addEventListener("click", (e) => {
        if (e.target.closest("a, button")) return;
        openStory(card);
      });
    });
    wmaxBackdrop.addEventListener("click", closeStory);
    document.getElementById("wmax-close").addEventListener("click", closeStory);
    document.addEventListener("keydown", (e) => {
      if (!wmaxCard) return;
      if (e.key === "Escape") { closeStory(); return; }
      if (e.key === "Tab") {
        // keep focus inside the dialog
        const focusables = wmax.querySelectorAll("button, a[href]");
        if (!focusables.length) return;
        const first = focusables[0], last = focusables[focusables.length - 1];
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
      }
    });
  }

  /* ---------------- work panes: featured <-> other projects ---------------- */
  const paneFeat = document.getElementById("pane-featured");
  const paneOthers = document.getElementById("pane-others");
  const paneNext = document.getElementById("pane-next");
  const paneBack = document.getElementById("pane-back");
  if (paneFeat && paneOthers && paneNext && paneBack) {
    function showPane(others) {
      paneFeat.classList.toggle("is-active", !others);
      paneOthers.classList.toggle("is-active", others);
      document.getElementById("work-grid").classList.toggle("others-active", others);
      paneFeat.setAttribute("aria-hidden", others ? "true" : "false");
      paneOthers.setAttribute("aria-hidden", others ? "false" : "true");
      paneNext.hidden = others;
      paneBack.hidden = !others;
      (others ? paneBack : paneNext).focus();
    }
    paneNext.addEventListener("click", () => showPane(true));
    paneBack.addEventListener("click", () => showPane(false));
  }

  // Deep links: #myplan / #universe / #process open the story directly.
  // Wait out the boot overlay (class-based — never touch bootDone: it is
  // declared AFTER the boot block's early return and would throw in
  // reduced-motion mode), then land on the desk and open the window.
  (function wmaxDeepLink() {
    const slug = location.hash.replace("#", "");
    const cardId = WMAX_SLUGS[slug];
    if (!cardId) return;
    const tryOpen = () => {
      if (document.documentElement.classList.contains("booting")) { setTimeout(tryOpen, 150); return; }
      const card = document.getElementById(cardId);
      if (!card) return;
      const desk = document.getElementById("work-desk");
      if (desk) {
        const y = desk.getBoundingClientRect().top + window.scrollY + window.innerHeight * 0.06;
        lenis.scrollTo(y, { immediate: true });
        window.scrollTo(0, y); // belt and braces: lenis may be frozen in a hidden tab
      }
      openStory(card);
    };
    tryOpen();
  })();

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

  /* ---- boot overlay -------------------------------------------------------
     The overlay is already on screen (CSS shows it from the first paint), so
     this code only fills the bar and decides WHEN to let go. Two rules:
       - never release before MIN_MS, or a warm cache turns the loading screen
         into a black flicker, which looks like a bug rather than an intro;
       - always release, on every exit path. It used to sit after the
         `!video || reduced` early return, so reduced-motion visitors would have
         been left staring at a black screen forever once the overlay became
         visible by default. */
  const boot = document.getElementById("boot");
  const bootFill = document.getElementById("boot-fill");
  const bootPct = document.getElementById("boot-pct");
  // monotonic: the readout may never count DOWN, which is what it would do when
  // the elapsed-time floor outruns the real buffered fraction and then reality
  // catches up. A percentage that goes backwards reads as broken.
  let bootSeen = 0;
  const setBoot = p => {
    bootSeen = Math.max(bootSeen, Math.min(1, p));
    if (bootFill) bootFill.style.width = Math.round(bootSeen * 100) + "%";
    if (bootPct) bootPct.textContent = Math.round(bootSeen * 100) + "%";
  };
  // ?bootdemo holds the overlay longer, to review it on a warm cache
  const demoBoot = new URLSearchParams(location.search).has("bootdemo");
  const DEMO_MS = 2600;
  const MIN_MS = demoBoot ? DEMO_MS : 900;
  const bootT0 = performance.now();
  let bootDone = false, bootTick = 0, bootPending = false;

  let floor = 0;
  bootTick = setInterval(() => {
    floor = Math.min(0.92, floor + (demoBoot ? 0.05 : 0.09));
    let buf = 0;
    try {
      if (video && video.buffered.length && video.duration) {
        buf = video.buffered.end(video.buffered.length - 1) / video.duration;
      }
    } catch (e) { /* buffered ranges can throw mid-load */ }
    // elapsed-time floor keeps the bar honest-looking when there is nothing to
    // measure (no video at all, or an instant cache hit)
    setBoot(Math.max(floor, buf));
  }, 90);

  function bootHide() {
    if (bootDone) return;
    const left = MIN_MS - (performance.now() - bootT0);
    if (left > 0) {                       // too early — come back when it's earned
      if (!bootPending) {
        bootPending = true;
        setTimeout(() => { bootPending = false; bootHide(); }, left);
      }
      return;
    }
    bootDone = true;
    clearInterval(bootTick);
    document.documentElement.classList.remove("booting");
    if (boot) {
      setBoot(1);                       // always land on 100% before fading
      boot.classList.add("done");
      setTimeout(() => boot.classList.add("gone"), 600);
    }
  }
  // last-resort release: whatever happens to the video, the page comes back
  const bootFailsafe = setTimeout(bootHide, 8000);

  if (!video || reduced) { fallbackNoVideo(); bootHide(); return; }

  video.addEventListener("error", () => { bootHide(); fallbackNoVideo(); });
  const loadTimeout = setTimeout(() => {
    if (video.readyState < 2) { bootHide(); fallbackNoVideo(); }
  }, 8000);

  /* The camera never moves and the clip always plays from 0 — that is what makes
     it read as walking in from off-screen rather than appearing mid-frame. A
     phone's centred crop shows ~45% of the 2.33:1 footage and he only reaches
     that window around 0.6s, so playing from the top costs a beat of black and
     buys a real entrance. (It also avoids seeking: the clip has a single
     keyframe, so every seek decodes from the start.) */
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
    clearTimeout(loadTimeout);
    clearTimeout(bootFailsafe);
    bootHide();
    if (!bootDone) { setTimeout(startHero, 100); return; } // wait out the demo hold
    started = true;
    const p = video.play();
    if (p && p.catch) p.catch(() => { bootHide(); fallbackNoVideo(); });
    requestAnimationFrame(tick);
  }

  if (video.readyState >= 3) startHero();
  else video.addEventListener("canplay", startHero);
})();
