/* Frame-addressed timeline. Everything is a pure function of frame index so a
   headless harness can render any frame in any order deterministically. */
(function () {
  const eases = {
    linear: p => p,
    inQuad: p => p * p,
    outQuad: p => p * (2 - p),
    inOutQuad: p => p < .5 ? 2*p*p : -1 + (4 - 2*p) * p,
    outCubic: p => 1 + (--p) * p * p,
    inOutCubic: p => p < .5 ? 4*p*p*p : (p-1) * (2*p-2) * (2*p-2) + 1,
    outExpo: p => p === 1 ? 1 : 1 - Math.pow(2, -10 * p),
    outBack: p => { const s = 1.70158; return --p * p * ((s+1)*p + s) + 1; },
  };
  function pad(n, w) { return String(n).padStart(w, '0'); }

  function build(cfg) {
    const fps = cfg.fps || 60;
    window.__fps = fps;
    window.__frames = cfg.frames;
    window.__seek = async function (f) {
      f = Math.max(0, Math.min(cfg.frames - 1, f));
      const pending = [];
      for (const t of cfg.tracks) {
        if (t.run) { if (f >= (t.f0 || 0)) t.run(f); continue; }
        if (t.seq) {
          const s = t.seq, ratio = fps / s.srcFps;
          const raw = Math.floor((f - t.f0) / ratio) + (s.start || 0);
          const idx = Math.max(s.start || 0, Math.min((s.start || 0) + s.count - 1, raw));
          const src = s.root + '/' + (s.prefix ?? 'f') + pad(idx, s.pad ?? 5) + (s.ext ?? '.jpg');
          t.el.style.visibility = (f >= t.f0 && f <= t.f1) ? 'visible' : 'hidden';
          if (t.el.getAttribute('src') !== src) {
            t.el.setAttribute('src', src);
            pending.push(t.el.decode ? t.el.decode().catch(() => {}) : Promise.resolve());
          }
          continue;
        }
        const p0 = (f - t.f0) / Math.max(1, (t.f1 - t.f0));
        const p = eases[t.ease || 'linear'](Math.max(0, Math.min(1, p0)));
        t.apply(t.el, p, f);
      }
      if (document.fonts && document.fonts.status !== 'loaded') pending.push(document.fonts.ready);
      await Promise.all(pending);
      return f;
    };
  }
  window.TL = { build, eases };
})();
