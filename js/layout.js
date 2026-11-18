/* Acomodo automático en cuadrícula */
(() => {
  const App = window.App;
  App.layout = () => {
    const S = App.S; App.dims();
    const n = S.items.length; if (!n) return;
    const c = S.cols;
    S.rows = Math.max(S.rows, Math.ceil(n / c));
    const m = S.margin, g = S.gap, r = S.rows;
    const cw = Math.max(5, (S.W - 2*m - (c-1)*g) / c);
    const ch = Math.max(5, (S.H - 2*m - (r-1)*g) / r);
    S.items.forEach((it, i) => {
      const x = m + (i % c) * (cw + g), y = m + Math.floor(i / c) * (ch + g);
      let w = cw, h = ch;
      // «Completa»: el marco toma la proporción de la imagen y queda centrado en su celda, así no sobra banda blanca.
      // «Llenar y recortar»: el marco ocupa toda la celda.
      if (it.fit !== 'cover') { const q = App.imgRatio(it); if (cw / ch > q) w = ch * q; else h = cw / q; }
      it.x = x + (cw - w) / 2; it.y = y + (ch - h) / 2; it.w = w; it.h = h; it.df = false;
    });
    S.manual = false;
  };
  // Orden de lectura según lo que se ve ahora: filas de arriba a abajo, cada fila de izquierda a derecha
  App.readOrder = items => {
    const rows = [];
    [...items].sort((a, b) => (a.y + a.h / 2) - (b.y + b.h / 2)).forEach(it => {
      const cy = it.y + it.h / 2, r = rows[rows.length - 1];
      if (r && cy - r.cy < r.h / 2) r.items.push(it); else rows.push({ cy, h: it.h, items: [it] });
    });
    return rows.flatMap(r => r.items.sort((a, b) => a.x - b.x));
  };
  // Si moviste imágenes a mano, antes de volver a la cuadrícula el orden pasa a ser el que ves en la hoja
  App.keepOrder = () => {
    const a = App.S.items; if (!App.S.manual || a.length < 2) return;
    a.splice(0, a.length, ...App.readOrder(a));
  };
  // Mueve una imagen a otra posición del orden; las demás se corren y cada una toma el lugar que le toca
  App.moveOrder = (id, to) => {
    const a = App.S.items, from = a.findIndex(i => i.id === id); if (from < 0) return;
    to = Math.max(0, Math.min(a.length - 1, to)); if (to === from) return;
    const slots = a.map(i => ({ x: i.x, y: i.y, w: i.w, h: i.h }));
    a.splice(to, 0, a.splice(from, 1)[0]);
    a.forEach((it, i) => Object.assign(it, slots[i]));
    if (!App.S.manual) App.layout();
    App.render();
  };
  // Intercambia el lugar de dos imágenes
  App.swapOrder = (ida, idb) => {
    const a = App.S.items, i = a.findIndex(x => x.id === ida), j = a.findIndex(x => x.id === idb); if (i < 0 || j < 0 || i === j) return;
    const A = a[i], B = a[j], sa = { x: A.x, y: A.y, w: A.w, h: A.h };
    Object.assign(A, { x: B.x, y: B.y, w: B.w, h: B.h }); Object.assign(B, sa);
    a[i] = B; a[j] = A;
    if (!App.S.manual) App.layout();
    App.render();
  };
  App.S.pm = App.S.margin; App.S.pg = App.S.gap;   // margen y espacio con los que se acomodó la hoja la última vez
  // Cambia la separación entre columnas (o filas) de un acomodo hecho a mano, sin mover el resto del orden:
  // las columnas se ensanchan o estrechan para que el conjunto siga ocupando lo mismo.
  const respace = (items, p, s, d) => {
    if (!d || items.length < 2) return;
    const tr = [];
    [...items].sort((u, v) => u[p] - v[p]).forEach(it => {
      const t = tr[tr.length - 1];
      if (t && it[p] < t.e - 0.5) { t.i.push(it); t.e = Math.max(t.e, it[p] + it[s]); }
      else tr.push({ i: [it], s: it[p], e: it[p] + it[s] });
    });
    const n = tr.length; if (n < 2) return;
    const sw = tr.reduce((q, t) => q + t.e - t.s, 0);
    const og = tr.map((t, j) => j ? t.s - tr[j - 1].e : 0), ng = og.map((g, j) => j ? Math.max(0, g + d) : 0);
    const f = Math.max(0.3, (sw + og.reduce((a, b) => a + b, 0) - ng.reduce((a, b) => a + b, 0)) / sw);
    let end = 0;
    tr.forEach((t, j) => {
      const ft = t.i.some(App.isReal) ? 1 : f;      // las caras de documento (tamaño real) solo se desplazan: nunca se estiran
      const ns = j ? end + ng[j] : t.s;
      t.i.forEach(it => { it[p] = ns + (it[p] - t.s) * ft; it[s] *= ft; });
      end = ns + (t.e - t.s) * ft;
    });
  };
  // Ajusta el marco a la proporción de la imagen (sin bandas blancas), centrado donde estaba y dentro de la hoja.
  // No toca las imágenes deformadas a propósito ni las de «Llenar y recortar».
  App.refit = it => {
    const S = App.S; if (it.df || it.fit === 'cover') return;
    const q = App.imgRatio(it), cx = it.x + it.w / 2, cy = it.y + it.h / 2;
    let w = it.w, h = it.h; if (w / h > q) w = h * q; else h = w / q;
    const k = Math.min(1, S.W / w, S.H / h); w *= k; h *= k;
    it.w = w; it.h = h; it.x = Math.max(0, Math.min(S.W - w, cx - w / 2)); it.y = Math.max(0, Math.min(S.H - h, cy - h / 2));
  };
  // Imágenes de tamaño real (las caras que agrega «Documento»; también las de archivos guardados antes de existir esta marca)
  App.isReal = it => !!it.real || /^Documento · /.test(it.name || '');
  // Reacomoda todas las páginas: las automáticas se recalculan; las editadas a mano
  // (si cambió el tamaño o la orientación del papel) se escalan para que no se salgan de la hoja.
  App.relayout = (oW, oH) => {
    const S = App.S; App.save();
    const cur = S.page, rows = S.rows, oM = S.pm == null ? S.margin : S.pm, oG = S.pg == null ? S.gap : S.pg;
    const order = S.pages.map((p, i) => i).filter(i => i !== cur).concat(cur);
    order.forEach(i => {
      const p = S.pages[i]; S.items = p.items; S.manual = p.manual;
      if (!S.manual) { App.layout(); if (i !== cur) S.rows = rows; }
      else {
        if (oW !== S.W || oH !== S.H || oM !== S.margin) {
          // Mantiene tu acomodo: lo que estaba dentro del margen anterior se ajusta al margen nuevo
          const ow = oW - 2 * oM, oh = oH - 2 * oM, nw = S.W - 2 * S.margin, nh = S.H - 2 * S.margin;
          if (ow > 0 && oh > 0 && nw > 0 && nh > 0) {
            const kx = nw / ow, ky = nh / oh;
            const kk = Math.sqrt(kx * ky);      // escala pareja: la imagen conserva su tamaño y su forma al ir de vertical a horizontal y volver
            // Documentos de tamaño real: se mueven juntos, como un bloque rígido (mismo tamaño, misma forma y misma separación entre caras).
            // El bloque sigue el centro que tenía en la hoja y queda dentro de los márgenes; solo se reduce (parejo) si no cabe.
            const real = S.items.filter(App.isReal);
            if (real.length) {
              const x0 = Math.min(...real.map(i => i.x)), y0 = Math.min(...real.map(i => i.y));
              const bw = Math.max(...real.map(i => i.x + i.w)) - x0, bh = Math.max(...real.map(i => i.y + i.h)) - y0;
              const f = Math.min(1, nw / bw, nh / bh);
              const gx = Math.max(S.margin, Math.min(S.W - S.margin - bw * f, S.margin + (x0 + bw / 2 - oM) * kx - bw * f / 2));
              const gy = Math.max(S.margin, Math.min(S.H - S.margin - bh * f, S.margin + (y0 + bh / 2 - oM) * ky - bh * f / 2));
              real.forEach(it => { it.x = gx + (it.x - x0) * f; it.y = gy + (it.y - y0) * f; it.w *= f; it.h *= f; });
            }
            S.items.forEach(it => {
              if (App.isReal(it)) return;
              const stretch = it.df || it.fit === 'cover';      // deformadas y «Llenar y recortar» sí se estiran con la hoja
              const cx = S.margin + (it.x + it.w / 2 - oM) * kx, cy = S.margin + (it.y + it.h / 2 - oM) * ky;      // el centro se mueve con la hoja
              it.w *= stretch ? kx : kk; it.h *= stretch ? ky : kk;
              it.x = cx - it.w / 2; it.y = cy - it.h / 2;
              App.refit(it);
              it.w = Math.max(5, Math.min(S.W, it.w)); it.h = Math.max(5, Math.min(S.H, it.h));      // nunca fuera de la hoja
              it.x = Math.max(0, Math.min(S.W - it.w, it.x)); it.y = Math.max(0, Math.min(S.H - it.h, it.y));
            });
          }
        }
        if (S.gap !== oG) {
          respace(S.items, 'x', 'w', S.gap - oG); respace(S.items, 'y', 'h', S.gap - oG);
          // si al abrir más la separación el bloque de documento se saliera de los márgenes, se vuelve a meter (sin cambiar su tamaño)
          const real = S.items.filter(App.isReal);
          if (real.length) {
            const x0 = Math.min(...real.map(i => i.x)), y0 = Math.min(...real.map(i => i.y));
            const bw = Math.max(...real.map(i => i.x + i.w)) - x0, bh = Math.max(...real.map(i => i.y + i.h)) - y0;
            const dx = bw <= S.W - 2 * S.margin ? Math.max(S.margin, Math.min(S.W - S.margin - bw, x0)) - x0 : 0;
            const dy = bh <= S.H - 2 * S.margin ? Math.max(S.margin, Math.min(S.H - S.margin - bh, y0)) - y0 : 0;
            if (dx || dy) real.forEach(it => { it.x += dx; it.y += dy; });
          }
        }
      }
      p.manual = S.manual;
    });
    S.items = S.pages[cur].items; S.manual = S.pages[cur].manual; S.pm = S.margin; S.pg = S.gap;
  };
  // Límites de margen y espacio según el papel y la cuadrícula (para que las celdas nunca desaparezcan)
  App.limit = k => {
    const S = App.S;
    if (k === 'margin') return Math.max(0, Math.min(60, Math.floor(Math.min(S.W, S.H) / 2 - 10)));
    if (k === 'gap') return Math.max(0, Math.min(60, Math.floor(Math.min((S.W - 2 * S.margin) / S.cols, (S.H - 2 * S.margin) / S.rows) / 2)));
    return 12;
  };
  // Cambió un ajuste: recalcula y redibuja.
  App.change = () => {
    const S = App.S, oW = S.W, oH = S.H; App.dims();
    S.margin = Math.min(S.margin, App.limit('margin')); S.gap = Math.min(S.gap, App.limit('gap'));
    App.relayout(oW, oH); App.render();
  };
})();
