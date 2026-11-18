/* Dibujo de reglas en cm (marcas cada mm), con el estilo de cristal de la página.
   Lo usa el botón «Regla» de la barra de abajo (medir.js). El fondo de cristal lo pone el CSS (.pv-rul);
   aquí solo se dibujan las marcas, los números, los márgenes, las imágenes elegidas y la línea del mouse. */
(() => {
  const App = window.App;
  const css = n => getComputedStyle(document.documentElement).getPropertyValue(n).trim();
  let font = '';

  // Dibuja una regla en un <canvas>.
  // o = { thin (diseño B), vertical, start (px donde empieza la hoja), ppm (px por mm), len (mm), margin (mm), bands: [[mm, mm], …], hover: mm | null, fs }
  App.drawRuler = (cv, o) => {
    const dpr = Math.min(devicePixelRatio || 1, 2), w = cv.clientWidth, h = cv.clientHeight;
    if (!w || !h) return;
    if (cv.width !== Math.round(w * dpr) || cv.height !== Math.round(h * dpr)) { cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr); }
    if (!font) font = getComputedStyle(document.body).fontFamily || 'system-ui, sans-serif';
    const g = cv.getContext('2d'); g.setTransform(dpr, 0, 0, dpr, 0, 0); g.clearRect(0, 0, w, h);
    const v = !!o.vertical, L = v ? h : w, T = v ? w : h, ppm = o.ppm;
    const ink = css('--ink') || '#0C2438', acc = css('--c4') || '#1F7FD8';
    const R = (a0, a1, col, al) => { a0 = Math.max(0, a0); a1 = Math.min(L, a1); if (a1 <= a0) return; g.globalAlpha = al; g.fillStyle = col; if (v) g.fillRect(0, a0, T, a1 - a0); else g.fillRect(a0, 0, a1 - a0, T); g.globalAlpha = 1; };
    const Ln = (a, c0, c1, col, lw, al) => { g.globalAlpha = al == null ? 1 : al; g.strokeStyle = col; g.lineWidth = lw || 1; g.beginPath(); if (v) { g.moveTo(c0, a); g.lineTo(c1, a); } else { g.moveTo(a, c0); g.lineTo(a, c1); } g.stroke(); g.globalAlpha = 1; };
    const s0 = o.start, s1 = o.start + o.len * ppm, m = (o.margin || 0) * ppm;
    if (m > 0) { R(s0, s0 + m, acc, .13); R(s1 - m, s1, acc, .13); }          // márgenes de la hoja
    const kk = (o.fs || 10) / 10, thin = !!o.thin, nc = thin ? (v ? T - 32.5 * kk : T - 24.5 * kk) : null;                    // thin: diseño B (barra fina azul); nc: centro de la fila de números
    (o.bands || []).forEach(b => {                                             // imágenes elegidas
      const a = s0 + b[0] * ppm, z = s0 + b[1] * ppm;
      if (!thin) { R(a, z, acc, .26); Ln(a, 0, T, acc, 1.5); Ln(z, 0, T, acc, 1.5); return; }
      R(a, z, acc, .16);                                                        // franja suave que continúa la de la hoja
      const a0 = Math.max(0, a), a1 = Math.min(L, z); if (a1 <= a0) return;
      g.fillStyle = acc; g.beginPath();
      const bx = T - 11.75 * kk, by = a0, bw = 2.5 * kk, bh = a1 - a0;
      if (v) { if (g.roundRect) g.roundRect(bx, by, bw, bh, 1.5); else g.rect(bx, by, bw, bh); }
      else { if (g.roundRect) g.roundRect(by, bx, bh, bw, 1.5); else g.rect(by, bx, bh, bw); }
      g.fill();
    });
    // marcas: 1 mm (si caben), 5 mm y 10 mm con número en cm
    const i0 = Math.max(0, Math.floor(-s0 / ppm) - 1), i1 = Math.min(Math.ceil(o.len), Math.ceil((L - s0) / ppm) + 1);
    const fs = o.fs || 10, k = fs / 10;
    const every = ppm * 10 >= 26 * k ? 1 : ppm * 10 >= 13 * k ? 2 : 5;
    g.font = '700 ' + fs + 'px ' + font; g.fillStyle = ink; g.textAlign = 'center'; g.textBaseline = 'middle';
    for (let i = i0; i <= i1; i++) {
      const a = s0 + i * ppm; if (a < -1 || a > L + 1) continue;
      const big = i % 10 === 0, mid = i % 5 === 0;
      if (!big && !mid && ppm < 1.8) continue;
      if (!big && ppm < .9) continue;
      const len = (big ? (thin ? 7 : 8) : mid ? 5.5 : 3) * k;
      Ln(a + .5, T - len - 1, T - 1, ink, big ? 1.4 : 1, big ? .8 : mid ? .6 : .4);
      if (big && (i / 10) % every === 0) {
        g.globalAlpha = .9;
        if (i === 0) {                                   // el 0 queda dentro de la hoja, sin chocar con la esquina
          g.save(); g.textAlign = v ? 'center' : 'left'; g.textBaseline = v ? 'top' : 'middle';
          g.fillText('0', v ? (nc == null ? T / 2 - 2 : nc) : a + 4, v ? a + 4 : (nc == null ? T / 2 - 3 : nc)); g.restore();
        } else g.fillText(String(i / 10), v ? (nc == null ? T / 2 - 2 : nc) : a, v ? a : (nc == null ? T / 2 - 3 : nc));
        g.globalAlpha = 1;
      }
    }
    if (o.hover != null) Ln(s0 + o.hover * ppm, 0, T, acc, 1.5);              // línea del mouse
  };
})();
