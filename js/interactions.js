/* Mover, redimensionar, teclado y acciones de la barra */
(() => {
  const App = window.App, $ = App.$, S = App.S, sheet = $('sheet');
  let drag = null, lastId = null, lastT = 0;
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
    const add = e.ctrlKey || e.metaKey || e.shiftKey;
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
    drag = { it, d, mode: rz ? 'rz' : (S.crop ? 'pan' : 'mv'), collapse, wasManual: S.manual,
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
    else { it.w = Math.max(5, drag.ow + dx); it.h = Math.max(5, drag.oh + dy); }
    const skip = drag.mode === 'mv' ? new Set(drag.grp.map(g => g.o.id)) : null;
    showGuides(S.snap && !e.altKey ? snap(it, drag.mode, k, skip) : {});
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
  App.setCropZoom = z => App.crop(it => { it.z = Math.min(5, Math.max(1, z)); });
  sheet.addEventListener('wheel', e => {
    if (!S.crop || !S.sel || e.ctrlKey || !e.target.closest('.it')) return;
    e.preventDefault();
    const it = App.byId(S.sel); App.setCropZoom((it.z || 1) + (e.deltaY < 0 ? .1 : -.1));
    $('cz').value = Math.round(it.z * 100);
    if (S.showPages) App.renderPages();
  }, { passive: false });

  App.rotate = () => App.edit(it => { it.rot = (it.rot + 90) % 360; });
  App.toggleFit = () => {
    const p = App.byId(S.sel); if (!p) return;
    const t = p.fit === 'cover' ? 'contain' : 'cover';
    App.edit(it => { it.fit = t; }); App.refreshSel();
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

  addEventListener('keydown', e => {
    if (/INPUT|SELECT|TEXTAREA/.test(document.activeElement.tagName)) return;
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'a' && S.items.length) {
      e.preventDefault(); S.group = S.items.map(i => i.id); S.sel = S.items[S.items.length - 1].id; App.refreshSel(); return;
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
