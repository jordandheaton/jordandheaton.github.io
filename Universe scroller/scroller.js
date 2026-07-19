(() => {
  'use strict';

  const PX_PER_FRAME = 18;   // scroll distance mapped to one frame
  const AHEAD  = 220;        // frames decoded ahead of the playhead
  const BEHIND = 120;        // frames decoded behind the playhead
  const BOOT_FRAMES = 60;    // frames to load before dismissing the loader

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
    return '10' + toSup(logMeters.toFixed(1)) + ' m';
  }
  function fmtAltitude(logMeters) {
    const m = Math.pow(10, logMeters);
    if (m < 1)    return Math.round(m * 100) + ' cm';
    if (m < 1e3)  return (m < 10 ? m.toFixed(1) : Math.round(m)) + ' m';
    if (m < 1e6)  return (m / 1e3).toFixed(m < 1e4 ? 1 : 0) + ' km';
    return Math.round(m / 1e3).toLocaleString() + ' km';
  }

  function boot(manifest) {
    const FRAME_COUNT = manifest.frameCount;
    const PAD = manifest.pad || 4;
    const src = i => manifest.pattern.replace('{i}', String(i + 1).padStart(PAD, '0'));
    const CH = manifest.chapters;

    if (reduced) return renderStatic(FRAME_COUNT, src, CH);

    const spacer = document.getElementById('spacer');
    // total travel = one full frame span past the last frame, plus a viewport
    // so the final frame is fully reachable at max scroll (recomputed on resize).
    function sizeSpacer() {
      spacer.style.height = ((FRAME_COUNT - 1) * PX_PER_FRAME + innerHeight) + 'px';
    }
    sizeSpacer();

    // ---- canvas sizing ---------------------------------------------------
    function sizeCanvas() {
      const dpr = Math.min(devicePixelRatio || 1, 2);
      canvas.width  = Math.round(canvas.clientWidth  * dpr);
      canvas.height = Math.round(canvas.clientHeight * dpr);
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

    addEventListener('scroll', () => {
      target = Math.max(0, Math.min(FRAME_COUNT - 1, scrollY / PX_PER_FRAME));
      if (scrollY > 40) hintEl.classList.add('gone');
    }, { passive: true });

    function updateHud(playhead, idx) {
      const c = CH.find(c => idx >= c.start && idx <= c.end) || CH[CH.length - 1];
      const t = Math.max(0, Math.min(1, (playhead - c.start) / (c.end - c.start)));
      const logM = c.a0 + (c.a1 - c.a0) * t;
      altEl.textContent = fmtAltitude(logM);
      expEl.innerHTML = fmtExp(logM);
      labelEl.textContent = c.label;
      fillEl.style.width = (playhead / (FRAME_COUNT - 1) * 100) + '%';
    }

    function tick() {
      requestAnimationFrame(tick);
      playhead += (target - playhead) * 0.22;
      if (Math.abs(target - playhead) < 0.01) playhead = target;
      const idx = Math.round(playhead);

      if (idx - lastWin > 24 || lastWin - idx > 24) { ensureWindow(idx); lastWin = idx; }

      if (idx !== shownIdx || dirty) {
        const im = nearest(idx);
        if (im) { coverDraw(im); shownIdx = idx; dirty = false; }
        updateHud(playhead, idx);
      }
      // expose debug hook
      window.__uni = { idx, target: +target.toFixed(2), playhead: +playhead.toFixed(2),
                       loadedCount: decodedCount(), storeSize: store.size,
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
