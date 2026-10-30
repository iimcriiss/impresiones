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
      it.x = m + (i % c) * (cw + g);
      it.y = m + Math.floor(i / c) * (ch + g);
      it.w = cw; it.h = ch;
    });
    S.manual = false;
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
      const ns = j ? end + ng[j] : t.s;
      t.i.forEach(it => { it[p] = ns + (it[p] - t.s) * f; it[s] *= f; });
      end = ns + (t.e - t.s) * f;
    });
  };
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
            S.items.forEach(it => { it.x = S.margin + (it.x - oM) * kx; it.w *= kx; it.y = S.margin + (it.y - oM) * ky; it.h *= ky; });
          }
        }
        if (S.gap !== oG) { respace(S.items, 'x', 'w', S.gap - oG); respace(S.items, 'y', 'h', S.gap - oG); }
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
