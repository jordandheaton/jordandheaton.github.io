(function () {
  function title(container, {lines}) {
    const el = document.createElement('div');
    el.className = 'fx-title';
    el.innerHTML = lines.map(l =>
      l.split(' ').map(w => `<span class="w">${w}</span>`).join(' ')).join('<br>');
    container.appendChild(el);
    const words = [...el.querySelectorAll('.w')];
    el._fx = p => words.forEach((w, i) => {
      const q = TL.eases.outCubic(Math.max(0, Math.min(1, p * words.length * 0.55 - i * 0.35)));
      w.style.opacity = q;
      w.style.transform = `translateY(${(1 - q) * 46}px)`;
      w.style.filter = `blur(${(1 - q) * 8}px)`;
    });
    el._fx(0);
    return el;
  }
  function caption(container, text) {
    const el = document.createElement('div');
    el.className = 'fx-caption';
    el.textContent = text;
    container.appendChild(el);
    el._fx = p => {
      el.style.opacity = Math.min(1, p * 3) * (p > 0.9 ? (1 - p) * 10 : 1);
      el.style.transform = `translateY(${(1 - Math.min(1, p * 3)) * 30}px)`;
    };
    el._fx(0);
    return el;
  }
  function pill(container, text) {
    const el = document.createElement('div');
    el.className = 'fx-pill';
    el.textContent = text;
    container.appendChild(el);
    el._fx = p => {
      const q = TL.eases.outBack(Math.min(1, p * 2));
      el.style.opacity = p === 0 ? 0 : Math.min(1, p * 4);
      el.style.transform = `translate(-50%,-50%) scale(${0.6 + q * 0.4})`;
    };
    el._fx(0);
    return el;
  }
  function typewriter(el, text, p) {
    el.textContent = text.slice(0, Math.round(text.length * Math.min(1, p)));
  }

  // ---- Revision-1: callout / credits-roll / circle-wipe (Task R3) ----

  // A pointer line (SVG, draws in via stroke-dasharray/dashoffset — avoids CSS
  // transform-rotation ordering pitfalls) from (x,y) to a label chip offset to
  // one side. Pop-in: line draws p 0->0.4, chip pops (outBack) p 0.3->0.7,
  // holds from p>=0.7. _fx(0) is fully hidden. No built-in fade-out.
  function callout(container, {x, y, text, side}) {
    const DIST = 230;
    side = (side === 'left' || side === 'above') ? side : 'right';
    let dx = 0, dy = 0;
    if (side === 'right') dx = DIST;
    else if (side === 'left') dx = -DIST;
    else dy = -DIST;
    const cx = x + dx, cy = y + dy;
    const len = Math.max(1, Math.hypot(cx - x, cy - y));

    const el = document.createElement('div');
    el.className = 'fx-callout';
    el.innerHTML =
      `<svg class="fx-callout-svg" viewBox="0 0 1920 1080">` +
        `<circle class="fx-callout-dot" cx="${x}" cy="${y}" r="7"></circle>` +
        `<line class="fx-callout-line" x1="${x}" y1="${y}" x2="${cx}" y2="${cy}"></line>` +
      `</svg><div class="fx-callout-chip"></div>`;
    container.appendChild(el);
    const dot = el.querySelector('.fx-callout-dot');
    const line = el.querySelector('.fx-callout-line');
    const chip = el.querySelector('.fx-callout-chip');
    chip.textContent = text;
    chip.style.left = cx + 'px';
    chip.style.top = cy + 'px';
    line.style.strokeDasharray = String(len);

    el._fx = p => {
      p = Math.max(0, Math.min(1, p));
      const lineOn = p > 0;
      const lineQ = TL.eases.outCubic(Math.max(0, Math.min(1, p / 0.4)));
      line.style.opacity = lineOn ? '1' : '0';
      line.style.strokeDashoffset = String(len * (1 - lineQ));
      dot.style.opacity = lineOn ? '1' : '0';

      const chipOn = p >= 0.3;
      const chipRaw = Math.max(0, Math.min(1, (p - 0.3) / 0.4));
      const q = TL.eases.outBack(chipRaw);
      chip.style.opacity = chipOn ? '1' : '0';
      chip.style.transform = `translate(-50%,-50%) scale(${chipOn ? q : 0})`;
    };
    el._fx(0);
    return el;
  }

  // Centered column of lines. Line i starts popping (outBack scale 0.7->1 +
  // rise) at p_i = i/(n+1) over a window of 1.6/(n+1); once the NEXT line
  // finishes landing, earlier lines ease to 55% opacity and drift up slightly
  // (stack breathing). Pure function of p — no timers, no hidden state.
  function credits(container, {lines}) {
    const el = document.createElement('div');
    el.className = 'fx-credits';
    el.innerHTML = lines.map(() => `<div class="fx-credits-line"></div>`).join('');
    container.appendChild(el);
    const rows = [...el.querySelectorAll('.fx-credits-line')];
    rows.forEach((r, i) => { r.textContent = lines[i]; });
    const n = rows.length;
    const win = 1.6 / (n + 1);
    const start = i => i / (n + 1);

    el._fx = p => {
      p = Math.max(0, Math.min(1, p));
      rows.forEach((row, i) => {
        const local = Math.max(0, Math.min(1, (p - start(i)) / win));
        const q = TL.eases.outBack(local);
        const pop = local;
        let opacity = pop, shift = 0;
        if (i < n - 1) {
          const landedNext = start(i + 1) + win;
          const dimT = Math.max(0, Math.min(1, (p - landedNext) / win));
          const dim = TL.eases.outCubic(dimT);
          opacity = pop - dim * (pop - 0.55);
          shift = dim * 14;
        }
        row.style.opacity = opacity;
        row.style.transform = `translateY(${(1 - q) * 30 - shift}px) scale(${0.7 + q * 0.3})`;
      });
    };
    el._fx(0);
    return el;
  }

  // Full-stage circle-wipe overlay. r grows linearly (260% * p) so the circle
  // covers the 1920x1080 stage at exactly p=0.5 (r=130%) and keeps growing
  // afterward; the layer itself fades out over p 0.75->1 (reveal-through).
  // Callers place the visual CUT at the frame where p=0.5.
  function wipe(container, {color} = {}) {
    const el = document.createElement('div');
    el.className = 'fx-wipe';
    if (color) el.style.background = color;
    container.appendChild(el);

    el._fx = p => {
      p = Math.max(0, Math.min(1, p));
      const r = 260 * p;
      el.style.clipPath = `circle(${r}% at 62% 50%)`;
      let opacity;
      if (p <= 0) opacity = 0;
      else if (p < 0.75) opacity = 1;
      else opacity = Math.max(0, 1 - (p - 0.75) / 0.25);
      el.style.opacity = opacity;
    };
    el._fx(0);
    return el;
  }

  window.FX = { title, caption, pill, typewriter, callout, credits, wipe };
})();
