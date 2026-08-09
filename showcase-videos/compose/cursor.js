(function () {
  const E = TL.eases;
  function positioned(events) { return events.filter(e => e.x !== undefined); }
  function stateAt(log, f) {
    const evs = positioned(log.events);
    let a = evs[0], b = evs[evs.length - 1];
    for (let i = 0; i < evs.length - 1; i++)
      if (f >= evs[i].f && f <= evs[i + 1].f) { a = evs[i]; b = evs[i + 1]; break; }
    let x, y;
    if (f <= a.f) { x = a.x; y = a.y; }
    else if (f >= b.f) { x = b.x; y = b.y; }
    else {
      const span = Math.max(1, b.f - a.f);
      const dist = Math.hypot(b.x - a.x, b.y - a.y);
      const p = (f - a.f) / span;
      const ease = dist > 300 ? E.outBack : E.inOutCubic;   // long hops overshoot
      const q = ease(p);
      x = a.x + (b.x - a.x) * q; y = a.y + (b.y - a.y) * q;
    }
    let pressed = false, ripple = 0;
    for (const e of log.events) if (e.kind === 'click') {
      if (f >= e.f && f < e.f + 6) pressed = true;
      if (f >= e.f && f < e.f + 24) ripple = Math.max(ripple, 1 - (f - e.f) / 24);
    }
    return { x, y, pressed, ripple, over: b.kind === 'click' };
  }
  function mount(container) {
    const layer = document.createElement('div');
    layer.className = 'cursor-layer';
    layer.innerHTML =
      '<div class="cur-ripple"></div>' +
      '<svg width="17" height="24" viewBox="0 0 17 24"><path d="M1 1 L1 19 L5.5 15.2 ' +
      'L8.6 22.4 L11.7 21.1 L8.6 14 L14.6 13.6 Z" fill="#05070f" stroke="#eaf2ff" ' +
      'stroke-width="1.4" stroke-linejoin="round"/></svg>';
    container.appendChild(layer);
    function update(s) {
      layer.style.transform = `translate(${s.x}px, ${s.y}px) scale(${s.pressed ? 1.7 : 2})`;
      const r = layer.querySelector('.cur-ripple');
      r.style.opacity = s.ripple * 0.6;
      r.style.transform = `translate(-14px,-14px) scale(${1 + (1 - s.ripple) * 1.6})`;
    }
    return { layer, update };
  }
  window.Cursor = { stateAt, mount };
})();
