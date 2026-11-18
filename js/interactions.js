/* Mover, redimensionar, teclado y acciones de la barra */
(() => {
  const App = window.App, $ = App.$, S = App.S, sheet = $('sheet');
  let drag = null, lastId = null, lastT = 0, lastRz = null, lastRzT = 0;
  const plain = v => !!v && typeof v === 'object' && Object.getPrototypeOf(v) === Object.prototype;
  const cl = v => Array.isArray(v) ? v.map(cl) : plain(v) ? Object.keys(v).reduce((o, k) => (o[k] = cl(v[k]), o), {}) : v;      // copia profunda de lo simple (la <img> y los Blob se comparten)
  const el = id => sheet.querySelector(`.it[data-id="${id}"]`);
  // Etiqueta con el porcentaje al agrandar/achicar una sola imagen (misma cápsula que la de la regla)
  const ptag = document.createElement('b'); ptag.className = 'ptag'; ptag.hidden = true; sheet.append(ptag);
  const showPct = (it, base) => {
    ptag.hidden = false; ptag.textContent = Math.round(it.w / base * 100) + ' %';
    ptag.style.left = (it.x + it.w / 2) / S.W * 100 + '%'; ptag.style.top = (it.y + it.h / 2) / S.H * 100 + '%';
  };

  // Ajuste automático: pega bordes/centros a la hoja, los márgenes y las otras imágenes
  function snap(it, mode, k, skip, c) {
    const T = 6 / k, m = S.margin;
    const tx = [0, m, S.W/2, S.W - m, S.W], ty = [0, m, S.H/2, S.H - m, S.H];
    S.items.forEach(o => { if (o === it || (skip && skip.has(o.id))) return; tx.push(o.x, o.x + o.w/2, o.x + o.w); ty.push(o.y, o.y + o.h/2, o.y + o.h); });
    const best = (pts, ts) => {
      let b = null;
      pts.forEach(p => ts.forEach(t => { const d = t - p; if (Math.abs(d) <= T && (!b || Math.abs(d) < Math.abs(b.d))) b = { d, t }; }));
      return b;
    };
    const mv = mode === 'mv';
    const west = !mv && c && c[1] === 'w', north = !mv && c && c[0] === 'n';      // lados que se mueven al cambiar el tamaño
    const bx = best(mv ? [it.x, it.x + it.w/2, it.x + it.w] : [west ? it.x : it.x + it.w], tx);
    const by = best(mv ? [it.y, it.y + it.h/2, it.y + it.h] : [north ? it.y : it.y + it.h], ty);
    if (mv) { if (bx) it.x += bx.d; if (by) it.y += by.d; }
    else {
      if (bx) { const w = Math.max(5, west ? it.w - bx.d : it.w + bx.d); if (west) it.x += it.w - w; it.w = w; }
      if (by) { const h = Math.max(5, north ? it.h - by.d : it.h + by.d); if (north) it.y += it.h - h; it.h = h; }
    }
    return { x: bx && bx.t, y: by && by.t };
  }
  function showGuides(g) {
    const v = $('snapV'), h = $('snapH');
    v.hidden = g.x == null; h.hidden = g.y == null;
    if (g.x != null) v.style.left = g.x / S.W * 100 + '%';
    if (g.y != null) h.style.top = g.y / S.H * 100 + '%';
  }

  // Aplica el cambio a todas las imágenes elegidas
  App.edit = fn => {
    const ids = App.sels(); if (!ids.length) return;
    ids.forEach(id => { const it = App.byId(id); fn(it); const d = el(id); if (d) App.place(d, it); });
    S.manual = true; App.syncFields();
  };

  // Recuadro de selección: elige todas las imágenes que toca
  let marq = null;
  const startMarquee = (e, base, out) => {
    const r = sheet.getBoundingClientRect(), k = r.width / S.W, cl = (v, max) => Math.min(max, Math.max(0, v));
    const box = document.createElement('div'); box.className = 'marq' + (out ? ' out' : ''); box.hidden = true;
    // Desde adentro: la caja vive en la hoja y se recorta con ella. Desde afuera: caja fija en coordenadas de pantalla, para poder cruzar el borde de la hoja
    if (out) { box.style.position = 'fixed'; box.style.zIndex = '30'; box.style.pointerEvents = 'none'; document.body.append(box); } else sheet.append(box);
    marq = out
      ? { x0: (e.clientX - r.left) / k, y0: (e.clientY - r.top) / k, sx: e.clientX, sy: e.clientY, base, box, moved: false, last: '', out: true, add: base.length > 0 }
      : { x0: cl((e.clientX - r.left) / k, S.W), y0: cl((e.clientY - r.top) / k, S.H), sx: e.clientX, sy: e.clientY, base, box, moved: false, last: '' };
    sheet.setPointerCapture(e.pointerId);
  };
  sheet.addEventListener('pointermove', e => {
    if (!marq) return;
    if (!marq.moved && Math.hypot(e.clientX - marq.sx, e.clientY - marq.sy) < 4) return;
    marq.moved = true; marq.box.hidden = false;
    const r = sheet.getBoundingClientRect(), k = r.width / S.W, cl = (v, max) => Math.min(max, Math.max(0, v));
    let x1, y1, xl, xr, yt, yb;
    if (marq.out) {
      // Desde afuera: el recuadro se calcula en pantalla (limitado a la zona de trabajo) y se convierte a coordenadas de la hoja (respeta zoom y desplazamiento)
      if (!marq.cleared) { marq.cleared = true; if (!marq.add) { S.sel = null; S.group = []; App.refreshSel(); } }
      const cr = $('canvas').getBoundingClientRect(), cx = Math.min(cr.right - 1, Math.max(cr.left, e.clientX)), cy = Math.min(cr.bottom - 1, Math.max(cr.top, e.clientY));
      const sx = Math.min(cr.right - 1, Math.max(cr.left, marq.sx)), sy = Math.min(cr.bottom - 1, Math.max(cr.top, marq.sy));
      Object.assign(marq.box.style, { left: Math.min(sx, cx) + 'px', top: Math.min(sy, cy) + 'px', width: Math.abs(cx - sx) + 'px', height: Math.abs(cy - sy) + 'px' });
      const ax = (sx - r.left) / k, ay = (sy - r.top) / k; x1 = (cx - r.left) / k; y1 = (cy - r.top) / k;
      xl = Math.min(ax, x1); xr = Math.max(ax, x1); yt = Math.min(ay, y1); yb = Math.max(ay, y1);
    } else {
      x1 = cl((e.clientX - r.left) / k, S.W); y1 = cl((e.clientY - r.top) / k, S.H);
      xl = Math.min(marq.x0, x1); xr = Math.max(marq.x0, x1); yt = Math.min(marq.y0, y1); yb = Math.max(marq.y0, y1);
      Object.assign(marq.box.style, { left: xl / S.W * 100 + '%', top: yt / S.H * 100 + '%', width: (xr - xl) / S.W * 100 + '%', height: (yb - yt) / S.H * 100 + '%' });
    }
    const ids = [...marq.base];
    S.items.forEach(it => { if (it.x < xr && it.x + it.w > xl && it.y < yb && it.y + it.h > yt && !ids.includes(it.id)) ids.push(it.id); });
    const key = ids.join(',');
    if (key !== marq.last) { marq.last = key; S.crop = false; S.group = ids; S.sel = ids[ids.length - 1] || null; App.refreshSel(); }
  });
  ['pointerup', 'pointercancel'].forEach(t => sheet.addEventListener(t, () => { if (marq) { marq.box.remove(); marq = null; } }));
  // Recuadro desde la zona de trabajo (fuera de la hoja): solo si el clic cae en el fondo del #canvas / #stage.
  // No arranca desde barras, paneles, reglas, escuadras ni el panel de Medidas (el objetivo no sería el fondo), ni desde la barra de desplazamiento ni con el dedo.
  const stageEl = $('stage'), cvEl = $('canvas');
  stageEl.addEventListener('pointerdown', e => {
    if (e.button !== 0 || e.pointerType === 'touch' || marq || drag) return;
    if (e.target !== cvEl && e.target !== stageEl) return;
    const r = cvEl.getBoundingClientRect();
    if (e.clientX < r.left || e.clientX >= r.left + cvEl.clientLeft + cvEl.clientWidth || e.clientY < r.top || e.clientY >= r.top + cvEl.clientTop + cvEl.clientHeight) return;   // fuera de la zona de trabajo o sobre su barra de desplazamiento
    // las reglas dejan pasar el puntero (pointer-events:none): se excluyen por su posición
    if ([...document.querySelectorAll('.pv-rul, .pv-corner')].some(n => { const q = n.getBoundingClientRect(); return e.clientX >= q.left && e.clientX <= q.right && e.clientY >= q.top && e.clientY <= q.bottom; })) return;
    const ae = document.activeElement; if (ae && ae !== document.body && ae.blur) ae.blur();
    const add = e.ctrlKey || e.metaKey || e.shiftKey;
    startMarquee(e, add ? App.sels() : [], true); e.preventDefault();
  });

  // Evita el arrastre nativo del navegador (icono rojo de «no permitido»): solo se mueve con el puntero
  sheet.addEventListener('dragstart', e => e.preventDefault());
  sheet.addEventListener('selectstart', e => e.preventDefault());
  sheet.addEventListener('pointerdown', e => {
    const sg = window.getSelection && window.getSelection(); if (sg && sg.rangeCount) sg.removeAllRanges();
    const ae = document.activeElement; if (ae && ae !== document.body && ae.blur) ae.blur();
    const d = e.target.closest('.it');
    if (!d) {
      // Clic en vacío: deselecciona (con Ctrl/Shift conserva lo elegido) y, si se mantiene y se mueve, dibuja un recuadro para elegir varias
      const add = e.ctrlKey || e.metaKey || e.shiftKey;
      if (!add) { S.sel = null; S.group = []; App.refreshSel(); }
      if (e.button === 0 && e.pointerType !== 'touch' && !e.target.closest('.drop')) startMarquee(e, add ? App.sels() : []);
      return;
    }
    const it = App.byId(d.dataset.id); if (!it) return;      // el elemento ya no corresponde a ninguna imagen (quedó viejo en pantalla)
    const rz = e.target.classList.contains('rz') && App.sels().length < 2;
    const add = !rz && (e.ctrlKey || e.metaKey || e.shiftKey);
    let g = App.sels(), collapse = false;
    if (add) {
      // Ctrl / Shift + clic: suma o quita esta imagen de la selección
      S.crop = false;
      if (g.includes(it.id)) {
        g = g.filter(x => x !== it.id); S.group = g; S.sel = g[g.length - 1] || null;
        App.refreshSel(); e.preventDefault(); return;
      }
      g = [...g, it.id]; S.group = g;
    } else if (!g.includes(it.id)) { g = [it.id]; S.group = g; }
    else if (g.length > 1) collapse = true;       // clic sobre una del grupo: si no arrastra, queda solo esa
    if (S.sel !== it.id) S.crop = false;
    S.sel = it.id;
    const q = it.df ? it.w / it.h : App.imgRatio(it), fat = it.w / it.h > q;   // base proporcional: el recuadro más grande con la proporción de la imagen que cabe en el marco
    drag = { it, d, q, prev: { x: it.x, y: it.y, w: it.w, h: it.h, df: !!it.df, manual: S.manual }, pw: fat ? it.h * q : it.w, ph: fat ? it.h : it.w / q, mode: rz ? 'rz' : (S.crop ? 'pan' : 'mv'), c: rz ? (e.target.dataset.c || 'se') : null, collapse, wasManual: S.manual,
             slots: S.items.map(o => ({ o, x: o.x, y: o.y, w: o.w, h: o.h })),
             sx: e.clientX, sy: e.clientY, ox: it.x, oy: it.y, ow: it.w, oh: it.h, ofx: it.fx || 0, ofy: it.fy || 0,
             grp: g.map(id => { const o = App.byId(id); return { o, ox: o.x, oy: o.y }; }) };
    drag.bb = { x0: Math.min(...drag.grp.map(a => a.ox)), x1: Math.max(...drag.grp.map(a => a.ox + a.o.w)), y0: Math.min(...drag.grp.map(a => a.oy)), y1: Math.max(...drag.grp.map(a => a.oy + a.o.h)) };   // caja del grupo: no puede salir de la hoja
    sheet.setPointerCapture(e.pointerId); e.preventDefault(); App.refreshSel();
  });
  sheet.addEventListener('pointermove', e => {
    if (!drag) return;
    const k = sheet.getBoundingClientRect().width / S.W, it = drag.it;
    const dx = (e.clientX - drag.sx) / k, dy = (e.clientY - drag.sy) / k;
    if (drag.mode === 'pan') {
      it.fx = drag.ofx + dx / it.w; it.fy = drag.ofy + dy / it.h;
      App.place(drag.d, it); return;
    }
    const lim = (d, lo, hi) => Math.max(lo, Math.min(hi, d)), bb = drag.bb;
    if (drag.mode === 'mv') { it.x = drag.ox + lim(dx, -bb.x0, S.W - bb.x1); it.y = drag.oy + lim(dy, -bb.y0, S.H - bb.y1); }
    // Cambio de tamaño: la esquina contraria a la que se arrastra queda fija
    const cw = drag.c && drag.c[1] === 'w', cn = drag.c && drag.c[0] === 'n';
    const ax = cw ? drag.ox + drag.ow : drag.ox, ay = cn ? drag.oy + drag.oh : drag.oy;       // esquina fija
    const anchor = () => { it.x = cw ? ax - it.w : ax; it.y = cn ? ay - it.h : ay; };
    if (drag.mode === 'rz') {
      const ex = cw ? -dx : dx, ey = cn ? -dy : dy;      // cuánto crece (+) o se encoge (−) hacia cada lado
      if (e.shiftKey) { it.w = Math.max(5, drag.ow + ex); it.h = Math.max(5, drag.oh + ey); }   // Shift: deformar libremente
      else { it.w = Math.max(5, 5 * drag.q, drag.pw + ex, (drag.ph + ey) * drag.q); it.h = it.w / drag.q; } // normal: conserva la proporción
      anchor();
    }
    const skip = drag.mode === 'mv' ? new Set(drag.grp.map(g => g.o.id)) : null;
    const gd = S.snap && !e.altKey ? snap(it, drag.mode, k, skip, drag.c) : {};
    if (drag.mode === 'mv') { it.x = drag.ox + lim(it.x - drag.ox, -bb.x0, S.W - bb.x1); it.y = drag.oy + lim(it.y - drag.oy, -bb.y0, S.H - bb.y1); }
    if (drag.mode === 'rz') {
      if (!e.shiftKey) { if (gd.x != null) it.h = it.w / drag.q; else if (gd.y != null) it.w = it.h * drag.q; }
      const mw = Math.max(5, cw ? ax : S.W - ax), mh = Math.max(5, cn ? ay : S.H - ay);      // no crece más allá del borde de la hoja
      if (e.shiftKey) { it.w = Math.min(it.w, mw); it.h = Math.min(it.h, mh); }
      else { const sc = Math.min(1, mw / it.w, mh / it.h); it.w *= sc; it.h *= sc; }
      anchor();
      it.df = Math.abs(it.w / it.h / App.imgRatio(it) - 1) > .01;      // deformada si el marco ya no tiene la proporción de la imagen
    }
    showGuides(gd);
    if (drag.mode === 'mv') {
      // el resto de la selección se mueve lo mismo que la principal
      const ddx = it.x - drag.ox, ddy = it.y - drag.oy;
      drag.grp.forEach(g => { if (g.o === it) return; g.o.x = g.ox + ddx; g.o.y = g.oy + ddy; const d2 = el(g.o.id); if (d2) App.place(d2, g.o); });
    }
    S.manual = true; App.place(drag.d, it); App.syncFields();
    if (drag.mode === 'rz') showPct(it, drag.prev.w);
  });
  ['pointerup', 'pointercancel'].forEach(t => sheet.addEventListener(t, e => {
    const was = drag; drag = null; showGuides({}); ptag.hidden = true;
    // En acomodo automático, soltar una imagen sobre otra las intercambia de lugar en la cuadrícula
    if (was && t === 'pointerup' && was.mode === 'mv' && !was.wasManual && was.grp.length < 2 && Math.hypot(e.clientX - was.sx, e.clientY - was.sy) >= 4) {
      const r = sheet.getBoundingClientRect(), px = (e.clientX - r.left) / r.width * S.W, py = (e.clientY - r.top) / r.height * S.H;
      const hit = was.slots.find(s => s.o !== was.it && px >= s.x && px <= s.x + s.w && py >= s.y && py <= s.y + s.h);
      if (hit) { was.it.x = was.ox; was.it.y = was.oy; S.manual = false; App.swapOrder(was.it.id, hit.o.id); return; }
    }
    // Tirador de esquina: si se arrastró, se puede deshacer; doble clic vuelve a la proporción original
    if (was && t === 'pointerup' && was.mode === 'rz') {
      if (Math.hypot(e.clientX - was.sx, e.clientY - was.sy) >= 4) {
        undoRz = { it: was.it, prev: was.prev };
        App.toast(was.it.df ? 'Imagen deformada' : 'Tamaño cambiado', 'Deshacer', () => App.undo()); App.refreshSel();
      } else {
        const now = performance.now();
        if (lastRz === was.it.id && now - lastRzT < 350) { lastRz = null; App.resetShape(was.it); }
        else { lastRz = was.it.id; lastRzT = now; }
      }
    }
    if (was && t === 'pointerup' && was.mode !== 'rz' && Math.hypot(e.clientX - was.sx, e.clientY - was.sy) < 4) {
      if (was.collapse) { S.group = [was.it.id]; S.sel = was.it.id; App.refreshSel(); }
      // Doble toque sobre la imagen: entra o sale del encuadre
      const now = performance.now();
      if (lastId === was.it.id && now - lastT < 350 && App.sels().length < 2) { S.crop = !S.crop; lastId = null; App.refreshSel(); }
      else { lastId = was.it.id; lastT = now; }
    }
    if (was && S.showPages) App.renderPages();
  }));

  // Cambios de encuadre (no cuentan como mover la imagen a mano)
  App.crop = fn => {
    const it = App.byId(S.sel); if (!it) return;
    fn(it); const d = el(it.id); if (d) App.place(d, it);
  };
  App.setCropZoom = z => App.crop(it => { it.z = Math.min(5, Math.max(.2, z)); });
  sheet.addEventListener('wheel', e => {
    if (!S.crop || !S.sel || e.ctrlKey || !e.target.closest('.it')) return;
    e.preventDefault();
    const it = App.byId(S.sel); App.setCropZoom((it.z || 1) + (e.deltaY < 0 ? .1 : -.1));
    if (S.showPages) App.renderPages();
  }, { passive: false });

  // Deshacer el último cambio de tamaño o deformación hecho con los tiradores de esquina
  let undoRz = null;
  App.undoResize = () => {
    const u = undoRz; if (!u || !S.items.includes(u.it)) return false;
    Object.assign(u.it, { x: u.prev.x, y: u.prev.y, w: u.prev.w, h: u.prev.h, df: u.prev.df }); S.manual = u.prev.manual; undoRz = null;
    const d = el(u.it.id); if (d) App.place(d, u.it);
    App.syncFields(); App.refreshSel(); if (S.showPages) App.renderPages(); return true;
  };
  // Vuelve la imagen a la proporción original (quita la deformación)
  App.resetShape = it => {
    if (!it) return;
    undoRz = { it, prev: { x: it.x, y: it.y, w: it.w, h: it.h, df: !!it.df, manual: S.manual } };
    it.df = false; it.h = it.w / App.imgRatio(it); S.manual = true;
    const d = el(it.id); if (d) App.place(d, it);
    App.syncFields(); App.refreshSel(); if (S.showPages) App.renderPages();
  };
  $('bUndeform').onclick = () => App.resetShape(App.byId(S.sel));
  App.rotate = () => {
    const was = S.manual;
    App.edit(it => {
      it.rot = (it.rot + 90) % 360;
      if (was) {      // a mano: el marco también gira (ancho ↔ alto) para seguir la imagen, sin salirse de la hoja
        const cx = it.x + it.w / 2, cy = it.y + it.h / 2, w = it.h, h = it.w;
        it.w = w; it.h = h; it.x = cx - w / 2; it.y = cy - h / 2;
        if (it.df || it.fit === 'cover') {
          const k = Math.min(1, S.W / it.w, S.H / it.h); it.w *= k; it.h *= k;
          it.x = Math.max(0, Math.min(S.W - it.w, cx - it.w / 2)); it.y = Math.max(0, Math.min(S.H - it.h, cy - it.h / 2));
        } else App.refit(it);
      }
    });
    if (!was) { App.layout(); App.render(); }     // en acomodo automático el marco se ajusta a la imagen girada
  };
  App.dup = () => {
    const ids = App.sels(); if (!ids.length) return;
    const cs = ids.map(id => { const it = App.byId(id), c = { ...it, id: 'i' + (++S.uid), x: it.x + 5, y: it.y + 5, l: App.nextLayer() }; S.items.push(c); return c; });
    S.group = cs.map(c => c.id); S.sel = cs[cs.length - 1].id;
    if (!S.manual) App.layout(); App.render();
  };
  // Capas: sube o baja las imágenes elegidas (no cambia su lugar en la cuadrícula)
  App.layer = mode => {
    const ids = App.sels(); if (!ids.length) return;
    const o = S.items.map((it, i) => ({ it, i })).sort((a, b) => ((a.it.l || 0) - (b.it.l || 0)) || a.i - b.i).map(x => x.it);
    const sel = it => ids.includes(it.id); let r = [...o];
    if (mode === 'top') r = [...o.filter(x => !sel(x)), ...o.filter(sel)];
    else if (mode === 'bottom') r = [...o.filter(sel), ...o.filter(x => !sel(x))];
    else if (mode === 'up') { for (let i = r.length - 2; i >= 0; i--) if (sel(r[i]) && !sel(r[i + 1])) [r[i], r[i + 1]] = [r[i + 1], r[i]]; }
    else { for (let i = 1; i < r.length; i++) if (sel(r[i]) && !sel(r[i - 1])) [r[i], r[i - 1]] = [r[i - 1], r[i]]; }
    r.forEach((it, i) => { it.l = i + 1; const d = el(it.id); if (d) d.style.zIndex = it.l; });
    if (S.showPages) App.renderPages();
  };
  // Borrar toda la hoja actual (se puede deshacer)
  App.clearPage = () => {
    if (!S.items.length) { App.toast('La hoja ya está vacía.'); return; }
    const saved = S.items.splice(0), page = S.page, man = S.manual;
    S.sel = null; S.group = []; S.manual = false; App.render();
    App.toast(saved.length === 1 ? 'Hoja borrada (1 imagen)' : 'Hoja borrada (' + saved.length + ' imágenes)', 'Deshacer', () => App.undo());
  };
  App.remove = () => {
    const ids = App.sels(); if (!ids.length) return;
    const gone = ids.map(id => ({ it: App.byId(id), i: S.items.findIndex(x => x.id === id) })).sort((a, b) => a.i - b.i);
    const page = S.page;
    [...gone].reverse().forEach(g => S.items.splice(g.i, 1));
    S.sel = null; S.group = [];
    if (!S.manual) App.layout(); App.render();
    App.toast(gone.length > 1 ? gone.length + ' imágenes quitadas' : 'Imagen quitada', 'Deshacer', () => App.undo());
  };

  // Cortar / copiar / pegar (Ctrl + X / C / V): sirve para duplicar imágenes, moverlas o llevarlas a otra página.
  // Copiar NO cambia la hoja (no entra al historial). Cada pegado es un paso del historial (Ctrl+Z lo quita, Ctrl+Y lo devuelve).
  let pasteN = 0, clipPage = 0;
  const OFFSET = 5;      // mm: cada pegado se corre un poco para distinguirlo del original
  App.copySel = cut => {
    const ids = App.sels(); if (!ids.length) return false;
    App.clip = ids.map(id => ({ ...App.byId(id) })).filter(i => i.id); App.clipCut = !!cut; pasteN = 0; clipPage = S.page;
    // vacía el portapapeles del sistema: si no, Ctrl+V pegaría lo último que copiaste por fuera (otro archivo o imagen) y no esto
    try { navigator.clipboard.writeText('').catch(() => {}); } catch (e) {}
    return true;
  };
  App.pasteClip = () => {
    const src = App.clip; if (!src || !src.length) return false;
    const bx = Math.min(...src.map(i => i.x)), by = Math.min(...src.map(i => i.y));
    const bw = Math.max(...src.map(i => i.x + i.w)) - bx, bh = Math.max(...src.map(i => i.y + i.h)) - by;
    // Lo cortado se pega en su mismo lugar (es mover). Lo copiado se pega corrido; en otra página, el primer pegado cae en el mismo sitio
    pasteN++;
    const k = App.clipCut ? 0 : pasteN - (S.page !== clipPage ? 1 : 0), off = OFFSET * k;
    let nx = Math.max(0, Math.min(S.W - bw, bx + off)), ny = Math.max(0, Math.min(S.H - bh, by + off));
    const cs = src.map((it, i) => ({ ...cl(it), id: 'i' + (++S.uid), x: it.x - bx + nx, y: it.y - by + ny, l: App.nextLayer() + i }));
    cs.forEach(c => S.items.push(c));
    S.group = cs.map(c => c.id); S.sel = cs[cs.length - 1].id; S.crop = false;
    S.manual = true;      // se respeta el lugar donde cae la copia (sin reacomodar la cuadrícula)
    if (App.clipCut) { App.clip = null; App.clipCut = false; }      // lo cortado se pega una sola vez
    App.render(); return true;
  };
  addEventListener('paste', e => {
    if (/INPUT|SELECT|TEXTAREA/.test(document.activeElement.tagName)) return;
    const f = [...((e.clipboardData && e.clipboardData.files) || [])]; if (f.some(x => /^image\//.test(x.type) || /\.hei[cf]$/i.test(x.name))) return;   // imágenes del portapapeles del sistema: las maneja ui.js
    if (App.pasteClip()) e.preventDefault();
  });

  // Mostrar u ocultar el panel de la imagen (izquierda) para tener más espacio
  App.toggleSide = force => {
    const hide = force === undefined ? !document.body.classList.contains('noside') : !force;
    document.body.classList.toggle('noside', hide);
    $('bSide').classList.toggle('on', !hide); $('bSide').setAttribute('aria-pressed', String(!hide));
    App.render();
  };
  $('bSide').onclick = () => App.toggleSide();

  addEventListener('keydown', e => {
    if (/INPUT|SELECT|TEXTAREA/.test(document.activeElement.tagName)) return;
    if (!e.ctrlKey && !e.metaKey && !e.altKey && e.key.toLowerCase() === 'p') { e.preventDefault(); App.toggleSide(); return; }
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'a' && S.items.length) {
      e.preventDefault(); S.group = S.items.map(i => i.id); S.sel = S.items[S.items.length - 1].id; App.refreshSel(); return;
    }
    if ((e.ctrlKey || e.metaKey) && !e.altKey && (e.key.toLowerCase() === 'x' || e.key.toLowerCase() === 'c') && S.sel) {
      const tx = window.getSelection && String(window.getSelection()); if (tx && tx.trim()) return;      // hay texto seleccionado (p. ej. en la ayuda): se deja el copiar normal
      e.preventDefault(); const cut = e.key.toLowerCase() === 'x'; if (!App.copySel(cut)) return;
      if (cut) { App.remove(); App.toast('Imagen cortada · cambia de página o lugar y presiona Ctrl + V'); }
      else App.toast(App.clip.length > 1 ? App.clip.length + ' imágenes copiadas · presiona Ctrl + V para pegarlas' : 'Imagen copiada · presiona Ctrl + V para pegarla');
      return;
    }
    if (!S.sel) return;
    if ((e.ctrlKey || e.metaKey) && (e.key === ']' || e.key === '[')) { e.preventDefault(); App.layer(e.key === ']' ? (e.shiftKey ? 'top' : 'up') : (e.shiftKey ? 'bottom' : 'down')); return; }
    if (e.key === 'Escape') {
      if (S.crop) S.crop = false; else { S.sel = null; S.group = []; }
      App.refreshSel(); return;
    }
    const st = e.shiftKey ? 5 : 1;
    const mv = { ArrowLeft:[-st,0], ArrowRight:[st,0], ArrowUp:[0,-st], ArrowDown:[0,st] }[e.key];
    if (mv) {
      e.preventDefault();
      const its = App.sels().map(App.byId).filter(Boolean); if (!its.length) return;
      const x0 = Math.min(...its.map(i => i.x)), x1 = Math.max(...its.map(i => i.x + i.w)), y0 = Math.min(...its.map(i => i.y)), y1 = Math.max(...its.map(i => i.y + i.h));
      const dx = Math.max(-x0, Math.min(S.W - x1, mv[0])), dy = Math.max(-y0, Math.min(S.H - y1, mv[1]));      // sin salirse de la hoja
      App.edit(it => { it.x += dx; it.y += dy; });
    }
    else if (e.key === 'Delete' || e.key === 'Backspace') { e.preventDefault(); App.remove(); }
    else if ((e.ctrlKey || e.metaKey) && e.key === 'd') { e.preventDefault(); App.dup(); }
  });
})();
