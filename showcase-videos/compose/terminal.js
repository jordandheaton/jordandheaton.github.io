(function () {
  function mount(container, {title}) {
    const el = document.createElement('div');
    el.className = 'term';
    el.innerHTML = `<div class="tbar"><span class="dot"></span><span class="dot"></span>` +
      `<span class="dot"></span><span style="margin-left:10px">${title}</span></div>` +
      `<div class="tbody"></div>`;
    container.appendChild(el);
    function update(lines, p) {
      const shown = Math.floor(Math.max(0, Math.min(1, p)) * lines.length);
      const body = el.querySelector('.tbody');
      const frac = p * lines.length - shown;      // type-on for the newest line
      body.innerHTML = lines.slice(0, shown).map((l, i) => {
        const s = (i === shown - 1 && frac < 0.5)
          ? l.s.slice(0, Math.ceil(l.s.length * frac * 2)) : l.s;
        return `<div class="tl-line ${l.t}">${s}</div>`;
      }).join('');
    }
    return { el, update };
  }
  window.Terminal = { mount };
})();
