/* Marcas de corte: guías para recortar con tijera o guillotina.
   S.marks = 'none' (sin marcas) · 'corners' (esquinas fuera de cada imagen) · 'lines' (líneas punteadas entre las imágenes).
   En pantalla se ven suaves; salen al imprimir y en el PDF y el PNG. */
(() => {
  const App = window.App, S = App.S, $ = App.$;
  const NS = 'http://www.w3.org/2000/svg';
  S.marks = 'none';
  const DASH = [2, 1.5];      // mm: raya y espacio de las líneas punteadas

  // Calcula los trazos en mm para una lista de imágenes: { segs: [[x1,y1,x2,y2]…], dash: bool }
  App.marksSegs = (items, mode) => {
    const W = S.W, H = S.H, out = { segs: [], dash: false };
    if (!items || !items.length || !mode || mode === 'none') return out;
    const seen = new Set(), add = (x1, y1, x2, y2) => {
      const k = [x1, y1, x2, y2].map(v => Math.round(v * 100)).join(',');
      if (!seen.has(k)) { seen.add(k); out.segs.push([x1, y1, x2, y2]); }
    };
    if (mode === 'corners') {
      const OFF = 1, LEN = 4;      // la marca empieza a 1 mm de la esquina y mide hasta 4 mm
      // Espacio libre desde un punto hasta la hoja o la imagen vecina, en la dirección dada (así una marca nunca toca otra imagen)
      const free = (horiz, dir, px, py, self) => {
        let f = horiz ? (dir > 0 ? W - px : px) : (dir > 0 ? H - py : py);
        items.forEach(o => {
          if (o === self) return;
          if (horiz) { if (py > o.y + .01 && py < o.y + o.h - .01) { const d = dir > 0 ? o.x - px : px - (o.x + o.w); if (d >= -.01 && d < f) f = d; } }
          else if (px > o.x + .01 && px < o.x + o.w - .01) { const d = dir > 0 ? o.y - py : py - (o.y + o.h); if (d >= -.01 && d < f) f = d; }
        });
        return f;
      };
      const tick = (horiz, dir, px, py, self) => {
        const b = Math.min(OFF + LEN, free(horiz, dir, px, py, self) - .8);
        if (b - OFF < 1.2) return;
        if (horiz) add(px + dir * OFF, py, px + dir * b, py); else add(px, py + dir * OFF, px, py + dir * b);
      };
      items.forEach(it => [[it.x, -1], [it.x + it.w, 1]].forEach(([px, sx]) => [[it.y, -1], [it.y + it.h, 1]].forEach(([py, sy]) => {
        tick(true, sx, px, py, it); tick(false, sy, px, py, it);
      })));
      return out;
    }
    // Líneas: en el medio de cada hueco entre imágenes y justo por fuera del conjunto
    out.dash = true;
    const tracks = (p, s) => {
      const t = [];
      [...items].sort((a, b) => a[p] - b[p]).forEach(it => {
        const l = t[t.length - 1];
        if (l && it[p] < l.e - .01) l.e = Math.max(l.e, it[p] + it[s]); else t.push({ s: it[p], e: it[p] + it[s] });
      });
      return t;
    };
    const o = Math.max(.5, Math.min(3, (S.gap || 0) / 2));      // el borde exterior queda a media separación, como los huecos
    const cuts = (t, size) => {
      const c = [];
      t.forEach((q, i) => { if (i && q.s - t[i - 1].e >= 1) c.push((q.s + t[i - 1].e) / 2); });
      const f = t[0], l = t[t.length - 1];
      if (f.s >= 2 * o) c.push(f.s - o);
      if (size - l.e >= 2 * o) c.push(l.e + o);
      return c;
    };
    const E = 3;      // las líneas llegan a 3 mm del borde de la hoja
    cuts(tracks('x', 'w'), W).forEach(x => add(x, E, x, H - E));
    cuts(tracks('y', 'h'), H).forEach(y => add(E, y, W - E, y));
    return out;
  };

  const pathOf = segs => segs.map(s => 'M' + s.map(v => Math.round(v * 100) / 100).slice(0, 2).join(' ') + 'L' + s.map(v => Math.round(v * 100) / 100).slice(2).join(' ')).join('');

  // Dibujo SVG de las marcas (en mm). Se usa en pantalla y al imprimir.
  App.marksEl = (items, o) => {
    const m = App.marksSegs(items, S.marks); if (!m.segs.length) return null;
    const svg = document.createElementNS(NS, 'svg');
    svg.setAttribute('class', 'marks'); svg.setAttribute('viewBox', `0 0 ${S.W} ${S.H}`); svg.setAttribute('preserveAspectRatio', 'none'); svg.setAttribute('aria-hidden', 'true');
    const p = document.createElementNS(NS, 'path');
    p.setAttribute('d', pathOf(m.segs)); p.setAttribute('fill', 'none'); p.setAttribute('stroke', o.color); p.setAttribute('stroke-width', o.w);
    if (o.op != null) p.setAttribute('stroke-opacity', o.op);
    if (m.dash) p.setAttribute('stroke-dasharray', DASH.join(' '));
    svg.append(p); return svg;
  };

  // Marcas en la pantalla (se redibujan al mover, cambiar el tamaño o el zoom)
  App.drawMarks = () => {
    const sheet = $('sheet'), old = sheet.querySelector(':scope > .marks');
    if (old) old.remove();
    if (S.marks === 'none' || !S.items.length) return;
    const px = sheet.clientWidth / S.W || 1;      // píxeles por mm
    const el = App.marksEl(S.items, { color: '#222', op: .8, w: 1.3 / px });
    if (el) sheet.append(el);
  };
  let raf = 0;
  const queue = () => { if (!raf) raf = requestAnimationFrame(() => { raf = 0; App.drawMarks(); }); };
  const place0 = App.place, fit0 = App.fit, render0 = App.render;
  App.place = (...a) => { const r = place0.apply(App, a); if (S.marks !== 'none') queue(); return r; };
  App.fit = (...a) => { const r = fit0.apply(App, a); if (S.marks !== 'none') queue(); return r; };
  App.render = (...a) => { const r = render0.apply(App, a); App.drawMarks(); return r; };
})();
