/* Agrandar o achicar varias imágenes a la vez.
   Con 2 o más imágenes elegidas aparece una caja punteada alrededor de todas, con las escuadras en las 4 esquinas.
   Al arrastrar una esquina, todo el grupo cambia de tamaño junto (cada imagen conserva su proporción y sus distancias
   con las demás); la esquina contraria queda fija. Pensado para, por ejemplo, agrandar un poco varias cédulas escaneadas.
   Estilos: css/components.css (.gbox). Se carga después de borde.js. */
(() => {
  const App = window.App, S = App.S, $ = App.$, sheet = $('sheet');
  const MIN = 5;      // mm: ninguna imagen baja de este lado

  const box = document.createElement('div'); box.className = 'gbox'; box.hidden = true;
  ['nw', 'ne', 'sw', 'se'].forEach(c => {
    const h = document.createElement('i'); h.className = 'rz'; h.dataset.c = c;
    h.title = 'Arrastra: agranda o achica todas las imágenes elegidas'; box.append(h);
  });
  const tag = document.createElement('b'); tag.className = 'gtag'; tag.hidden = true; box.append(tag);
  sheet.append(box);                                       // render.js solo borra las imágenes (.it), la caja se queda

  const its = () => App.sels().map(id => App.byId(id)).filter(Boolean);
  const bounds = l => ({ x0: Math.min(...l.map(i => i.x)), y0: Math.min(...l.map(i => i.y)), x1: Math.max(...l.map(i => i.x + i.w)), y1: Math.max(...l.map(i => i.y + i.h)) });
  const upd = () => {
    const l = its(); if (l.length < 2) { box.hidden = true; return; }
    const b = bounds(l); box.hidden = false;
    box.style.left = b.x0 / S.W * 100 + '%'; box.style.top = b.y0 / S.H * 100 + '%';
    box.style.width = (b.x1 - b.x0) / S.W * 100 + '%'; box.style.height = (b.y1 - b.y0) / S.H * 100 + '%';
  };
  let raf = 0; const later = () => { if (!raf) raf = requestAnimationFrame(() => { raf = 0; upd(); }); };
  const rs = App.refreshSel; App.refreshSel = () => { rs(); upd(); };
  const place0 = App.place; App.place = (d, it) => { place0(d, it); if (!box.hidden) later(); };      // la caja sigue a las imágenes cuando se mueven

  const draw = it => { const d = sheet.querySelector('.it[data-id="' + it.id + '"]'); if (d) App.place(d, it); };

  box.addEventListener('pointerdown', e => {
    const h = e.target.closest('.rz'); if (!h || e.button !== 0) return;
    const list = its(); if (list.length < 2) return;
    e.stopPropagation(); e.preventDefault();            // que la hoja no lo tome como clic en vacío (deseleccionar)
    const c = h.dataset.c, cw = c[1] === 'w', cn = c[0] === 'n', b = bounds(list), W0 = b.x1 - b.x0, H0 = b.y1 - b.y0;
    const ax = cw ? b.x1 : b.x0, ay = cn ? b.y1 : b.y0;                          // esquina fija (la contraria a la que se arrastra)
    const st = list.map(it => ({ it, x: it.x, y: it.y, w: it.w, h: it.h })), manual = S.manual;
    const smin = Math.max(...st.map(a => MIN / Math.min(a.w, a.h)));
    const smax = Math.min((cw ? ax : S.W - ax) / W0, (cn ? ay : S.H - ay) / H0);     // no crece más allá del borde de la hoja
    const sx = e.clientX, sy = e.clientY; let s = 1;
    h.setPointerCapture(e.pointerId);
    const set = f => { st.forEach(a => { a.it.w = a.w * f; a.it.h = a.h * f; a.it.x = ax + (a.x - ax) * f; a.it.y = ay + (a.y - ay) * f; draw(a.it); }); };
    const move = ev => {
      const k = sheet.getBoundingClientRect().width / S.W, dx = (ev.clientX - sx) / k, dy = (ev.clientY - sy) / k;
      const ex = cw ? -dx : dx, ey = cn ? -dy : dy;
      s = Math.max(smin, Math.min(smax, Math.max((W0 + ex) / W0, (H0 + ey) / H0)));
      set(s); S.manual = true; upd();
      tag.hidden = false; tag.textContent = Math.round(s * 100) + ' %';
    };
    const end = ev => {
      h.removeEventListener('pointermove', move); h.removeEventListener('pointerup', end); h.removeEventListener('pointercancel', end);
      tag.hidden = true;
      if (Math.hypot(ev.clientX - sx, ev.clientY - sy) >= 4 && Math.abs(s - 1) > .001) {
        App.toast(list.length + ' imágenes · tamaño al ' + Math.round(s * 100) + ' %', 'Deshacer', () => App.undo ? App.undo() : 0);
      } else if (Math.abs(s - 1) > .001) set(1);
      if (App.syncFields) App.syncFields(); if (S.showPages) App.renderPages();
    };
    h.addEventListener('pointermove', move); h.addEventListener('pointerup', end); h.addEventListener('pointercancel', end);
  });
})();
