(() => {
  'use strict';

  const $ = id => document.getElementById(id);
  const canvas = $('view'), ctx = canvas.getContext('2d');
  const altEl = $('alt'), expEl = $('exp'), labelEl = $('label'), fillEl = $('fill');
  const hintEl = $('hint'), loaderEl = $('loader'), lfillEl = $('lfill');
  const railEl = $('rail');

  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const isTouch = matchMedia('(pointer: coarse)').matches;
  const isSmall = () => innerWidth < 760;

  // start every visit at the leaf, never at a restored scroll offset
  if ('scrollRestoration' in history) history.scrollRestoration = 'manual';

  // ---- helpers -----------------------------------------------------------
  const SUP = { '-': '⁻', '0':'⁰','1':'¹','2':'²','3':'³',
                '4':'⁴','5':'⁵','6':'⁶','7':'⁷','8':'⁸','9':'⁹','.':'˙' };

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
    // past a million km the plain km figure turns into a seven-digit number that
    // both overflows a phone's HUD and churns every digit while scrolling
    if (m < 1e9)     return Math.round(m / 1e3).toLocaleString() + ' km';
    if (m < 0.1 * AU) return (m / 1e9).toFixed(2) + 'M km';
    if (m < 0.1 * LY) { const au = m / AU; return (au < 10 ? au.toFixed(1) : Math.round(au).toLocaleString()) + ' au'; }
    const ly = m / LY; return (ly < 10 ? ly.toFixed(1) : Math.round(ly).toLocaleString()) + ' ly';
  }

  function boot(manifest) {
    const FRAME_COUNT = manifest.frameCount;
    const PAD = manifest.pad || 4;
    const src = i => manifest.pattern.replace('{i}', String(i + 1).padStart(PAD, '0'));
    const CH = manifest.chapters;
    const FIRST = CH[0].start;          // smallest scale in the journey (chromosome)
    const LAST  = CH[CH.length - 1].end;

    // The journey OPENS in the middle, not at either end: you land at human scale
    // on the leaf and travel out to the galaxy or down into the cell. FIRST is the
    // floor, OPEN_* is only where the page starts -- everything below the leaf
    // stays reachable by scrolling up.
    const OPEN_CH    = Math.max(0, CH.findIndex(c => c.label === manifest.openAt));
    const OPEN_FRAME = CH[OPEN_CH].start;
    const OPEN_LOG   = CH[OPEN_CH].a0;

    if (reduced) return renderStatic(src, CH);

    // Fewer frames held in flight on a phone: each decoded 1280x720 frame is
    // several MB of bitmap, and mobile Safari will evict the whole page if the
    // window gets greedy.
    const AHEAD  = isSmall() ? 90 : 220;
    const BEHIND = isSmall() ? 45 : 120;
    const BOOT_FRAMES = isSmall() ? 36 : 60;

    // ---- log-scale scroll mapping ---------------------------------------
    // Scroll distance is proportional to orders of magnitude traveled, NOT
    // frame count — so the on-screen zoom pace stays even no matter how the
    // source clips vary their zoom speed internally.
    const LOG_MIN = CH[0].a0;
    const TOTAL_DECADES = CH.reduce((s, c) => s + (c.a1 - c.a0), 0);
    let PX_PER_DECADE = 1500, SCROLL_LEN = TOTAL_DECADES * PX_PER_DECADE;

    const spacer = $('spacer');
    function sizeSpacer() {
      // a phone flick covers far less distance than a mouse wheel spin, so the
      // journey is shortened on small screens to stay a scroll, not a chore
      PX_PER_DECADE = isSmall() ? 1040 : 1500;
      SCROLL_LEN = TOTAL_DECADES * PX_PER_DECADE;
      spacer.style.height = (SCROLL_LEN + innerHeight) + 'px';
    }
    sizeSpacer();

    const scrollForLog = l => (l - LOG_MIN) / TOTAL_DECADES * SCROLL_LEN;

    function frameFromScroll(y) {
      const logPos = LOG_MIN + Math.max(0, Math.min(1, y / SCROLL_LEN)) * TOTAL_DECADES;
      const c = CH.find(c => logPos >= c.a0 && logPos <= c.a1) || CH[CH.length - 1];
      const t = (logPos - c.a0) / (c.a1 - c.a0);
      return c.start + t * (c.end - c.start);
    }

    // ---- ambience FX layers ---------------------------------------------
    const fxStars = $('fx-stars'), fxMicro = $('fx-micro');
    const sctx = fxStars.getContext('2d'), mctx = fxMicro.getContext('2d');
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
    // (star hidden), else 1. A soft one-cell ring around the body returns a partial
    // value so stars ease out near a body's edge instead of popping on/off as the
    // body drifts across cell boundaries frame-to-frame.
    function bodyMask(frameIdx, gx, gy) {
      if (!SMbytes || frameIdx < SMASK.f0 || frameIdx > SMASK.f1) return 1;
      const W = SMASK.w, H = SMASK.h, base = (frameIdx - SMASK.f0) * SMASK.bpf;
      const bit = (cx, cy) => {
        if (cx < 0 || cy < 0 || cx >= W || cy >= H) return 0;
        const c = cy * W + cx;
        return (SMbytes[base + (c >> 3)] >> (c & 7)) & 1;
      };
      if (bit(gx, gy)) return 0;                                    // on the body → hidden
      if (bit(gx - 1, gy) || bit(gx + 1, gy) || bit(gx, gy - 1) || bit(gx, gy + 1)) return 0.3;
      return 1;                                                     // open space → full star
    }

    const smooth = (a, b, x) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

    // Cumulative "visual travel" from measured per-frame motion (frame-diff), so
    // the starfield advances in proportion to how much the footage actually moves.
    const RAWM = window.__FRAME_MOTION || [];
    const MO_CAP = 9;                  // clamp scene-cut spikes so stars don't leap at cuts
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
      let s = 2468013579;                       // deterministic: field is stable across resizes
      const rnd = () => (s = (s * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff;
      const N = Math.max(120, Math.round((w * h) / (isSmall() ? 12000 : 9000)));
      stars = [];
      for (let i = 0; i < N; i++) stars.push({
        a: rnd() * 6.283, p0: rnd(), d: 0.35 + rnd() * 0.9, r: 0.5 + rnd() * 1.9,
        tw: rnd() * 6.283, tws: 0.5 + rnd() * 1.9,
        col: rnd() < 0.16 ? '#bcd4ff' : (rnd() < 0.5 ? '#fff1d4' : '#ffffff')
      });
      const M = Math.max(20, Math.round((w * h) / 26000));
      motes = [];
      for (let i = 0; i < M; i++) motes.push({
        x: rnd(), y: rnd(), r: 7 + rnd() * 30, vx: (rnd() - 0.5) * 0.010, vy: (rnd() - 0.5) * 0.010,
        ph: rnd() * 6.283, col: rnd() < 0.5 ? '120,224,168' : '150,208,232'
      });
    }

    // Stars stream radially, driven by the PLAYHEAD (the frame actually on
    // screen). Star positions are masked against the DRAWN FRAME RECT, not the
    // whole canvas: once the frame is letterboxed on a portrait phone the bars
    // are open space, so stars are free to fill them — which is what makes the
    // letterbox read as sky rather than as a black bar.
    function drawStars(playhead, t, op, rect) {
      const on = op > 0.01;
      fxStars.classList.toggle('off', !on);
      fxStars.style.opacity = op.toFixed(3);
      if (!on) return;
      const w = fxStars.width, h = fxStars.height;
      sctx.clearRect(0, 0, w, h);
      const cx = w / 2, cy = h / 2, maxR = Math.hypot(w, h) * 0.62;
      const MW = SMASK ? SMASK.w : 32, MH = SMASK ? SMASK.h : 18;
      const fidx = Math.round(playhead);
      const STATIC_BASE = 5.0;
      const travel = STATIC_BASE + playhead * 0.0006 + travelAt(playhead) * 0.011;
      for (const st of stars) {
        let ph = (st.p0 + travel * st.d) % 1; if (ph < 0) ph += 1;
        const rad = (1 - ph) * maxR;
        const x = cx + Math.cos(st.a) * rad, y = cy + Math.sin(st.a) * rad;
        const size = st.r * DPR * (0.35 + (1 - ph) * 1.05);
        const twk = 0.5 + 0.5 * Math.sin(t * st.tws + st.tw);
        const fade = Math.min(1, (1 - ph) * 5) * Math.min(1, ph * 8);
        let mask = 1;
        if (rect.w > 0) {
          const gx = Math.floor((x - rect.x) / rect.w * MW);
          const gy = Math.floor((y - rect.y) / rect.h * MH);
          mask = (gx < 0 || gy < 0 || gx >= MW || gy >= MH) ? 1 : bodyMask(fidx, gx, gy);
        }
        sctx.globalAlpha = twk * op * fade * mask;
        sctx.fillStyle = st.col;
        sctx.beginPath(); sctx.arc(x, y, size, 0, 6.2832); sctx.fill();
      }
      sctx.globalAlpha = 1;
    }

    function drawMotes(t, op) {
      const on = op > 0.01;
      fxMicro.classList.toggle('off', !on);
      fxMicro.style.opacity = op.toFixed(3);
      if (!on) return;
      const w = fxMicro.width, h = fxMicro.height;
      mctx.clearRect(0, 0, w, h);
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

    // Mobile browsers fire resize every time the URL bar collapses or expands.
    // Re-seeding the starfield on those made the sky visibly reshuffle mid-scroll,
    // so only a real layout change (rotation, window resize) counts.
    let lastW = innerWidth, lastH = innerHeight, rTimer = 0;
    addEventListener('resize', () => {
      if (innerWidth === lastW && Math.abs(innerHeight - lastH) < 140) return;
      clearTimeout(rTimer);
      rTimer = setTimeout(() => {
        lastW = innerWidth; lastH = innerHeight;
        // Crossing the 760px breakpoint rewrites PX_PER_DECADE, so the same
        // scrollY means a different scale afterwards. Re-anchor on the scale
        // actually on screen, or a rotation would fling you across the journey.
        const heldLog = logMAt(playhead);
        sizeCanvas(); sizeSpacer();
        scrollTo(0, Math.round(scrollForLog(heldLog)));
        restY = openY();
        dirty = true;
      }, 140);
    });

    // ---- windowed image store -------------------------------------------
    const store = new Map();   // idx -> Image
    function req(i) {
      if (i < FIRST || i > LAST || store.has(i)) return;
      const im = new Image();
      im.decoding = 'async';
      im.src = src(i);
      store.set(i, im);
    }
    function ensureWindow(center) {
      const lo = Math.max(FIRST, center - BEHIND);
      const hi = Math.min(LAST, center + AHEAD);
      for (let i = lo; i <= hi; i++) req(i);
      const elo = center - 2 * BEHIND, ehi = center + 2 * AHEAD;
      for (const i of store.keys()) {
        if (i < elo || i > ehi) { const im = store.get(i); if (im) im.src = ''; store.delete(i); }
      }
    }
    const ready = im => !!(im && im.complete && im.naturalWidth);
    function exact(i) { const im = store.get(i); return ready(im) ? im : null; }
    function nearest(idx) {
      // best already-decoded frame at or near idx (hold last-good, never blank)
      const im = store.get(idx);
      if (ready(im)) return im;
      for (let d = 1; d <= 12; d++) {
        const a = store.get(idx - d), b = store.get(idx + d);
        if (ready(a)) return a;
        if (ready(b)) return b;
      }
      return null;
    }

    // ---- framing ---------------------------------------------------------
    // fit 0 = cover (frame fills the screen, periphery cropped)
    // fit 1 = contain (whole 16:9 composition visible)
    //
    // The ground footage is texture — cropping its edges on a portrait phone
    // costs nothing and full-bleed is far more immersive. The space footage is
    // the opposite: the Sun sits left of centre with the planets strung out
    // across the full width, so a centre-crop would throw Jupiter and Neptune
    // clean off the screen. Once Earth is a globe on black we ease to contain.
    // The bars this opens up are invisible — space is already black, the blurred
    // backdrop fills them, and the starfield draws straight through them.
    const FIT_A = 6.6, FIT_B = 8.0;   // logM: Earth's limb → Earth as a full sphere

    // cheap blur: downsample to a thumbnail, then upscale it smoothed
    const bcan = document.createElement('canvas');
    bcan.width = 48; bcan.height = 27;
    const bctx = bcan.getContext('2d');
    const rect = { x: 0, y: 0, w: 0, h: 0 };

    function drawFrame(imA, imB, blend, fit) {
      const cw = canvas.width, ch = canvas.height;
      const iw = imA.naturalWidth, ih = imA.naturalHeight;
      if (!iw) return;
      const sCover = Math.max(cw / iw, ch / ih);
      const sFit   = Math.min(cw / iw, ch / ih);
      const s = sCover + (sFit - sCover) * fit;
      const w = iw * s, h = ih * s, x = (cw - w) / 2, y = (ch - h) / 2;

      const barsY = h < ch - 1, barsX = w < cw - 1;

      if (barsX || barsY) {
        // ambient backdrop so the frame edge melts into the page instead of
        // reading as a hard letterbox line
        bctx.drawImage(imA, 0, 0, bcan.width, bcan.height);
        const bs = Math.max(cw / bcan.width, ch / bcan.height);
        const bw = bcan.width * bs, bh = bcan.height * bs;
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        ctx.drawImage(bcan, (cw - bw) / 2, (ch - bh) / 2, bw, bh);
        ctx.fillStyle = 'rgba(4,6,12,.78)';
        ctx.fillRect(0, 0, cw, ch);
      }

      ctx.drawImage(imA, x, y, w, h);
      // Cross-dissolve into the next frame. Some chapters cover two orders of
      // magnitude in only ~24 frames, so without this the image visibly steps
      // rather than glides through them.
      if (imB && imB !== imA && blend > 0.02) {
        ctx.globalAlpha = Math.min(1, blend);
        ctx.drawImage(imB, x, y, w, h);
        ctx.globalAlpha = 1;
      }

      // Feather the band edges into the backdrop. Without this the frame reads
      // as a rectangle pasted on the page — the giveaway that would make the
      // letterbox look like a bug rather than like sky.
      if (barsY) {
        const F = Math.min(h * 0.10, 44 * DPR);
        let g = ctx.createLinearGradient(0, y, 0, y + F);
        g.addColorStop(0, 'rgba(4,6,12,1)'); g.addColorStop(1, 'rgba(4,6,12,0)');
        ctx.fillStyle = g; ctx.fillRect(x, y, w, F);
        g = ctx.createLinearGradient(0, y + h, 0, y + h - F);
        g.addColorStop(0, 'rgba(4,6,12,1)'); g.addColorStop(1, 'rgba(4,6,12,0)');
        ctx.fillStyle = g; ctx.fillRect(x, y + h - F, w, F);
      }
      if (barsX) {
        const F = Math.min(w * 0.10, 44 * DPR);
        let g = ctx.createLinearGradient(x, 0, x + F, 0);
        g.addColorStop(0, 'rgba(4,6,12,1)'); g.addColorStop(1, 'rgba(4,6,12,0)');
        ctx.fillStyle = g; ctx.fillRect(x, y, F, h);
        g = ctx.createLinearGradient(x + w, 0, x + w - F, 0);
        g.addColorStop(0, 'rgba(4,6,12,1)'); g.addColorStop(1, 'rgba(4,6,12,0)');
        ctx.fillStyle = g; ctx.fillRect(x + w - F, y, F, h);
      }
      rect.x = x; rect.y = y; rect.w = w; rect.h = h;
    }

    // ---- chapter rail ----------------------------------------------------
    railEl.style.setProperty('--ticks', CH.length);   // rail sizes itself to fit
    const ticks = CH.map((c, i) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'tick';
      b.setAttribute('aria-label', c.label);
      b.title = c.label;
      b.innerHTML = '<i></i>';
      b.addEventListener('click', () => {
        // jump straight there rather than animating across tens of thousands of
        // pixels through frames that aren't loaded yet
        scrollTo({ top: Math.round(scrollForLog(c.a0)) + 1, behavior: 'auto' });
        target = playhead = c.start;
        ensureWindow(c.start); lastWin = c.start; dirty = true;
        hintEl.classList.add('gone');
      });
      railEl.appendChild(b);
      return b;
    });
    let activeCh = -1;

    // ---- boot preload ----------------------------------------------------
    // Straddles the opening frame rather than starting at it: the leaf is a fork,
    // and a visitor who scrolls up into the cell on arrival should not hit a wall
    // of undecoded frames. Weighted outward, since most people travel out first.
    let booted = 0;
    const bootTotal = Math.min(BOOT_FRAMES, LAST - FIRST + 1);
    const bootLo = Math.max(FIRST, Math.min(LAST - bootTotal + 1,
                                            OPEN_FRAME - Math.round(bootTotal * 0.35)));
    for (let i = bootLo; i < bootLo + bootTotal; i++) {
      req(i);
      const im = store.get(i);
      im.addEventListener('load',  onBoot);
      im.addEventListener('error', onBoot);
    }
    function onBoot() {
      booted++;
      lfillEl.style.width = (booted / bootTotal * 100) + '%';
      if (booted >= bootTotal) {
        loaderEl.classList.add('gone');
        ensureWindow(OPEN_FRAME);
      }
    }
    function decodedCount() {
      let n = 0; for (const im of store.values()) if (ready(im)) n++;
      return n;
    }

    // ---- scroll → target -------------------------------------------------
    let playhead = OPEN_FRAME, target = OPEN_FRAME, dirty = true, lastWin = -999, lastDrawn = -999;

    // Land on the leaf. scrollRestoration is already 'manual', so this is the
    // position on every visit, including a reload part-way through the journey.
    const openY = () => Math.round(scrollForLog(OPEN_LOG));
    let restY = openY();
    scrollTo(0, restY);

    // The hint hides once you have MOVED, in either direction -- measured against
    // the opening offset, not against zero, which is now half a journey away.
    $('hint-text').textContent = isTouch ? 'Swipe to travel' : 'Scroll either way to travel';
    const moved = () => Math.abs(scrollY - restY) > 40;
    addEventListener('scroll', () => { if (moved()) hintEl.classList.add('gone'); }, { passive: true });
    let lastScrollY = -1;

    // Chapters share their boundary frame (Leaf surface ends on 507, Leaf starts
    // on it), so a frame on a seam belongs to the chapter it OPENS -- half-open
    // [start, end). Without this the journey opens on frame 507 labelled "Leaf
    // surface", one chapter behind where it actually is. The final frame has no
    // chapter after it to fall into, hence the trailing clamp.
    const chapterIdxAt = idx => {
      for (let i = 0; i < CH.length; i++) if (idx >= CH[i].start && idx < CH[i].end) return i;
      return CH.length - 1;
    };
    function logMAt(ph) {
      const c = CH[chapterIdxAt(Math.round(ph))];
      const t = Math.max(0, Math.min(1, (ph - c.start) / (c.end - c.start)));
      return c.a0 + (c.a1 - c.a0) * t;
    }

    let seamPulse = 0;
    function updateHud(idx, logM) {
      const ci = chapterIdxAt(idx);
      altEl.textContent = fmtAltitude(logM);
      expEl.innerHTML = fmtExp(logM);
      if (ci !== activeCh) {                       // chapter cut: swap label + soft blur pulse
        if (activeCh >= 0) seamPulse = 1;
        activeCh = ci;
        labelEl.textContent = CH[ci].label;
        if (labelEl.animate) labelEl.animate([{ opacity: 0 }, { opacity: .8 }], { duration: 320, easing: 'ease-out' });
        ticks.forEach((t, i) => {
          t.classList.toggle('on', i === ci);
          t.classList.toggle('done', i < ci);
        });
      }
      fillEl.style.width = ((logM - LOG_MIN) / TOTAL_DECADES * 100) + '%';
    }

    let lastFilter = '';
    function tick() {
      requestAnimationFrame(tick);
      const now = performance.now() / 1000;
      if (scrollY !== lastScrollY) {
        lastScrollY = scrollY;
        target = Math.max(FIRST, Math.min(LAST, frameFromScroll(scrollY)));
        if (moved()) hintEl.classList.add('gone');
      }
      playhead += (target - playhead) * 0.22;
      if (Math.abs(target - playhead) < 0.005) playhead = target;
      const idx = Math.round(playhead);
      const logM = logMAt(playhead);

      if (Math.abs(idx - lastWin) > 24) { ensureWindow(idx); lastWin = idx; }

      if (Math.abs(playhead - lastDrawn) > 0.008 || dirty) {
        const i0 = Math.floor(playhead);
        const a = nearest(i0);
        if (a) {
          const b = exact(i0 + 1);
          drawFrame(a, b, playhead - i0, smooth(FIT_A, FIT_B, logM));
          lastDrawn = playhead; dirty = false;
        }
        updateHud(idx, logM);
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
      // Stars appear as we leave the ground, hold as a static field out through
      // the Oort cloud, then fade before the nearest-stars footage — which is
      // itself a dense star field, so an overlaid one just reads as glitch.
      const starOp  = smooth(7.0, 7.8, logM) * (1 - smooth(15.9, 16.6, logM));
      drawStars(playhead, now, starOp, rect);
      drawMotes(now, microOp);

      window.__uni = { idx, target: +target.toFixed(2), playhead: +playhead.toFixed(2),
                       logM: +logM.toFixed(2), fit: +smooth(FIT_A, FIT_B, logM).toFixed(2),
                       chapter: CH[chapterIdxAt(idx)].label,
                       rect: { w: Math.round(rect.w), h: Math.round(rect.h) },
                       loadedCount: decodedCount(), storeSize: store.size, pxPerDecade: PX_PER_DECADE,
                       scrollLen: SCROLL_LEN };
    }
    tick();
  }

  // ---- reduced-motion static stepper ------------------------------------
  function renderStatic(src, CH) {
    loaderEl.classList.add('gone');
    hintEl.style.display = 'none';
    $('spacer').style.display = 'none';
    canvas.style.display = 'none';
    document.querySelector('.hud').style.display = 'none';
    railEl.style.display = 'none';
    document.querySelector('.progress').style.display = 'none';

    const wrap = document.createElement('div');
    wrap.className = 'rm-wrap';
    wrap.innerHTML = '<h1>Universe Scroller</h1><p class="sub">Chromosome to the Milky Way &middot; static view (reduced motion)</p>';
    CH.forEach((c, k) => {
      const step = document.createElement('div');
      step.className = 'rm-step';
      step.innerHTML =
        '<img loading="lazy" src="' + src(c.start) + '" alt="' + c.label + '">' +
        '<div class="cap"><span class="l">' + (k + 1) + ' &middot; ' + c.label + '</span>' +
        '<span class="a">' + fmtAltitude(c.a0) + '</span></div>';
      wrap.appendChild(step);
    });
    document.body.appendChild(wrap);
    document.body.style.overflowY = 'auto';
  }

  // ---- load manifest, then boot -----------------------------------------
  // Prefer the inline <script id="manifest-data"> so the page works from
  // file:// (where fetch is blocked). Fall back to the JSON file if absent.
  function fail(err) {
    loaderEl.innerHTML = '<div class="lmark">Failed to load journey</div>';
    console.error('[universe-scroller] could not load manifest:', err);
  }

  const inline = $('manifest-data');
  if (inline && inline.textContent.trim()) {
    try { boot(JSON.parse(inline.textContent)); }
    catch (err) { fail(err); }
  } else {
    fetch('frames/manifest.json?v=2')
      .then(r => { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); })
      .then(boot)
      .catch(fail);
  }
})();
