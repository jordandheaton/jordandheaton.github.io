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

  /* A REAL scroll lock. lenis.stop() alone does NOT hold the page: it stops
     Lenis's own smoothing but never calls preventDefault, so the browser keeps
     scrolling natively — the entrance played while the page slid out from under
     it, which is what made the cards seem to rush the last stretch. Blocking the
     input events instead leaves layout untouched, so `position: sticky` (the
     SELECTED WORK backdrop) keeps working, unlike overflow:hidden. */
  let scrollBlocker = null;
  function lockScroll(allowInside) {
    if (scrollBlocker) return;
    scrollBlocker = (e) => {
      if (allowInside && allowInside.contains(e.target)) return;  // let the open card scroll
      e.preventDefault();
    };
    window.addEventListener("wheel", scrollBlocker, { passive: false, capture: true });
    window.addEventListener("touchmove", scrollBlocker, { passive: false, capture: true });
    lenis.stop();
  }
  function unlockScroll() {
    if (!scrollBlocker) return;
    window.removeEventListener("wheel", scrollBlocker, { capture: true });
    window.removeEventListener("touchmove", scrollBlocker, { capture: true });
    scrollBlocker = null;
    lenis.start();
  }

  // story deep-link slugs — declared ABOVE the work section: the card-entrance
  // closures below check the hash at setup time, before the story block runs.
  // no #process: that project's own page is its write-up, so its card has no story
  const WMAX_SLUGS = { myplan: "card-myplan", universe: "card-universe" };

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
        refreshPriority: 1,   // refreshes before the cards pin below it
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

    // The trio arrives the way the Art of Ballroom track does: the section PINS
    // and scroll drives the movement, so the desk holds still with SELECTED WORK
    // centred while the windows come in. The difference in direction is the
    // point — there the track pans past you, here the cards come to you.
    //
    // gsap.matchMedia, not a one-off matchMedia() check: the layouts need
    // genuinely different treatments and the choice has to survive a resize.
    // Read once at setup, a phone that loaded wide got the desktop pin — which
    // pinned a stack three screens tall.
    if (!reduced) {
      const mm = gsap.matchMedia();

      mm.add("(min-width: 901px)", () => {
        const cards = gsap.utils.toArray("#featured-grid .wcard");
        // .wcard carries `transition: transform 0.3s` for the hover lift, which
        // fought this tween on every frame — the cards were never actually
        // following the curve GSAP computed. This is why no amount of easing
        // changes ever fixed the arrival.
        cards.forEach((el) => el.classList.add("is-entering"));
        gsap.set(cards, { x: () => window.innerWidth * 0.85, opacity: 0 });
        // holds the edge arrow and the sunset band dark until the trio lands.
        // band-dim rides alongside cards-moving here (the entrance is pure CSS,
        // so the two classes always flip at the same instant) — see showPane()
        // for why a pane swap needs them to split apart.
        workGrid.classList.add("cards-moving", "band-dim");

        // Arriving TRIGGERS the entrance; the entrance then plays at its own
        // pace. Scrubbing it to scroll meant a fast flick had to be honoured
        // instantly, which is what read as a snap — the animation was only ever
        // as smooth as the wheel driving it. Scrolling is held for the ~1.9s it
        // runs, so it always plays out the same way.
        let played = false;
        const play = () => {
          if (played) return;
          played = true;
          lockScroll();
          const release = () => unlockScroll();
          // straight timing: constant speed, one after the other, nothing else
          gsap.to(cards, {
            x: 0, opacity: 1, duration: 0.85, ease: "none", stagger: 0.3,
            // an inline transform of its own outranks the stylesheet, so
            // without this the cards never lift on hover again
            clearProps: "transform",
            onComplete: () => {
              cards.forEach((el) => el.classList.remove("is-entering"));
              workGrid.classList.remove("cards-moving", "band-dim");   // now the light comes up
              release();
            },
          });
          // a page that never scrolls again is far worse than a missed beat
          gsap.delayedCall(3.4, () => {
            release();
            workGrid.classList.remove("cards-moving", "band-dim");
          });
        };

        const st = ScrollTrigger.create({
          trigger: "#work-panes",
          start: "center center",     // engages once the row is dead centre
          // the pin keeps holding after the cards land, so they sit finished
          // for a beat before the page moves on
          end: "+=900",
          pin: "#work-panes",
          pinSpacing: true,
          // NO anticipatePin. It pins slightly early based on scroll velocity,
          // and Lenis's smoothing makes that estimate wrong: the section
          // snapped 62px in a single frame the moment the pin engaged, which
          // is the "cards jump into place at the end" — the cards had already
          // landed, it was the whole row lurching underneath them.
          anticipatePin: 0,
          invalidateOnRefresh: true,
          // the laptop dive above is also pinned, and its pin-spacer shifts
          // every offset below it. Without an explicit order this measures
          // against a layout that does not exist yet and starts ~2600px early.
          refreshPriority: -1,
          onEnter: play,
        });
        // refresh mid-page can land past the trigger; show them, don't lock
        if (st.progress > 0) {
          played = true;
          gsap.set(cards, { x: 0, opacity: 1 });
          workGrid.classList.remove("cards-moving", "band-dim");
        }
        // A deep-link (#myplan etc.) opens its story over the desk, BEFORE this
        // trigger's start — and openStory() stops Lenis, so the entrance could
        // never fire and the cards (the opened one included) sat at opacity:0.
        // That reader landed past the choreography: resolve it, don't replay it.
        // clearProps, not x:0 — an inline transform of its own outranks the
        // stylesheet, and the cards would never lift on hover again
        if (WMAX_SLUGS[location.hash.replace("#", "")]) {
          played = true;
          gsap.set(cards, { opacity: 1, clearProps: "transform" });
          cards.forEach((el) => el.classList.remove("is-entering"));
          workGrid.classList.remove("cards-moving", "band-dim");
        }
        // resizing across the breakpoint reverts this context; a stale
        // .cards-moving or .band-dim would leave the arrow/band dark for good
        return () => workGrid.classList.remove("cards-moving", "band-dim");
      });

      mm.add("(max-width: 900px)", () => {
        // stacked, the trio runs about three screens tall — pinning that would
        // hold the reader still while two of the cards sat off-screen, so each
        // one simply arrives as it is reached
        gsap.utils.toArray("#featured-grid .wcard").forEach((el) => el.classList.add("is-entering"));
        gsap.set("#featured-grid .wcard", { opacity: 0, x: () => window.innerWidth * 0.85 });
        ScrollTrigger.batch("#featured-grid .wcard", {
          start: "top 78%",
          once: true,
          onEnter: (els) => gsap.to(els, {
            opacity: 1, x: 0, duration: 0.8, ease: "none",
            stagger: 0.2, overwrite: true,
            onComplete: () => els.forEach((el) => el.classList.remove("is-entering")),
          }),
        });
        gsap.utils.toArray("#featured-grid .wcard").forEach((el) => {
          if (el.getBoundingClientRect().top < window.innerHeight * 0.78) {
            gsap.to(el, { opacity: 1, x: 0, duration: 0.9, ease: "power2.out",
                          overwrite: true, clearProps: "transform,opacity" });
          }
        });
        // same deep-link resolution as the desktop branch: a story is about to
        // open over cards whose batch trigger can never fire under lockScroll
        if (WMAX_SLUGS[location.hash.replace("#", "")]) {
          gsap.utils.toArray("#featured-grid .wcard").forEach((el) => {
            gsap.set(el, { opacity: 1, clearProps: "transform" });
            el.classList.remove("is-entering");
          });
        }
      });

      // the label, the edge arrow and the sunset band all arrive together once
      // the cards have landed — none of them should precede the windows
      ScrollTrigger.create({
        trigger: "#featured-grid",
        start: "top 44%",
        onEnter: () => workGrid.classList.add("work-lit"),
        onLeaveBack: () => workGrid.classList.remove("work-lit"),
      });
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

  /* ---------------- featured story: THE CARD ITSELF EXPANDS ----------------
     No second element, no cross-fade: the card the reader clicked is lifted out
     of the grid (position:fixed at its own rect, a placeholder holding its slot
     open) and its geometry is tweened outward. Its chrome, title and blurb are
     the same nodes throughout, so there is nothing to swap and nothing to
     resnap — the write-up is already a child of the card and only fades in.
     Instant path when reduced-motion OR document.hidden, so a frozen rAF loop
     can never strand a half-open card. */
  const wmaxBackdrop = document.getElementById("wmax-backdrop");
  const CARD_GEOM = "position,margin,zIndex,left,top,width,height,transform";
  const FLIP_D = 0.62, FLIP_E = "power2.inOut";   // open and close are mirror images
  let wmaxCard = null;       // the card whose story is open
  let wmaxSlot = null;       // placeholder holding its grid slot
  let wmaxLastFocus = null;
  let wmaxBusy = false;      // held across the tween: wmaxCard alone frees too early
  let wmaxHideTimer = null;  // defers backdrop[hidden] until its fade-out has run

  function wmaxInstant() { return reduced || document.hidden; }

  // where an opened card settles: same box the old overlay used
  function expandedRect() {
    const w = Math.min(940, window.innerWidth * 0.94);
    const h = Math.min(window.innerHeight * 0.86, 900);
    return { left: (window.innerWidth - w) / 2, top: (window.innerHeight - h) / 2,
             width: w, height: h };
  }

  function openStory(card) {
    if (!card || wmaxCard || wmaxBusy) return;
    const content = card.querySelector(".wexp-content");
    if (!content) return;
    wmaxCard = card;
    wmaxLastFocus = document.activeElement;

    const from = card.getBoundingClientRect();

    // hold the card's place in the grid before it goes fixed, or the row
    // collapses and the two siblings slide sideways behind the backdrop
    const slot = document.createElement("div");
    slot.className = "wcard-slot";
    slot.style.height = from.height + "px";
    card.parentNode.insertBefore(slot, card);
    wmaxSlot = slot;

    content.hidden = false;
    card.classList.add("is-expanded");
    // Lenis swallows wheel events globally (and it is stopped while a story is
    // open), so without this the card cannot be scrolled at all.
    card.setAttribute("data-lenis-prevent", "");
    gsap.set(card, { position: "fixed", margin: 0, zIndex: 61,
                     left: from.left, top: from.top, width: from.width, height: from.height });
    // Portal it to <body>. The card lives inside .work-pane, which carries a
    // transform for the swipe and therefore its own stacking context — a
    // z-index of 61 down there still renders BEHIND a backdrop at 60 up here.
    // Fixed + explicit pixel geometry means the move is visually a no-op.
    document.body.appendChild(card);

    clearTimeout(wmaxHideTimer);   // a pending hide from a just-closed story
    wmaxBackdrop.hidden = false;
    document.documentElement.classList.add("wmax-open");
    lockScroll(card);
    if (card.dataset.slug) history.replaceState(null, "", "#" + card.dataset.slug);

    // FLIP. The card is put at its FINAL geometry immediately, so layout runs
    // exactly once; then a transform makes it *look* like the small card again,
    // and only that transform animates. Tweening left/top/width/height meant the
    // browser re-laid-out the card and re-wrapped every line of its text on
    // every frame (~34fps measured).
    const to = expandedRect();
    gsap.set(card, { left: to.left, top: to.top, width: to.width, height: to.height });
    if (wmaxInstant()) {
      wmaxBackdrop.classList.add("show", "is-blurred");
      wmaxPlayVideos(card);
      wmaxFocusIn(card);
      return;
    }
    const inner = card.querySelector(".wcard-inner");
    const last = card.getBoundingClientRect();
    const sx = from.width / last.width, sy = from.height / last.height;

    card.classList.add("is-flipping");
    gsap.set(card, { transformOrigin: "top left",
                     x: from.left - last.left, y: from.top - last.top,
                     scaleX: sx, scaleY: sy });
    // the inverse on the contents keeps every glyph at its true size
    if (inner) gsap.set(inner, { transformOrigin: "top left", scaleX: 1 / sx, scaleY: 1 / sy });

    void wmaxBackdrop.offsetWidth;
    wmaxBackdrop.classList.add("show");
    wmaxPlayVideos(card);
    wmaxBusy = true;

    // ONE timeline, both at position 0. As two separate tweens they started a
    // frame apart, so the card was already part-way open while the contents
    // were still counter-scaled for the closed size — the card lurched forward,
    // snapped back and grew again ("a little circling thing"), and the inner
    // measured 1225px instead of its true 940px on the first frame.
    const tl = gsap.timeline({
      onComplete: () => {
        gsap.set(card, { clearProps: "transform" });
        if (inner) gsap.set(inner, { clearProps: "transform" });
        card.classList.remove("is-flipping");
        wmaxBackdrop.classList.add("is-blurred");   // blur only once nothing moves
        wmaxBusy = false; wmaxFocusIn(card);
      },
    });
    // The counter-scale is derived from the card's CURRENT scale every frame.
    // Tweening it from 1/sx to 1 in parallel is not the same curve as the
    // inverse of the card's scale, so the contents breathed up to 19% wide
    // mid-flight. This keeps the product exactly 1.
    tl.to(card, {
      x: 0, y: 0, scaleX: 1, scaleY: 1, duration: FLIP_D, ease: FLIP_E,
      onUpdate: () => {
        if (!inner) return;
        gsap.set(inner, { scaleX: 1 / gsap.getProperty(card, "scaleX"),
                          scaleY: 1 / gsap.getProperty(card, "scaleY") });
      },
    }, 0);
    // a short fade-through masks the single re-wrap at the start, where the
    // contents switch from the card's narrow layout to the opened one
    gsap.fromTo(content, { opacity: 0 }, { opacity: 1, duration: 0.32, delay: 0.14 });
  }

  function closeStory() {
    if (!wmaxCard || wmaxBusy) return;
    const card = wmaxCard;
    wmaxCard = null;
    const content = card.querySelector(".wexp-content");
    const finish = () => {
      // back into its own slot in the grid, then the placeholder goes away
      if (wmaxSlot && wmaxSlot.parentNode) wmaxSlot.parentNode.insertBefore(card, wmaxSlot);
      gsap.set(card, { clearProps: CARD_GEOM });
      card.classList.remove("is-expanded");
      gsap.set(card, { clearProps: "borderColor,boxShadow" });
      card.removeAttribute("data-lenis-prevent");
      card.scrollTop = 0;
      if (content) { content.hidden = true; gsap.set(content, { clearProps: "opacity" }); }
      if (wmaxSlot) { wmaxSlot.remove(); wmaxSlot = null; }
      wmaxPauseVideos(card);
      wmaxBackdrop.classList.remove("show", "is-blurred");
      // hide only AFTER the fade has run — setting hidden here is what made the
      // blur vanish in one frame on the way out while it ramped on the way in
      clearTimeout(wmaxHideTimer);
      wmaxHideTimer = setTimeout(() => { if (!wmaxCard) wmaxBackdrop.hidden = true; }, 560);
      document.documentElement.classList.remove("wmax-open");
      unlockScroll();
      history.replaceState(null, "", location.pathname + location.search);
      if (wmaxLastFocus && wmaxLastFocus.focus) wmaxLastFocus.focus();
    };
    if (wmaxInstant()) { finish(); return; }
    // the slot is exactly where the card belongs again — including any scrolling
    // the reader did while it was open
    const to = (wmaxSlot || card).getBoundingClientRect();
    const cur = card.getBoundingClientRect();
    const inner = card.querySelector(".wcard-inner");
    const sx = to.width / cur.width, sy = to.height / cur.height;
    wmaxBusy = true;
    // start the dim lifting NOW so the page comes back into focus as the card
    // travels home, rather than snapping clear once it has already landed
    wmaxBackdrop.classList.remove("is-blurred");   // off the critical path first
    wmaxBackdrop.classList.remove("show");
    wmaxPauseVideos(card);
    card.classList.add("is-flipping");
    // the themed border and glow ease back to the resting card as it shrinks,
    // instead of staying lit until the class comes off at the very end
    gsap.to(card, {
      borderColor: "rgba(120, 150, 220, 0.20)",
      boxShadow: "0 30px 70px rgba(0, 0, 0, 0.55), 0 0 0 1px rgba(0, 0, 0, 0.4)",
      duration: FLIP_D * 0.85, ease: "power2.out",
    });
    card.scrollTop = 0;
    if (content) gsap.to(content, { opacity: 0, duration: 0.22 });
    // the same transform-only morph, in reverse — one timeline so the card and
    // its contents move as a single object
    const tlc = gsap.timeline({
      onComplete: () => {
        gsap.set(card, { clearProps: "transform" });
        if (inner) gsap.set(inner, { clearProps: "transform" });
        card.classList.remove("is-flipping");
        finish(); wmaxBusy = false;
      },
    });
    if (inner) gsap.set(inner, { transformOrigin: "top left" });
    tlc.fromTo(card,
      { transformOrigin: "top left", x: 0, y: 0, scaleX: 1, scaleY: 1 },
      { x: to.left - cur.left, y: to.top - cur.top, scaleX: sx, scaleY: sy,
        duration: FLIP_D, ease: FLIP_E,
        onUpdate: () => {
          if (!inner) return;
          gsap.set(inner, { scaleX: 1 / gsap.getProperty(card, "scaleX"),
                            scaleY: 1 / gsap.getProperty(card, "scaleY") });
        } }, 0);
  }

  // showcase video lives inside the card itself (there is no separate story
  // container to gate it), so these are called with the card whose story is
  // opening/closing rather than delegated through a single shared element.
  function wmaxPlayVideos(card) {
    card.querySelectorAll("video.wx-showcase").forEach(v => {
      v.currentTime = 0;
      // Opening a story is a click gesture, so unmuted playback is allowed;
      // fall back to muted only if the browser still refuses.
      v.muted = false;
      v.play().catch(() => { v.muted = true; v.play().catch(() => {}); });
    });
  }

  function wmaxPauseVideos(card) {
    card.querySelectorAll("video.wx-showcase").forEach(v => v.pause());
  }

  function wmaxFocusIn(card) {
    const btn = card.querySelector(".w-close");
    if (btn) btn.focus();
  }

  document.querySelectorAll(".wcard-featured").forEach((card) => {
    card.querySelectorAll(".w-max").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        e.preventDefault(); e.stopPropagation();
        if (card.classList.contains("is-expanded")) closeStory(); else openStory(card);
      });
    });
    const closeBtn = card.querySelector(".w-close");
    if (closeBtn) closeBtn.addEventListener("click", (e) => {
      e.preventDefault(); e.stopPropagation(); closeStory();
    });
    // Clicking anywhere on a collapsed card opens its story — links and
    // buttons inside (the open_project anchor, the window buttons) keep
    // their own behaviour, and an expanded card is inert (you are reading
    // it). A card with no story (e.g. the process card, whose own page IS
    // the write-up) falls back to its original whole-card-opens-project.
    card.addEventListener("click", (e) => {
      if (e.target.closest("a, button")) return;
      if (card.classList.contains("is-expanded")) return;
      if (card.querySelector(".wexp-content")) { openStory(card); return; }
      const href = card.dataset.href;
      if (href) window.open(href, "_blank", "noopener");
    });
  });

  if (wmaxBackdrop) wmaxBackdrop.addEventListener("click", closeStory);
  // Clicking an open story's video toggles its sound. Delegated to document
  // (not a single "wmax" container — the card is portalled straight to
  // <body> while its story is open) since the video only ever exists inside
  // an unhidden .wexp-content, i.e. only while a story is actually open.
  document.addEventListener("click", (e) => {
    const v = e.target.closest("video.wx-showcase");
    if (v) v.muted = !v.muted;
  });
  document.addEventListener("keydown", (e) => {
    if (!wmaxCard) return;
    if (e.key === "Escape") { closeStory(); return; }
    if (e.key === "Tab") {
      const focusables = wmaxCard.querySelectorAll("button, a[href]");
      if (!focusables.length) return;
      const first = focusables[0], last = focusables[focusables.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    }
  });

  // an open card is sized in pixels, so a resize would leave it stale
  window.addEventListener("resize", () => {
    if (!wmaxCard || wmaxBusy) return;
    const to = expandedRect();
    gsap.set(wmaxCard, { left: to.left, top: to.top, width: to.width, height: to.height });
  });

  /* Re-measure once everything that changes page height has settled. The two
     pinned sections insert spacers (2000px for the laptop dive alone), and the
     hero video and web fonts land late — triggers created during parse measure
     a page that no longer exists, which put the cards' pin ~2600px above where
     it belongs. Nothing else in the file forces a refresh. */
  window.addEventListener("load", () => ScrollTrigger.refresh());

  /* ---------------- work panes: featured <-> other projects ---------------- */
  const paneFeat = document.getElementById("pane-featured");
  const paneOthers = document.getElementById("pane-others");
  const paneNext = document.getElementById("pane-next");
  const paneBack = document.getElementById("pane-back");
  if (paneFeat && paneOthers && paneNext && paneBack) {
    const featCards = Array.from(paneFeat.querySelectorAll(".wcard"));
    const otherCards = Array.from(paneOthers.querySelectorAll(".wcard"));
    const workGridEl = document.getElementById("work-grid");
    const workPanesEl = document.getElementById("work-panes");
    const navBarEl = document.querySelector(".bar");
    let paneBusy = false;
    let othersShown = false;

    // Everything that is not the movement itself: which arrow exists (a11y +
    // tab order via `hidden`), which pane is aria-hidden, which edge the
    // sunset band hangs off. All of it snaps — the visible fade is handled
    // separately by the opacity tweens flanking this call in showPane(). The
    // band itself stays invisible for the whole .band-dim window either way
    // (this call runs at OUT_FADE_D, band-dim doesn't lift until inEnd, well
    // after), so exactly when its edge flips inside that window is unobservable.
    function setPaneChrome(others) {
      workGridEl.classList.toggle("others-active", others);
      paneFeat.setAttribute("aria-hidden", others ? "true" : "false");
      paneOthers.setAttribute("aria-hidden", others ? "false" : "true");
      paneNext.hidden = others;
      paneBack.hidden = !others;
    }

    /* How far a card must travel to clear the SCREEN, not the grid. The old
       pane-wide translateX(106%) was 106% of the grid box, which is inset by
       ~5vw on each side, so the arriving cards started already inside the
       viewport and looked like they popped in and then slid. Measuring each
       card's own rect against innerWidth is the whole fix. */
    const PAD = 60;
    const offLeft = (el) => -(el.getBoundingClientRect().right + PAD);
    const offRight = (el) => window.innerWidth - el.getBoundingClientRect().left + PAD;

    // clearance below the fixed nav bar the incoming pane's first card lands at
    const LANDING_GAP = 20;

    function showPane(others) {
      if (paneBusy || others === othersShown) return;
      othersShown = others;
      const outPane = others ? paneFeat : paneOthers;
      const inPane = others ? paneOthers : paneFeat;
      const outCards = others ? featCards : otherCards;
      const inCards = others ? otherCards : featCards;
      const outArrow = others ? paneNext : paneBack;
      const inArrow = others ? paneBack : paneNext;

      // Land on the incoming pane's FIRST card, not wherever the scroll
      // happened to be — on phones that was the BOTTOM of the outgoing stack,
      // because that's where the arrow lives. Both panes share one grid cell
      // (.work-pane { grid-area: 1/1 }), and a visibility:hidden pane still
      // lays out real boxes (the same fact inFrom below relies on), so the
      // incoming pane's cards already have their real, final Y position we
      // can read right now — before is-active/is-leaving flip anything else,
      // and before either card set gets a transform, so this rect is the
      // untransformed layout position. Compute the target as an ABSOLUTE
      // document Y (current scrollY + delta), not a relative delta applied
      // later: that way it stays correct even if the page scrolls (or a
      // reflow moves things) during the slide, since it's resolved once, up
      // front. Only the SCROLL itself moves later — see landingY below.
      // Lenis owns scroll on this page — never window.scrollTo, see
      // lenis.scrollTo elsewhere in this file.
      //
      // #work-panes is ScrollTrigger-pinned above ~901px (position:fixed,
      // set by GSAP while the pin is engaged): every scroll position inside
      // that pin's held range paints identically, since nothing scrubs the
      // panes' own position off scroll progress there — only the pin start
      // itself does, once, before the cards even land. Scrolling further
      // would do nothing useful and risks pushing PAST the pin's own end
      // (it releases after a fixed +=900px of scroll), which would un-pin
      // the row out from under the swap. Skip it there; the row is already
      // fully on screen by construction (the entrance never plays until it
      // is). Below that width the section scrolls normally and this is the
      // only way to land the incoming card where Jordan wants it. `null`
      // means "nothing to scroll" and is checked below both on the instant
      // path and on the animated one.
      const firstIn = inCards[0];
      let landingY = null;
      if (firstIn && getComputedStyle(workPanesEl).position !== "fixed") {
        const navH = navBarEl ? navBarEl.getBoundingClientRect().height : 0;
        const dy = firstIn.getBoundingClientRect().top - (navH + LANDING_GAP);
        landingY = window.scrollY + dy;
      }

      // Instant path when reduced-motion, GSAP failed to load, or the tab is
      // backgrounded — same reasoning as wmaxInstant() above: a frozen rAF
      // loop must never strand an arrow mid-fade or leave both invisible.
      // These viewers never get the animated glide below either — an
      // animation nobody can see (or that keeps running in a backgrounded
      // tab) is just a stranded scroll waiting to happen, so this path lands
      // on landingY immediately, same as it always has.
      // Clear any inline opacity a previous, interrupted animated swap left
      // behind so CSS (.work-lit .pane-arrow) is back in sole control.
      if (reduced || !window.gsap || document.hidden) {
        if (window.gsap) gsap.set([paneNext, paneBack], { clearProps: "opacity" });
        if (landingY !== null) lenis.scrollTo(landingY, { immediate: true });
        setPaneChrome(others);
        outPane.classList.remove("is-active");
        inPane.classList.add("is-active");
        // preventScroll, or the browser's own default focus behaviour
        // scrolls the arrow into view and fights the landing scroll above —
        // same reason the animated path's own .focus() call (further down)
        // already carries it.
        (others ? paneBack : paneNext).focus({ preventScroll: true });
        return;
      }

      paneBusy = true;
      // takes the arrow and the band down first, so the click reads as the
      // light going out rather than the arrow being yanked away. Two classes,
      // not one: cards-moving is the structural guard (keeps CSS's own
      // .pane-arrow transition switched off for as long as GSAP is writing
      // its inline opacity — see the transition:none rule in the stylesheet)
      // and has to survive until the timeline truly ends. band-dim is purely
      // "should the band read as dark", and comes off the moment the arrow
      // starts brightening — see the inArrow tween below.
      workGridEl.classList.add("cards-moving", "band-dim");
      // .wcard carries `transition: transform 0.3s` for the hover lift, which
      // would fight every frame of this — same bug that made the entrance
      // refuse to follow its curve.
      outCards.concat(inCards).forEach((el) => el.classList.add("is-entering"));

      // Measure the arriving cards while they are still visibility:hidden —
      // hidden elements still have layout boxes, so the rects are real — and
      // park them off-screen BEFORE they are allowed to paint.
      const inFrom = inCards.map(others ? offRight : offLeft);
      gsap.set(inCards, { x: (i) => inFrom[i] });
      outPane.classList.add("is-leaving");
      outPane.classList.remove("is-active");
      inPane.classList.add("is-active");

      /* Both groups travel the same way: leftward on the way to the others,
         rightward on the way back. Whichever card is NEAREST the edge they are
         heading for moves first — otherwise a card has to cross a slot that is
         still occupied (or already refilled) and the two slide over each other.
         Going back that means Process Improvement, the right-hand card, leads. */
      const from = others ? "start" : "end";
      const OUT_D = 0.48, IN_D = 0.58, STEP = 0.085;
      const GAP = 0.12;                  // a beat of empty desk between the two
      // the last of the outgoing set finishes here; nothing arrives before it
      const outEnd = OUT_D + STEP * (outCards.length - 1);

      const tl = gsap.timeline({
        onComplete: () => {
          outPane.classList.remove("is-leaving");
          // hidden now, so reset without a flicker: a stale x would poison the
          // next measurement, since getBoundingClientRect includes transforms
          gsap.set(outCards, { x: 0 });
          outCards.concat(inCards).forEach((el) => el.classList.remove("is-entering"));
          // band-dim already came off when the arrow's in-fade started (below);
          // this is just the structural guard's own release, plus a harmless
          // no-op re-removal of band-dim in case anything upstream ever left it
          // stuck
          workGridEl.classList.remove("cards-moving", "band-dim");
          // both arrows are exactly where their own tweens left them (out: 0 +
          // hidden, in: 1 + visible) — hand opacity back to CSS now, or a
          // leftover inline value would outlive this swap and block the
          // unlit/hover rules on every swap after it
          gsap.set([paneNext, paneBack], { clearProps: "opacity" });
          // On the desktop pin (landingY === null) there is no landing glide
          // to wait for, so release the lock here, same as always. Off the
          // pin, the glide (added below) outlives this timeline — the lock
          // instead releases from ITS onComplete, once the page has actually
          // finished moving, not just the cards.
          if (landingY === null) paneBusy = false;
        },
      });
      tl.to(outCards, {
        x: (i) => (others ? offLeft(outCards[i]) : offRight(outCards[i])),
        duration: OUT_D, ease: "power2.in", stagger: { each: STEP, from },
      }, 0);
      // the desk is empty before anything arrives: the two sets never share the
      // screen, which is what made them look like they were sliding through
      // each other
      tl.to(inCards, {
        x: 0, duration: IN_D, ease: "power2.out", stagger: { each: STEP, from },
        clearProps: "transform",     // give the hover lift its transform back
      }, outEnd + GAP);

      /* The arrow you press fades OUT the instant you press it; the opposite
         arrow fades IN once its pane has actually settled — not a hard cut.
         fromTo (not `to`) pins an explicit from:1, so this doesn't matter what
         CSS's own opacity rules for .cards-moving currently compute — GSAP's
         inline style outranks the stylesheet for the whole tween regardless,
         which is what makes it a real fade instead of a 0→0 no-op.
         IN_FADE_D matches the sunset band's own CSS transition
         (#work-panes::before, opacity 0.6s ease) above 1100px, where the band
         is actually on screen and both start at `inEnd` (see below) and land
         in the same frame. Below 1100px the band is display:none (see the
         stylesheet's own ≤1100px block), so a 0.6s fade there has nothing to
         sync with and just reads slow — 0.3s instead. Read window.innerWidth
         here, at swap time, not once at load: the viewport can change (resize,
         rotation) between swaps. */
      const OUT_FADE_D = 0.28;
      const IN_FADE_D = window.innerWidth <= 1100 ? 0.3 : 0.6;
      tl.fromTo(outArrow, { opacity: 1 },
        { opacity: 0, duration: OUT_FADE_D, ease: "power1.out" }, 0);

      /* `hidden` still toggles here, for a11y/tab-order — but only once the
         outgoing arrow is fully invisible (display:none can't animate, so any
         earlier would cut its fade short) and no later (the incoming arrow
         must already be a11y-visible before ITS fade starts, or the fade would
         run on an element the accessibility tree doesn't know exists yet). The
         incoming arrow is forced to opacity 0 in the SAME tick it stops being
         `hidden`, so removing `hidden` can never flash it at full opacity for
         a frame before its own fade-in takes over. Focus moves with it, same
         as before: focusing a still-hidden element does nothing. */
      tl.add(() => {
        gsap.set(inArrow, { opacity: 0 });
        setPaneChrome(others);
        (others ? paneBack : paneNext).focus({ preventScroll: true });
      }, OUT_FADE_D);

      // mirrors inCards' own finish time (its stagger's last start + IN_D), so
      // the arrow only brightens once the last card has actually arrived
      const inEnd = outEnd + GAP + IN_D + STEP * (inCards.length - 1);
      // band-dim comes off in the SAME tick the arrow's own fade-in begins —
      // that's the one moment both are gated on, so dropping it here (instead
      // of waiting for cards-moving at onComplete) is what puts the band's
      // 0.6s CSS transition and the arrow's 0.6s GSAP tween on the same clock.
      tl.to(inArrow, {
        opacity: 1, duration: IN_FADE_D, ease: "power1.out",
        onStart: () => workGridEl.classList.remove("band-dim"),
      }, inEnd);

      /* The second beat Jordan asked for: once the incoming cards have
         actually landed, glide the page up to rest on the first one, instead
         of teleporting there before anyone could see it move. Starts at
         `inEnd` — the same moment the cards finish and the arrow starts
         brightening — so it reads as "slide, then glide" rather than
         happening mid-slide or waiting on the arrow's own fade too. Lenis
         owns this, not window.scrollTo (see the comment on landingY above).
         The easing is the quadratic in/out curve GSAP's power2.inOut also
         draws from, kept as a plain function since Lenis takes its own
         easing callback, not a GSAP ease string. landingY is null on the
         desktop pin, where this whole beat is skipped (see above) — the
         lock there is released from the timeline's own onComplete instead. */
      const LANDING_SCROLL_D = 0.8;
      if (landingY !== null) {
        tl.add(() => {
          // onComplete can go unfired if something else calls lenis.stop()
          // mid-glide (e.g. tapping a just-landed card opens its story,
          // which locks scroll the same way) — Lenis's own Animate.stop()
          // halts silently with no callback in that case. A `released` guard
          // plus a timeout backstop just past the glide's own duration means
          // the lock always clears one way or the other, never stranded.
          let released = false;
          const release = () => { if (!released) { released = true; paneBusy = false; } };
          lenis.scrollTo(landingY, {
            duration: LANDING_SCROLL_D,
            easing: (t) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2),
            onComplete: release,
          });
          setTimeout(release, LANDING_SCROLL_D * 1000 + 100);
        }, inEnd);
      }
    }
    paneNext.addEventListener("click", () => showPane(true));
    paneBack.addEventListener("click", () => showPane(false));
  }

  // Deep links: #myplan / #universe open the story directly.
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
