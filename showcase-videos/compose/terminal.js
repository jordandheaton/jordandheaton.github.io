(function () {
  function mount(container, {title}) {
    const el = document.createElement('div');
    el.className = 'term';
    el.innerHTML = `<div class="tbar"><span class="dot"></span><span class="dot"></span>` +
      `<span class="dot"></span><span style="margin-left:10px">${title}</span></div>` +
      `<div class="tbody"></div>`;
    container.appendChild(el);
    function update(lines, p) {
      const q = Math.max(0, Math.min(1, p)) * lines.length;
      const full = Math.floor(q);
      const body = el.querySelector('.tbody');
      body.innerHTML = lines.slice(0, Math.min(lines.length, full + 1)).map((l, i) => {
        const s = (i === full) ? l.s.slice(0, Math.ceil(l.s.length * (q - full))) : l.s;
        return `<div class="tl-line ${l.t}">${s}</div>`;
      }).join('');
    }
    return { el, update };
  }
  window.Terminal = { mount };
})();
