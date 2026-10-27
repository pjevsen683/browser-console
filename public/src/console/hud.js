// Fjernsynets overlag under et spil: pointrække, stor tekst i midten, banner og en nyhedsstrimmel. Fælles for spillene.
export const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

export function createHud(root) {
  // layer: et tomt lag under overlaget til spil, der tegner med DOM i stedet for 3D (Color Rush).
  root.innerHTML = '<div class="layer"></div><div class="chips"></div><div class="center"></div><div class="banner"></div><div class="ticker"></div>';
  const [layer, chips, center, banner, ticker] = root.children;
  let lastChips = '';
  return {
    layer,
    scores(rows) {
      const html = rows.map((r) => `<div class="chip${r.out ? ' out' : ''}"><i style="background:${r.color}"></i>${esc(r.name)}`
        + ` <b>${r.text !== undefined ? esc(r.text) : '●'.repeat(r.score) + '○'.repeat(Math.max(0, r.of - r.score))}</b></div>`).join('');
      if (html !== lastChips) { chips.innerHTML = html; lastChips = html; }
    },
    center(text) { center.textContent = text ?? ''; },
    banner(text, sub = '') {
      banner.innerHTML = esc(text) + (sub ? `<small>${esc(sub)}</small>` : '');
      banner.classList.remove('show');
      void banner.offsetWidth;                     // genstart animationen
      banner.classList.add('show');
    },
    tick(text) {
      const d = document.createElement('div');
      d.textContent = text;
      ticker.prepend(d);
      while (ticker.children.length > 4) ticker.lastChild.remove();
      setTimeout(() => d.remove(), 4000);
    },
    clear() { root.innerHTML = ''; },
  };
}
