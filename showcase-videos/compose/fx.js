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

  // ---- Revision-2: browserbar / ring FX (Task R7) ----

  // Minimal dark browser-chrome strip, ~1100px wide, centered on stage
  // (DM Sans scheme label + monospace typed URL). Pop-in (outBack) over
  // p 0->0.12. The url text types on LINEARLY over p in [0.12, 0.85]:
  //   charCount(p) = round(url.length * clamp((p-0.12)/(0.85-0.12), 0, 1))
  // render/build_myplan_audio.py derives per-keystroke frame timestamps from
  // this exact mapping given a beat's [f0,f1] range -- do not change the
  // (0.12, 0.85) window without updating the audio builder to match.
  // p 0.85->1 holds the completed url. Caret is a steady block (deterministic
  // -- no wall-clock blink), visible whenever p<1, hidden once typing "ends".
  // _fx(0) is fully hidden (opacity 0, slight scale-down).
  function browserbar(container, {url}) {
    const TYPE_P0 = 0.12, TYPE_P1 = 0.85, POP_P1 = 0.12;
    const el = document.createElement('div');
    el.className = 'fx-browserbar';
    el.innerHTML =
      `<span class="fx-browserbar-dot r"></span><span class="fx-browserbar-dot y"></span>` +
      `<span class="fx-browserbar-dot g"></span>` +
      `<div class="fx-browserbar-url"><span class="fx-browserbar-scheme">https://</span>` +
      `<span class="fx-browserbar-text"></span><span class="fx-browserbar-caret"></span></div>`;
    container.appendChild(el);
    const text = el.querySelector('.fx-browserbar-text');
    const caret = el.querySelector('.fx-browserbar-caret');

    el._fx = p => {
      p = Math.max(0, Math.min(1, p));
      const popQ = TL.eases.outBack(Math.max(0, Math.min(1, p / POP_P1)));
      el.style.opacity = p === 0 ? '0' : '1';
      el.style.transform = `translate(-50%,-50%) scale(${p === 0 ? 0.94 : 0.94 + popQ * 0.06})`;

      const typeQ = Math.max(0, Math.min(1, (p - TYPE_P0) / (TYPE_P1 - TYPE_P0)));
      const n = Math.round(url.length * typeQ);
      text.textContent = url.slice(0, n);
      caret.style.opacity = p < 1 ? '1' : '0';
    };
    el._fx(0);
    return el;
  }

  // Hand-drawn-feel SVG ellipse stroke (accent color, ~4px) centered at stage
  // coords (x,y) with radii (rx,ry); a small fixed rotation offset gives it a
  // slightly imperfect, sketched look. The stroke DRAWS ON around the ellipse
  // over p 0->0.6 (dasharray = circumference via Ramanujan's approximation,
  // dashoffset counts down from full to 0), holds fully drawn for p>=0.6.
  // _fx(0) is hidden. No built-in fade-out -- caller fades.
  function ring(container, {x, y, rx, ry}) {
    const DRAW_P1 = 0.6, TILT_DEG = -2.5;
    const el = document.createElement('div');
    el.className = 'fx-ring';
    el.innerHTML =
      `<svg class="fx-ring-svg" viewBox="0 0 1920 1080">` +
        `<ellipse class="fx-ring-ellipse" cx="${x}" cy="${y}" rx="${rx}" ry="${ry}" ` +
        `transform="rotate(${TILT_DEG} ${x} ${y})"></ellipse>` +
      `</svg>`;
    container.appendChild(el);
    const ellipse = el.querySelector('.fx-ring-ellipse');
    // Ramanujan's second approximation for ellipse circumference.
    const h = Math.pow((rx - ry) / (rx + ry), 2);
    const circumference = Math.PI * (rx + ry) * (1 + (3 * h) / (10 + Math.sqrt(4 - 3 * h)));
    ellipse.setAttribute('stroke-dasharray', String(circumference));

    el._fx = p => {
      p = Math.max(0, Math.min(1, p));
      el.style.opacity = p === 0 ? '0' : '1';
      const drawQ = TL.eases.outCubic(Math.max(0, Math.min(1, p / DRAW_P1)));
      ellipse.style.strokeDashoffset = String(circumference * (1 - drawQ));
    };
    el._fx(0);
    return el;
  }

  // ---- Revision-4: corner-arc highlight FX (Task R14) ----

  // Two short curved corner-arc marks (opposite corners of an ellipse region
  // centered at (x,y) with radii (rx,ry)), accent color, drawing on like a
  // quick hand annotation. Replaces box/ring highlights in the myplanBYU
  // composition (ring() itself is untouched -- other cuts may still use it).
  //
  // Each arc is the boundary of that SAME ellipse, but only a 90-degree
  // quadrant of it: top-left corner = the quadrant between the ellipse's
  // left point (x-rx,y) and top point (x,y-ry); bottom-right corner = the
  // quadrant between its right point (x+rx,y) and bottom point (x,y+ry).
  // Expressed as a single SVG elliptical-arc command per path. Endpoint-to-
  // center algebra (SVG arc spec, unrotated case) confirms large-arc-flag=0
  // (the minor/90-degree arc, not the 270-degree one) + sweep-flag=1
  // resolves to a center of EXACTLY (x,y) for both quadrants -- so these two
  // one-command paths are provably the ellipse's own boundary, not an
  // approximation.
  //
  // DRAW_P1 -- both arcs draw on (stroke-dashoffset counting down from each
  // path's own true length, read via getTotalLength()) over p 0->0.5, hold
  // fully drawn for p>=0.5 ("hold >=0.5" per spec). _fx(0) is fully hidden.
  // No built-in fade-out -- caller fades, same contract as ring().
  function arcs(container, {x, y, rx, ry}) {
    const DRAW_P1 = 0.5;
    const el = document.createElement('div');
    el.className = 'fx-arcs';
    el.innerHTML =
      `<svg class="fx-arcs-svg" viewBox="0 0 1920 1080">` +
        `<path class="fx-arcs-path" d="M ${x - rx} ${y} A ${rx} ${ry} 0 0 1 ${x} ${y - ry}"></path>` +
        `<path class="fx-arcs-path" d="M ${x + rx} ${y} A ${rx} ${ry} 0 0 1 ${x} ${y + ry}"></path>` +
      `</svg>`;
    container.appendChild(el);
    const paths = [...el.querySelectorAll('.fx-arcs-path')];
    const lens = paths.map(p => p.getTotalLength());
    paths.forEach((p, i) => { p.style.strokeDasharray = String(lens[i]); });

    el._fx = p => {
      p = Math.max(0, Math.min(1, p));
      el.style.opacity = p === 0 ? '0' : '1';
      const drawQ = TL.eases.outCubic(Math.max(0, Math.min(1, p / DRAW_P1)));
      paths.forEach((path, i) => { path.style.strokeDashoffset = String(lens[i] * (1 - drawQ)); });
    };
    el._fx(0);
    return el;
  }

  window.FX = { title, caption, pill, typewriter, callout, credits, wipe, browserbar, ring, arcs };
})();
