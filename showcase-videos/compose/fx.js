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
  window.FX = { title, caption, pill, typewriter };
})();
