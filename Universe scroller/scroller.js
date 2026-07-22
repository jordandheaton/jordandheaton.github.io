(() => {
  'use strict';

  const PX_PER_DECADE = 1500; // scroll distance per order of magnitude of scale
  const AHEAD  = 220;         // frames decoded ahead of the playhead
  const BEHIND = 120;         // frames decoded behind the playhead
  const BOOT_FRAMES = 60;     // frames to load before dismissing the loader

  const $ = id => document.getElementById(id);
  const canvas = $('view'), ctx = canvas.getContext('2d');
  const altEl = $('alt'), expEl = $('exp'), labelEl = $('label'), fillEl = $('fill');
  const hintEl = $('hint'), loaderEl = $('loader'), lfillEl = $('lfill');

  // ---- reduced motion: static stepper, no scrub engine -------------------
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;

  // ---- helpers -----------------------------------------------------------
  const SUP = { '-': '⁻', '0':'⁰','1':'¹','2':'²','3':'³',
                '4':'⁴','5':'⁵','6':'⁶','7':'⁷','8':'⁸','9':'⁹','.':'˙' };
  const toSup = s => String(s).split('').map(c => SUP[c] || c).join('');

  function fmtExp(logMeters) {
    const r = Math.round(logMeters * 10) / 10;
    let s = (Math.abs(r % 1) < 0.05) ? String(Math.round(r)) : r.toFixed(1);
    s = s.replace('-', '−'); // typographic minus
    return '10<sup>' + s + '</sup> m';
  }
  const AU = 1.496e11, LY = 9.461e15;
  function fmtAltitude(logMeters) {
    const m = Math.pow(10, logMeters);
    if (m < 1e-6)    return (m * 1e9).toFixed(0) + ' nm';
    if (m < 1e-3)    return (m * 1e6 < 10 ? (m * 1e6).toFixed(1) : Math.round(m * 1e6)) + ' µm';
    if (m < 1e-2)    return (m * 1e3 < 10 ? (m * 1e3).toFixed(1) : Math.round(m * 1e3)) + ' mm';
    if (m < 1)       return Math.round(m * 100) + ' cm';
    if (m < 1e3)     return (m < 10 ? m.toFixed(1) : Math.round(m)) + ' m';
    if (m < 1e6)     return (m / 1e3).toFixed(m < 1e4 ? 1 : 0) + ' km';
    if (m < 1e10)    return Math.round(m / 1e3).toLocaleString() + ' km';
    if (m < 0.1 * LY) { const au = m / AU; return (au < 10 ? au.toFixed(1) : Math.round(au)) + ' au'; }
    const ly = m / LY; return (ly < 10 ? ly.toFixed(1) : Math.round(ly).toLocaleString()) + ' ly';
  }

  function boot(manifest) {
    const FRAME_COUNT = manifest.frameCount;
    const PAD = manifest.pad || 4;
    const src = i => manifest.pattern.replace('{i}', String(i + 1).padStart(PAD, '0'));
    const CH = manifest.chapters;

    if (reduced) return renderStatic(FRAME_COUNT, src, CH);

    // ---- log-scale scroll mapping ---------------------------------------
    // Scroll distance is proportional to orders of magnitude traveled, NOT
    // frame count — so the on-screen zoom pace stays even no matter how the
    // source clips vary their zoom speed internally.
    const LOG_MIN = CH[0].a0;
    const TOTAL_DECADES = CH.reduce((s, c) => s + (c.a1 - c.a0), 0);
    const SCROLL_LEN = TOTAL_DECADES * PX_PER_DECADE;

    function frameFromScroll(y) {
      const logPos = LOG_MIN + Math.max(0, Math.min(1, y / SCROLL_LEN)) * TOTAL_DECADES;
      const c = CH.find(c => logPos >= c.a0 && logPos <= c.a1) || CH[CH.length - 1];
      const t = (logPos - c.a0) / (c.a1 - c.a0);
      return c.start + t * (c.end - c.start);
    }

    const spacer = document.getElementById('spacer');
    // total travel = SCROLL_LEN plus a viewport so the last frame is fully
    // reachable at max scroll (recomputed on resize).
    function sizeSpacer() {
      spacer.style.height = (SCROLL_LEN + innerHeight) + 'px';
    }
    sizeSpacer();

    // ---- ambience FX layers ---------------------------------------------
    const fxStars = document.getElementById('fx-stars');
    const fxMicro = document.getElementById('fx-micro');
    const sctx = fxStars.getContext('2d');
    const mctx = fxMicro.getContext('2d');
    let DPR = 1, stars = [], motes = [];

    // Precomputed per-frame mask of bright bodies (Earth, Moon, Sun, planets), so
    // stars never render on top of a lit object. Baked offline into starmask.js
    // (32x18 luma threshold + 1-cell dilation, bit-packed). We DELIBERATELY do not
    // sample the #view canvas at runtime: reading canvas pixels taints the canvas
    // under file:// (double-clicked page) and silently disables all masking, which
    // is exactly why stars were bleeding over Earth. The precomputed table needs no
    // pixel read, so it works identically from file:// and from a web server.
    const SMASK = window.__STAR_MASK || null;
    let SMbytes = null;
    if (SMASK && SMASK.b64) {
      try {
        const bin = atob(SMASK.b64);
        SMbytes = new Uint8Array(bin.length);
        for (let i = 0; i < bin.length; i++) SMbytes[i] = bin.charCodeAt(i);
      } catch (e) { SMbytes = null; }
    }
    // Returns 0 if a star at low-res cell (gx,gy) sits on a lit body this frame
    // (star hidden), else 1. Frames outside the baked range have no bodies to dodge.
    function bodyMask(frameIdx, gx, gy) {
      if (!SMbytes || frameIdx < SMASK.f0 || frameIdx > SMASK.f1) return 1;
      const cell = gy * SMASK.w + gx;
      const byte = SMbytes[(frameIdx - SMASK.f0) * SMASK.bpf + (cell >> 3)];
      return ((byte >> (cell & 7)) & 1) ? 0 : 1;
    }

    const smooth = (a, b, x) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

    // Cumulative "visual travel" from measured per-frame motion (frame-diff), so
    // the starfield advances in proportion to how much the footage actually moves
    // — a nearly-still frame barely nudges the stars, a fast zoom streaks them.
    const RAWM = window.__FRAME_MOTION || [];
    const MO_CAP = 9;                  // clamp scene-cut spikes so stars don't leap at cuts
    // Stars are STAGNANT (static field) through the near/mid space chapters and
    // only start streaming once past the Oort cloud (Nearest-stars onward), so
    // motion only accumulates from that frame on.
    const FRAME_MOVE_START = 1155;     // Oort cloud -> Nearest stars (logM 16.6)
    const travelLUT = new Float32Array(FRAME_COUNT);
    for (let i = 0, acc = 0; i < FRAME_COUNT; i++) {
      if (i >= FRAME_MOVE_START) acc += Math.min(MO_CAP, RAWM[i] || 0);
      travelLUT[i] = acc;
    }
    function travelAt(ph) {
      const i = Math.max(0, Math.min(FRAME_COUNT - 1, Math.floor(ph)));
      const j = Math.min(FRAME_COUNT - 1, i + 1);
      return travelLUT[i] + (travelLUT[j] - travelLUT[i]) * (ph - i);
    }

    function seedFx() {
      const w = fxStars.width, h = fxStars.height;
      // deterministic PRNG so the field is stable across resizes
      let s = 2468013579;
      const rnd = () => (s = (s * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff;
      const N = Math.max(120, Math.round((w * h) / 9000));
      stars = [];
      for (let i = 0; i < N; i++) stars.push({
        a: rnd() * 6.283, p0: rnd(), d: 0.35 + rnd() * 0.9, r: 0.5 + rnd() * 1.9,
        tw: rnd() * 6.283, tws: 0.5 + rnd() * 1.9,
        col: rnd() < 0.16 ? '#bcd4ff' : (rnd() < 0.5 ? '#fff1d4' : '#ffffff')
      });
      const M = Math.max(24, Math.round((w * h) / 26000));
      motes = [];
      for (let i = 0; i < M; i++) motes.push({
        x: rnd(), y: rnd(), r: 7 + rnd() * 30, vx: (rnd() - 0.5) * 0.010, vy: (rnd() - 0.5) * 0.010,
        ph: rnd() * 6.283, col: rnd() < 0.5 ? '120,224,168' : '150,208,232'
      });
    }

    // Stars stream radially, driven by the PLAYHEAD (the frame actually on
    // screen) — so they speed up and slow down exactly with the footage's zoom
    // rather than at an even log-rate that drifts out of sync with the video.
    // Scroll down (zoom out) pulls them toward the vanishing point and shrinks
    // them; scroll up sends them flying outward past the camera. Stars are also
    // masked out wherever the underlying frame is bright, so they never sit on
    // top of a planet or the Sun.
    function drawStars(playhead, t, op) {
      fxStars.style.opacity = op.toFixed(3);
      const w = fxStars.width, h = fxStars.height;
      sctx.clearRect(0, 0, w, h);
      if (op <= 0.01) return;
      const cx = w / 2, cy = h / 2, maxR = Math.hypot(w, h) * 0.62;
      const MW = SMASK ? SMASK.w : 32, MH = SMASK ? SMASK.h : 18;
      const fidx = Math.round(playhead);             // frame whose baked body-mask to use
      const STATIC_BASE = 5.0;                                 // fixes the static field's positions
      // static field drifts a *very little* with scroll, then streams past the Oort cloud
      const travel = STATIC_BASE + playhead * 0.0006 + travelAt(playhead) * 0.011;
      for (const st of stars) {
        let ph = (st.p0 + travel * st.d) % 1; if (ph < 0) ph += 1;
        const rad = (1 - ph) * maxR;                 // edge (ph→0) inward to center (ph→1)
        const x = cx + Math.cos(st.a) * rad, y = cy + Math.sin(st.a) * rad;
        const size = st.r * DPR * (0.35 + (1 - ph) * 1.05);
        const twk = 0.5 + 0.5 * Math.sin(t * st.tws + st.tw);
        const fade = Math.min(1, (1 - ph) * 5) * Math.min(1, ph * 8); // fade in at edge, out at core
        const gx = Math.min(MW - 1, Math.max(0, (x / w * MW) | 0));
        const gy = Math.min(MH - 1, Math.max(0, (y / h * MH) | 0));
        const mask = bodyMask(fidx, gx, gy);         // 0 over a lit body, 1 in open space
        sctx.globalAlpha = twk * op * fade * mask;
        sctx.fillStyle = st.col;
        sctx.beginPath(); sctx.arc(x, y, size, 0, 6.2832); sctx.fill();
      }
      sctx.globalAlpha = 1;
    }

    function drawMotes(t, op) {
      fxMicro.style.opacity = op.toFixed(3);
      const w = fxMicro.width, h = fxMicro.height;
      mctx.clearRect(0, 0, w, h);
      if (op <= 0.01) return;
      for (const m of motes) {
        const x = ((((m.x + m.vx * t) % 1) + 1) % 1) * w;
        const y = ((((m.y + m.vy * t) % 1) + 1) % 1) * h;
        const puls = 0.6 + 0.4 * Math.sin(t * 0.8 + m.ph);
        const r = m.r * DPR * (0.8 + 0.4 * puls);
        const g = mctx.createRadialGradient(x, y, 0, x, y, r);
        g.addColorStop(0, 'rgba(' + m.col + ',' + (0.17 * puls * op).toFixed(3) + ')');
        g.addColorStop(1, 'rgba(' + m.col + ',0)');
        mctx.fillStyle = g;
        mctx.beginPath(); mctx.arc(x, y, r, 0, 6.2832); mctx.fill();
      }
    }

    // ---- canvas sizing ---------------------------------------------------
    function sizeCanvas() {
      DPR = Math.min(devicePixelRatio || 1, 2);
      for (const c of [canvas, fxStars, fxMicro]) {
        c.width  = Math.round(c.clientWidth  * DPR);
        c.height = Math.round(c.clientHeight * DPR);
      }
      seedFx();
    }
    sizeCanvas();
    addEventListener('resize', () => { sizeCanvas(); sizeSpacer(); dirty = true; });

    // ---- windowed image store -------------------------------------------
    const store = new Map();   // idx -> Image
    let loadedCount = 0;

    function req(i) {
      if (i < 0 || i >= FRAME_COUNT || store.has(i)) return;
      const im = new Image();
      im.decoding = 'async';
      im.src = src(i);
      store.set(i, im);
    }
    function ensureWindow(center) {
      const lo = Math.max(0, center - BEHIND);
      const hi = Math.min(FRAME_COUNT - 1, center + AHEAD);
      for (let i = lo; i <= hi; i++) req(i);
      // evict beyond a 2x margin so re-scrolls stay cheap but memory is bounded
      const elo = center - 2 * BEHIND, ehi = center + 2 * AHEAD;
      for (const i of store.keys()) {
        if (i < elo || i > ehi) { const im = store.get(i); if (im) im.src = ''; store.delete(i); }
      }
    }
    function nearest(idx) {
      // find best already-decoded frame at or near idx (hold last-good, never blank)
      const im = store.get(idx);
      if (im && im.complete && im.naturalWidth) return im;
      for (let d = 1; d <= 12; d++) {
        const a = store.get(idx - d), b = store.get(idx + d);
        if (a && a.complete && a.naturalWidth) return a;
        if (b && b.complete && b.naturalWidth) return b;
      }
      return null;
    }

    function coverDraw(im) {
      const cw = canvas.width, ch = canvas.height;
      const iw = im.naturalWidth, ih = im.naturalHeight;
      if (!iw) return;
      const s = Math.max(cw / iw, ch / ih);
      const w = iw * s, h = ih * s;
      ctx.drawImage(im, (cw - w) / 2, (ch - h) / 2, w, h);
    }

    // ---- boot preload ----------------------------------------------------
    let booted = 0;
    for (let i = 0; i < Math.min(BOOT_FRAMES, FRAME_COUNT); i++) {
      req(i);
      const im = store.get(i);
      im.addEventListener('load',  onBoot);
      im.addEventListener('error', onBoot);
    }
    function onBoot() {
      booted++;
      lfillEl.style.width = (booted / Math.min(BOOT_FRAMES, FRAME_COUNT) * 100) + '%';
      if (booted >= Math.min(BOOT_FRAMES, FRAME_COUNT)) {
        loaderEl.classList.add('gone');
        ensureWindow(0);
      }
    }
    // count total decoded frames for the debug hook (cheap, approximate)
    function decodedCount() {
      let n = 0; for (const im of store.values()) if (im.complete && im.naturalWidth) n++;
      return n;
    }

    // ---- scroll → target -------------------------------------------------
    let playhead = 0, target = 0, shownIdx = -1, dirty = true, lastWin = -999;

    // scroll position is polled in the rAF tick (more robust than scroll
    // events, which some browsers throttle or suspend); the listener only
    // handles the one-shot hint dismissal.
    addEventListener('scroll', () => {
      if (scrollY > 40) hintEl.classList.add('gone');
    }, { passive: true });
    let lastScrollY = -1;

    const chapterAt = idx => CH.find(c => idx >= c.start && idx <= c.end) || CH[CH.length - 1];
    function logMAt(ph) {
      const c = chapterAt(Math.round(ph));
      const t = Math.max(0, Math.min(1, (ph - c.start) / (c.end - c.start)));
      return c.a0 + (c.a1 - c.a0) * t;
    }

    let lastLabel = CH[0].label, seamPulse = 0;
    function updateHud(playhead, idx, logM) {
      const c = chapterAt(idx);
      altEl.textContent = fmtAltitude(logM);
      expEl.innerHTML = fmtExp(logM);
      if (c.label !== lastLabel) {                 // chapter cut: swap label + soft blur pulse
        lastLabel = c.label;
        labelEl.textContent = c.label;             // immediate — never shows a stale label
        if (labelEl.animate) labelEl.animate([{ opacity: 0 }, { opacity: .85 }], { duration: 320, easing: 'ease-out' });
        seamPulse = 1;
      }
      fillEl.style.width = ((logM - LOG_MIN) / TOTAL_DECADES * 100) + '%';
    }

    let lastFilter = '';
    function tick() {
      requestAnimationFrame(tick);
      const now = performance.now() / 1000;
      if (scrollY !== lastScrollY) {
        lastScrollY = scrollY;
        target = Math.max(0, Math.min(FRAME_COUNT - 1, frameFromScroll(scrollY)));
        if (scrollY > 40) hintEl.classList.add('gone');
      }
      playhead += (target - playhead) * 0.22;
      if (Math.abs(target - playhead) < 0.01) playhead = target;
      const idx = Math.round(playhead);
      const logM = logMAt(playhead);

      if (idx - lastWin > 24 || lastWin - idx > 24) { ensureWindow(idx); lastWin = idx; }

      if (idx !== shownIdx || dirty) {
        const im = nearest(idx);
        if (im) { coverDraw(im); shownIdx = idx; dirty = false; }
        updateHud(playhead, idx, logM);
      }

      // ---- motion blur: scrub speed + a soft blur at each hard cut ---------
      seamPulse *= 0.88;
      const velo = Math.abs(target - playhead);
      const velBlur = Math.min(2.4, Math.max(0, (velo - 0.8) * 0.40));
      const blur = Math.max(velBlur, seamPulse * 3.0);
      const bstr = blur < 0.05 ? 'none' : 'blur(' + blur.toFixed(2) + 'px)';
      if (bstr !== lastFilter) { canvas.style.filter = bstr; lastFilter = bstr; }

      // ---- ambience keyed to scale ----------------------------------------
      const microOp = 1 - smooth(-1.6, -0.4, logM);   // cellular motes, gone by the leaf
      // stars appear the moment we leave the ground into space (Earth as a globe),
      // static out through the Oort cloud, then streaming through the stellar
      // neighborhood, and gone by the galaxy.
      const starOp  = smooth(7.0, 7.8, logM) * (1 - smooth(18.8, 19.5, logM));
      drawStars(playhead, now, starOp);
      drawMotes(now, microOp);

      // expose debug hook
      window.__uni = { idx, target: +target.toFixed(2), playhead: +playhead.toFixed(2),
                       logM: +logM.toFixed(2), loadedCount: decodedCount(), storeSize: store.size,
                       windowRange: [Math.max(0, idx - BEHIND), Math.min(FRAME_COUNT - 1, idx + AHEAD)] };
    }
    tick();
  }

  // ---- reduced-motion static stepper ------------------------------------
  function renderStatic(FRAME_COUNT, src, CH) {
    loaderEl.classList.add('gone');
    document.querySelector('.hint').style.display = 'none';
    document.getElementById('spacer').style.display = 'none';
    canvas.style.display = 'none';
    document.querySelector('.hud').style.display = 'none';

    const wrap = document.createElement('div');
    wrap.className = 'rm-wrap';
    wrap.innerHTML = '<h1>Universe Scroller</h1><p class="sub">Leaf to Earth &middot; static view (reduced motion)</p>';
    CH.forEach((c, k) => {
      const step = document.createElement('div');
      step.className = 'rm-step';
      const logM = c.a0;
      const m = Math.pow(10, logM);
      const alt = m < 1 ? Math.round(m * 100) + ' cm' : m < 1e3 ? Math.round(m) + ' m'
                : m < 1e6 ? (m / 1e3).toFixed(1) + ' km' : Math.round(m / 1e3).toLocaleString() + ' km';
      step.innerHTML =
        '<img loading="lazy" src="' + src(c.start) + '" alt="' + c.label + '">' +
        '<div class="cap"><span class="l">' + (k + 1) + ' &middot; ' + c.label + '</span><span class="a">' + alt + '</span></div>';
      wrap.appendChild(step);
    });
    document.body.appendChild(wrap);
    document.body.style.overflowY = 'auto';
  }

  // ---- load manifest, then boot -----------------------------------------
  // Prefer the inline <script id="manifest-data"> so the page works from
  // file:// (where fetch is blocked). Fall back to the JSON file if absent.
  function fail(err) {
    loaderEl.innerHTML = '<div>Failed to load journey</div>';
    console.error('[universe-scroller] could not load manifest:', err);
  }

  const inline = document.getElementById('manifest-data');
  if (inline && inline.textContent.trim()) {
    try { boot(JSON.parse(inline.textContent)); }
    catch (err) { fail(err); }
  } else {
    fetch('frames/manifest.json?v=1')
      .then(r => { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); })
      .then(boot)
      .catch(fail);
  }
})();
