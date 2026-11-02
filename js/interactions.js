/* Mover, redimensionar, teclado y acciones de la barra */
(() => {
  const App = window.App, $ = App.$, S = App.S, sheet = $('sheet');
  let drag = null, lastId = null, lastT = 0, lastRz = null, lastRzT = 0;
  const el = id => sheet.querySelector(`.it[data-id="${id}"]`);

  // Ajuste automático: pega bordes/centros a la hoja, los márgenes y las otras imágenes
  function snap(it, mode, k, skip) {
    const T = 6 / k, m = S.margin;
    const tx = [0, m, S.W/2, S.W - m, S.W], ty = [0, m, S.H/2, S.H - m, S.H];
    S.items.forEach(o => { if (o === it || (skip && skip.has(o.id))) return; tx.push(o.x, o.x + o.w/2, o.x + o.w); ty.push(o.y, o.y + o.h/2, o.y + o.h); });
    const best = (pts, ts) => {
      let b = null;
      pts.forEach(p => ts.forEach(t => { const d = t - p; if (Math.abs(d) <= T && (!b || Math.abs(d) < Math.abs(b.d))) b = { d, t }; }));
      return b;
    };
    const mv = mode === 'mv';
    const bx = best(mv ? [it.x, it.x + it.w/2, it.x + it.w] : [it.x + it.w], tx);
    const by = best(mv ? [it.y, it.y + it.h/2, it.y + it.h] : [it.y + it.h], ty);
    if (mv) { if (bx) it.x += bx.d; if (by) it.y += by.d; }
    else { if (bx) it.w = Math.max(5, it.w + bx.d); if (by) it.h = Math.max(5, it.h + by.d); }
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

  sheet.addEventListener('pointerdown', e => {
    const ae = document.activeElement; if (ae && ae !== document.body && ae.blur) ae.blur();
    const d = e.target.closest('.it');
    if (!d) { S.sel = null; S.group = []; App.refreshSel(); return; }
    const it = App.byId(d.dataset.id);
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
    drag = { it, d, q, prev: { x: it.x, y: it.y, w: it.w, h: it.h, df: !!it.df, manual: S.manual }, pw: fat ? it.h * q : it.w, ph: fat ? it.h : it.w / q, mode: rz ? 'rz' : (S.crop ? 'pan' : 'mv'), collapse, wasManual: S.manual,
             slots: S.items.map(o => ({ o, x: o.x, y: o.y, w: o.w, h: o.h })),
             sx: e.clientX, sy: e.clientY, ox: it.x, oy: it.y, ow: it.w, oh: it.h, ofx: it.fx || 0, ofy: it.fy || 0,
             grp: g.map(id => { const o = App.byId(id); return { o, ox: o.x, oy: o.y }; }) };
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
    if (drag.mode === 'mv') { it.x = drag.ox + dx; it.y = drag.oy + dy; }
    else if (e.shiftKey) { it.w = Math.max(5, drag.ow + dx); it.h = Math.max(5, drag.oh + dy); }   // Shift: deformar libremente
    else { it.w = Math.max(5, drag.pw + dx, (drag.ph + dy) * drag.q); it.h = it.w / drag.q; }       // normal: conserva la proporción
    const skip = drag.mode === 'mv' ? new Set(drag.grp.map(g => g.o.id)) : null;
    const gd = S.snap && !e.altKey ? snap(it, drag.mode, k, skip) : {};
    if (drag.mode === 'rz') {
      if (!e.shiftKey) { if (gd.x != null) it.h = it.w / drag.q; else if (gd.y != null) it.w = it.h * drag.q; }
      it.df = Math.abs(it.w / it.h / App.imgRatio(it) - 1) > .01;      // deformada si el marco ya no tiene la proporción de la imagen
    }
    showGuides(gd);
    if (drag.mode === 'mv') {
      // el resto de la selección se mueve lo mismo que la principal
      const ddx = it.x - drag.ox, ddy = it.y - drag.oy;
      drag.grp.forEach(g => { if (g.o === it) return; g.o.x = g.ox + ddx; g.o.y = g.oy + ddy; const d2 = el(g.o.id); if (d2) App.place(d2, g.o); });
    }
    S.manual = true; App.place(drag.d, it); App.syncFields();
  });
  ['pointerup', 'pointercancel'].forEach(t => sheet.addEventListener(t, e => {
    const was = drag; drag = null; showGuides({});
    // En acomodo automático, soltar una imagen sobre otra las intercambia de lugar en la cuadrícula
    if (was && t === 'pointerup' && was.mode === 'mv' && !was.wasManual && was.grp.length < 2 && Math.hypot(e.clientX - was.sx, e.clientY - was.sy) >= 4) {
      const r = sheet.getBoundingClientRect(), px = (e.clientX - r.left) / r.width * S.W, py = (e.clientY - r.top) / r.height * S.H;
      const hit = was.slots.find(s => s.o !== was.it && px >= s.x && px <= s.x + s.w && py >= s.y && py <= s.y + s.h);
      if (hit) { was.it.x = was.ox; was.it.y = was.oy; S.manual = false; App.swapOrder(was.it.id, hit.o.id); return; }
    }
    // Triángulo: si se arrastró, se puede deshacer; doble clic vuelve a la proporción original
    if (was && t === 'pointerup' && was.mode === 'rz') {
      if (Math.hypot(e.clientX - was.sx, e.clientY - was.sy) >= 4) {
        undoRz = { it: was.it, prev: was.prev };
        App.toast(was.it.df ? 'Imagen deformada' : 'Tamaño cambiado', 'Deshacer', App.undoResize); App.refreshSel();
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
  App.setCropZoom = z => App.crop(it => { it.z = Math.min(5, Math.max(.2, z)); $('cz').value = Math.round(it.z * 100); $('czVal').textContent = Math.round(it.z * 100) + '%'; });
  sheet.addEventListener('wheel', e => {
    if (!S.crop || !S.sel || e.ctrlKey || !e.target.closest('.it')) return;
    e.preventDefault();
    const it = App.byId(S.sel); App.setCropZoom((it.z || 1) + (e.deltaY < 0 ? .1 : -.1));
    $('cz').value = Math.round(it.z * 100);
    if (S.showPages) App.renderPages();
  }, { passive: false });

  // Deshacer el último cambio de tamaño o deformación hecho con el triángulo
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
    App.edit(it => { it.rot = (it.rot + 90) % 360; });
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
    App.toast(saved.length === 1 ? 'Hoja borrada (1 imagen)' : 'Hoja borrada (' + saved.length + ' imágenes)', 'Deshacer', () => {
      if (S.page !== page && S.pages[page]) App.setPage(page);
      S.items.push(...saved); S.manual = man; App.render();
    });
  };
  App.remove = () => {
    const ids = App.sels(); if (!ids.length) return;
    const gone = ids.map(id => ({ it: App.byId(id), i: S.items.findIndex(x => x.id === id) })).sort((a, b) => a.i - b.i);
    const page = S.page;
    [...gone].reverse().forEach(g => S.items.splice(g.i, 1));
    S.sel = null; S.group = [];
    if (!S.manual) App.layout(); App.render();
    App.toast(gone.length > 1 ? gone.length + ' imágenes quitadas' : 'Imagen quitada', 'Deshacer', () => {
      if (S.page !== page && S.pages[page]) App.setPage(page);
      gone.forEach(g => S.items.splice(g.i, 0, g.it));
      S.group = gone.map(g => g.it.id); S.sel = gone[gone.length - 1].it.id;
      if (!S.manual) App.layout(); App.render();
    });
  };

  // Cortar / copiar / pegar (Ctrl + X / C / V): sirve para mover imágenes a otro lugar o a otra página
  let ptr = null;
  sheet.addEventListener('pointermove', e => { const r = sheet.getBoundingClientRect(); ptr = { x: (e.clientX - r.left) / r.width * S.W, y: (e.clientY - r.top) / r.height * S.H }; });
  sheet.addEventListener('pointerleave', () => { ptr = null; });
  App.copySel = cut => { App.clip = App.sels().map(id => ({ ...App.byId(id) })); App.clipCut = !!cut; };
  App.pasteClip = () => {
    const src = App.clip; if (!src || !src.length) return false;
    const bx = Math.min(...src.map(i => i.x)), by = Math.min(...src.map(i => i.y));
    const bw = Math.max(...src.map(i => i.x + i.w)) - bx, bh = Math.max(...src.map(i => i.y + i.h)) - by;
    // con el mouse sobre la hoja: se pega ahí (centrado en el puntero); si no, en el mismo lugar con un pequeño corrimiento
    let nx = ptr ? ptr.x - bw / 2 : bx + 5, ny = ptr ? ptr.y - bh / 2 : by + 5;
    nx = Math.max(0, Math.min(S.W - bw, nx)); ny = Math.max(0, Math.min(S.H - bh, ny));
    const cs = src.map(it => ({ ...it, id: 'i' + (++S.uid), x: it.x - bx + nx, y: it.y - by + ny, l: App.nextLayer() }));
    cs.forEach((c, i) => { c.l += i; S.items.push(c); });
    S.group = cs.map(c => c.id); S.sel = cs[cs.length - 1].id;
    if (ptr || S.manual) S.manual = true; else App.layout();
    if (App.clipCut) { App.clip = null; App.clipCut = false; }      // lo cortado se pega una sola vez (es mover, no copiar)
    App.render(); return true;
  };
  addEventListener('paste', e => {
    if (/INPUT|SELECT|TEXTAREA/.test(document.activeElement.tagName)) return;
    const f = e.clipboardData && e.clipboardData.files; if (f && f.length) return;   // imágenes del portapapeles del sistema: las maneja ui.js
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
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') { if (App.undoResize()) e.preventDefault(); return; }
    if ((e.ctrlKey || e.metaKey) && !e.altKey && (e.key.toLowerCase() === 'x' || e.key.toLowerCase() === 'c') && S.sel) {
      e.preventDefault(); const cut = e.key.toLowerCase() === 'x'; App.copySel(cut);
      if (cut) { App.remove(); App.toast('Imagen cortada · cambia de página o lugar y presiona Ctrl + V'); }
      else App.toast('Imagen copiada · presiona Ctrl + V para pegarla');
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
    if (mv) { e.preventDefault(); App.edit(it => { it.x += mv[0]; it.y += mv[1]; }); }
    else if (e.key === 'Delete' || e.key === 'Backspace') { e.preventDefault(); App.remove(); }
    else if ((e.ctrlKey || e.metaKey) && e.key === 'd') { e.preventDefault(); App.dup(); }
  });
})();
