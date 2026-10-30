/* Panel «Posición»: orden, alinear, medidas avanzadas y lista de capas */
(() => {
  const App = window.App, $ = App.$, S = App.S, sheet = $('sheet');
  S.ptab = 'org'; S.lock = false;
  const q = s => document.querySelectorAll(s);
  const el = id => sheet.querySelector(`.it[data-id="${id}"]`);
  const fmt = v => Math.round(v * 10) / 10;
  // De abajo hacia arriba (igual que App.layer)
  const sorted = items => items.map((it, i) => ({ it, i })).sort((a, b) => ((a.it.l || 0) - (b.it.l || 0)) || a.i - b.i).map(x => x.it);

  /* ---- Medidas avanzadas: comenzar X/Y, finalizar X/Y ---- */
  const F = { fx: it => it.x, fy: it => it.y, fex: it => it.x + it.w, fey: it => it.y + it.h };
  App.syncFields = () => {
    const it = App.byId(S.sel); if (!it) return;
    Object.keys(F).forEach(id => { const inp = $(id); if (document.activeElement !== inp) inp.value = fmt(F[id](it)); });
    $('rotVal').textContent = ((it.rot || 0) % 360) + '°';
  };
  const setF = (id, v) => {
    const it = App.byId(S.sel); if (!it || isNaN(v)) return;
    const r = it.h / it.w;
    if (id === 'fx') it.x = v;
    else if (id === 'fy') it.y = v;
    else if (id === 'fex') { it.w = Math.max(5, v - it.x); if (S.lock) it.h = Math.max(5, it.w * r); }
    else { it.h = Math.max(5, v - it.y); if (S.lock) it.w = Math.max(5, it.h / r); }
    S.manual = true;
    const d = el(it.id); if (d) App.place(d, it);
    if (S.showPages) App.renderPages();
    App.syncFields();
  };
  Object.keys(F).forEach(id => $(id).addEventListener('input', e => setF(id, parseFloat(String(e.target.value).replace(',', '.')))));
  $('bLock').onclick = () => { S.lock = !S.lock; updatePos(); };
  $('bRot2').onclick = () => App.rotate();

  /* ---- Alinear dentro de los márgenes de la hoja ---- */
  App.align = mode => {
    const its = App.sels().map(App.byId); if (!its.length) return;
    const x0 = Math.min(...its.map(i => i.x)), x1 = Math.max(...its.map(i => i.x + i.w));
    const y0 = Math.min(...its.map(i => i.y)), y1 = Math.max(...its.map(i => i.y + i.h));
    const m = S.margin; let dx = 0, dy = 0;
    if (mode === 'left') dx = m - x0;
    else if (mode === 'right') dx = S.W - m - x1;
    else if (mode === 'center') dx = S.W / 2 - (x0 + x1) / 2;
    else if (mode === 'top') dy = m - y0;
    else if (mode === 'bottom') dy = S.H - m - y1;
    else dy = S.H / 2 - (y0 + y1) / 2;
    App.edit(it => { it.x += dx; it.y += dy; });
    if (S.showPages) App.renderPages();
  };
  q('[data-al]').forEach(b => b.onclick = () => App.align(b.dataset.al));

  /* ---- Lista de capas ---- */
  const list = $('layers');
  let dragId = null;
  const pick = (it, pi, add) => {
    if (pi !== S.page) { App.setPage(pi); add = false; }
    S.crop = false;
    if (add) {
      const g = App.sels();
      if (g.includes(it.id)) { const n = g.filter(x => x !== it.id); S.group = n; S.sel = n[n.length - 1] || null; }
      else { S.group = [...g, it.id]; S.sel = it.id; }
    } else { S.sel = it.id; S.group = [it.id]; }
    App.refreshSel();
  };
  const moveLayer = (id, targetId, after) => {
    if (id === targetId) return;
    const arr = sorted(S.items).reverse();                       // arriba primero
    const from = arr.findIndex(x => x.id === id); if (from < 0) return;
    const [m] = arr.splice(from, 1);
    const to = arr.findIndex(x => x.id === targetId); if (to < 0) return;
    arr.splice(after ? to + 1 : to, 0, m);
    arr.forEach((it, i) => { it.l = arr.length - i; const d = el(it.id); if (d) d.style.zIndex = it.l; });
    if (S.showPages) App.renderPages();
    App.renderLayers(); updatePos();
  };
  const GRIP = '<svg viewBox="0 0 10 16" aria-hidden="true"><g><circle cx="2.5" cy="3" r="1.4"/><circle cx="7.5" cy="3" r="1.4"/><circle cx="2.5" cy="8" r="1.4"/><circle cx="7.5" cy="8" r="1.4"/><circle cx="2.5" cy="13" r="1.4"/><circle cx="7.5" cy="13" r="1.4"/></g></svg>';
  const row = (it, pi, n, canDrag) => {
    const r = document.createElement('div'), ids = App.sels();
    r.className = 'lyr' + (pi === S.page && ids.includes(it.id) ? ' sel' : '');
    r.dataset.id = it.id; r.dataset.page = pi; r.tabIndex = 0; r.draggable = canDrag;
    r.innerHTML = '<span class="grip">' + GRIP + '</span><span class="lth"><img alt=""></span><span class="ltx"><b></b><small></small></span>';
    r.querySelector('img').src = it.src;
    r.querySelector('b').textContent = 'Imagen ' + n;
    const sm = r.querySelector('small'); if (it.name) sm.textContent = it.name; else sm.remove();
    r.onclick = e => pick(it, pi, e.ctrlKey || e.metaKey || e.shiftKey);
    r.onkeydown = e => { if (e.key === 'Enter') pick(it, pi, false); };
    if (canDrag) {
      r.addEventListener('dragstart', e => { dragId = it.id; r.classList.add('dragging'); e.dataTransfer.effectAllowed = 'move'; e.dataTransfer.setData('text/plain', it.id); });
      r.addEventListener('dragend', () => { dragId = null; list.querySelectorAll('.lyr').forEach(x => x.classList.remove('dragging', 'over-t', 'over-b')); });
      r.addEventListener('dragover', e => {
        if (!dragId || dragId === it.id) return; e.preventDefault();
        const b = r.getBoundingClientRect(), after = e.clientY > b.top + b.height / 2;
        r.classList.toggle('over-t', !after); r.classList.toggle('over-b', after);
      });
      r.addEventListener('dragleave', () => r.classList.remove('over-t', 'over-b'));
      r.addEventListener('drop', e => {
        e.preventDefault(); const b = r.getBoundingClientRect();
        const id = dragId; dragId = null; moveLayer(id, it.id, e.clientY > b.top + b.height / 2);
      });
    }
    return r;
  };
  App.renderLayers = () => {
    if (!list || S.ptab !== 'capas') return;
    list.textContent = '';
    const msg = t => { const p = document.createElement('p'); p.className = 'note'; p.textContent = t; list.append(p); };
    const pages = S.pages || [{ items: S.items }];
    if (!pages.some(p => p.items.length)) { msg('Aún no hay imágenes.'); return; }
    pages.forEach((p, pi) => {
      if (!p.items.length) return;
      if (pages.length > 1) { const h = document.createElement('div'); h.className = 'lgrp'; h.textContent = 'Página ' + (pi + 1) + (pi === S.page ? ' · actual' : ''); list.append(h); }
      sorted(p.items).reverse().forEach(it => list.append(row(it, pi, p.items.indexOf(it) + 1, pi === S.page)));
    });
  };

  /* ---- Estado de los controles ---- */
  const orderState = () => {
    const ids = App.sels(); if (!ids.length) return { up: false, down: false };
    const o = sorted(S.items), k = ids.length, sel = new Set(ids);
    return { up: !o.slice(-k).every(i => sel.has(i.id)), down: !o.slice(0, k).every(i => sel.has(i.id)) };
  };
  function updatePos() {
    const has = !!App.byId(S.sel), os = orderState();
    q('[data-need]').forEach(c => c.querySelectorAll('button,input').forEach(b => { b.disabled = !has; }));
    $('bUp').disabled = $('bTop').disabled = !has || !os.up;
    $('bDown').disabled = $('bBottom').disabled = !has || !os.down;
    q('[data-ptab]').forEach(b => { const on = b.dataset.ptab === S.ptab; b.classList.toggle('on', on); b.setAttribute('aria-pressed', on); });
    q('[data-ppane]').forEach(p => { p.hidden = p.dataset.ppane !== S.ptab; });
    $('bLock').classList.toggle('on', S.lock); $('bLock').setAttribute('aria-pressed', S.lock);
    $('bLock').title = S.lock ? 'Proporción bloqueada' : 'Mantener la proporción al cambiar el tamaño';
    if (!has) { ['fx', 'fy', 'fex', 'fey'].forEach(id => { $(id).value = ''; }); $('rotVal').textContent = '--'; }
    if (S.ptab === 'capas') {
      const ids = App.sels(); list.querySelectorAll('.lyr').forEach(r => r.classList.toggle('sel', +r.dataset.page === S.page && ids.includes(r.dataset.id)));
    }
  }
  q('[data-ptab]').forEach(b => b.onclick = () => { S.ptab = b.dataset.ptab; updatePos(); App.renderLayers(); });

  // Se engancha a lo que ya existe
  const rs = App.refreshSel; App.refreshSel = () => { rs(); updatePos(); };
  const rr = App.render;     App.render = () => { rr(); App.renderLayers(); updatePos(); };
  const ol = App.layer;      App.layer = m => { ol(m); App.renderLayers(); updatePos(); };
})();
