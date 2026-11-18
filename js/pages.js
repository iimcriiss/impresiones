/* Páginas, zoom y vista de miniaturas */
(() => {
  const App = window.App, $ = App.$, S = App.S;
  S.pages = [{ items: S.items, manual: false }]; S.page = 0; S.showPages = false;
  let menu = null;                 // página (objeto) cuyo menú «···» está abierto
  let sel = new Set(), anchor = null;   // páginas seleccionadas (objetos, así sobreviven a mover/insertar/borrar)
  let inStrip = false, drag = null; // inStrip: el último clic fue en la tira de páginas (ahí Ctrl+C/V/Supr trabajan con páginas)
  const PRINT = '<svg viewBox="0 0 24 24"><path d="M7 9V4h10v5"/><rect x="4" y="9" width="16" height="8" rx="2"/><rect x="7" y="14" width="10" height="6"/></svg>';

  // S.items y S.manual siempre son los de la página actual
  const save = App.save = () => { const p = S.pages[S.page]; if (p) { p.items = S.items; p.manual = S.manual; } };
  const load = i => { S.page = i; const p = S.pages[i]; S.items = p.items; S.manual = p.manual; S.sel = null; menu = null; App.render(); };
  App.setPage = i => { save(); load(i); };
  const cur = () => S.pages[S.page];
  const picked = () => S.pages.filter(p => sel.has(p));                 // seleccionadas, en orden
  const targets = p => (p && !sel.has(p)) ? [p] : picked();             // el menú actúa sobre la selección si la página está en ella
  const plain = v => !!v && typeof v === 'object' && Object.getPrototypeOf(v) === Object.prototype;
  const cl = v => Array.isArray(v) ? v.map(cl) : plain(v) ? Object.keys(v).reduce((o, k) => (o[k] = cl(v[k]), o), {}) : v;   // copia profunda de lo simple (la <img> y los Blob se comparten)
  const copyPage = p => ({ items: p.items.map(it => ({ ...cl(it), id: 'i' + (++S.uid) })), manual: p.manual });

  App.addPage = () => { save(); const np = { items: [], manual: false }; S.pages.push(np); sel = new Set([np]); anchor = np; load(S.pages.length - 1); };
  // Inserta páginas nuevas después de la posición idx y se va a la primera
  const insertAt = (idx, list) => {
    save(); const c = cur(); S.pages.splice(idx + 1, 0, ...list); S.page = S.pages.indexOf(c);
    sel = new Set(list); anchor = list[0]; flip(() => App.setPage(S.pages.indexOf(list[0])));
  };
  const lastIdx = list => Math.max(...list.map(p => S.pages.indexOf(p)));
  App.dupPage = i => dupPages([S.pages[i]]);
  const dupPages = list => {
    if (!list.length) return;
    insertAt(lastIdx(list), list.map(copyPage));
    App.toast(list.length > 1 ? list.length + ' páginas duplicadas' : 'Página duplicada');
  };
  const removePages = (list, label) => {
    if (!list.length) return false;
    if (list.length >= S.pages.length) { App.toast('Debe quedar al menos una página.'); return false; }
    save(); const c = cur();
    const gone = list.map(p => ({ i: S.pages.indexOf(p), p })).sort((a, b) => a.i - b.i);
    S.pages = S.pages.filter(p => !list.includes(p));
    const go = list.includes(c) ? Math.min(gone[0].i, S.pages.length - 1) : S.pages.indexOf(c);
    sel = new Set([S.pages[go]]); anchor = S.pages[go]; flip(() => load(go));
    App.toast(label || (gone.length > 1 ? gone.length + ' páginas eliminadas' : 'Página eliminada'), 'Deshacer', () => App.undo ? App.undo() : 0);
    return true;
  };
  App.delPage = i => removePages([S.pages[i]]);
  const copyPages = list => {
    if (!list.length) return;
    save(); App.pageClip = list.map(p => ({ items: p.items.map(cl), manual: p.manual }));
    App.toast(list.length > 1 ? list.length + ' páginas copiadas · Ctrl + V para pegarlas' : 'Página copiada · Ctrl + V para pegarla');
  };
  const cutPages = list => {
    if (!list.length) return;
    if (list.length >= S.pages.length) { App.toast('Debe quedar al menos una página.'); return; }
    save(); App.pageClip = list.map(p => ({ items: p.items.map(cl), manual: p.manual }));
    removePages(list, list.length > 1 ? list.length + ' páginas cortadas' : 'Página cortada');
  };
  const pastePages = () => {
    const clip = App.pageClip; if (!clip || !clip.length) { App.toast('No hay páginas copiadas.'); return; }
    const at = sel.size ? lastIdx(picked()) : S.page;
    insertAt(at, clip.map(copyPage));
    App.toast(clip.length > 1 ? clip.length + ' páginas pegadas' : 'Página pegada');
  };
  // Animación al reordenar/insertar/borrar: las miniaturas deslizan de donde estaban a donde quedan; las nuevas «caen» en su lugar
  const EASE = 'cubic-bezier(.2,.8,.2,1)';
  const flip = fn => {
    const box = $('pages'), still = !S.showPages || matchMedia('(prefers-reduced-motion:reduce)').matches, prev = new Map();
    let addR = null;
    if (!still) { [...box.querySelectorAll('.pcard')].forEach((c, k) => { if (S.pages[k]) prev.set(S.pages[k], c.getBoundingClientRect()); }); const a = box.querySelector('.padd'); if (a) addR = a.getBoundingClientRect(); }
    const r = fn();
    if (still || !box.animate) return r;
    [...box.querySelectorAll('.pcard')].forEach((c, k) => {
      const o = prev.get(S.pages[k]), n = c.getBoundingClientRect();
      if (o && o.width > 2) { const dx = o.left - n.left; if (Math.abs(dx) > 1) c.animate([{ transform: 'translateX(' + dx + 'px)' }, { transform: 'none' }], { duration: 320, easing: EASE }); }
      else if (prev.size) c.animate([{ opacity: 0, transform: 'translateY(-14px) scale(.85)' }, { opacity: 1, transform: 'none' }], { duration: 320, easing: EASE });
    });
    const a = box.querySelector('.padd');
    if (a && addR) { const dx = addR.left - a.getBoundingClientRect().left; if (Math.abs(dx) > 1) a.animate([{ transform: 'translateX(' + dx + 'px)' }, { transform: 'none' }], { duration: 320, easing: EASE }); }
    return r;
  };
  // Reordena: «moved» queda en la posición r de la lista que queda al sacarlas
  const moveTo = (moved, r) => {
    const rest = S.pages.filter(p => !moved.includes(p));
    rest.splice(r, 0, ...moved);
    if (rest.every((p, i) => p === S.pages[i])) return false;
    save(); const c = cur(); S.pages = rest; S.page = rest.indexOf(c); App.render(); return true;
  };
  const moveBy = (list, dir) => {      // dir = -1 atrás (a la izquierda) · +1 adelante
    const set = new Set(list), arr = S.pages.slice(), n = arr.length;
    if (dir < 0) { for (let i = 1; i < n; i++) if (set.has(arr[i]) && !set.has(arr[i - 1])) [arr[i - 1], arr[i]] = [arr[i], arr[i - 1]]; }
    else { for (let i = n - 2; i >= 0; i--) if (set.has(arr[i]) && !set.has(arr[i + 1])) [arr[i + 1], arr[i]] = [arr[i], arr[i + 1]]; }
    if (arr.every((p, i) => p === S.pages[i])) return;
    flip(() => { save(); const c = cur(); S.pages = arr; S.page = arr.indexOf(c); App.render(); });
  };

  const el = (tag, cls, html) => { const e = document.createElement(tag); if (cls) e.className = cls; if (html) e.innerHTML = html; return e; };
  const resetDrag = box => {
    box.querySelectorAll('.pcard').forEach(c => { c.style.transform = ''; if (c.classList.contains('drag')) { c.classList.remove('drag'); setTimeout(() => { c.style.width = ''; }, 340); } });
    const ad = box.querySelector('.padd'); if (ad) ad.style.transform = '';
  };
  const ICON = {
    dup: '<svg viewBox="0 0 24 24"><rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2"/></svg>',
    del: '<svg viewBox="0 0 24 24"><path d="M4 7h16M10 11v6M14 11v6M6 7l1 12a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-12M9 7V4h6v3"/></svg>'
  };

  App.renderPages = () => {
    const box = $('pages'); save();
    sel = new Set([...sel].filter(p => S.pages.includes(p))); if (!sel.size) { sel = new Set([cur()]); anchor = cur(); }
    if (menu && !S.pages.includes(menu)) menu = null;
    document.querySelectorAll('body > .pmenu, body > .pbar').forEach(e => e.remove());
    $('pageNo').textContent = (S.page + 1) + ' de ' + S.pages.length;
    $('bPages').classList.toggle('on', S.showPages); $('bPages').setAttribute('aria-expanded', S.showPages);
    box.hidden = !S.showPages; if (!S.showPages) return;
    box.textContent = '';
    let menuBtn = null;
    let floatBar = null;
    const multi = sel.size > 1, showSel = !(sel.size === 1 && sel.has(cur()));
    if (multi) {
      const bar = el('div', 'pbar'), cnt = el('b', '', sel.size + ' páginas');
      const mk = (cls, ico, txt, fn) => { const b = el('button', cls, ico + '<span>' + txt + '</span>'); b.type = 'button'; b.onclick = fn; return b; };
      bar.append(cnt, mk('', ICON.dup, 'Duplicar', () => dupPages(picked())), mk('dng', ICON.del, 'Eliminar', () => removePages(picked())));
      floatBar = bar;      // flota sobre la tira (se coloca al final), así las miniaturas no se mueven
    }
    S.pages.forEach((p, i) => {
      const card = el('div', 'pcard'), th = el('div', 'thumb' + (i === S.page ? ' on' : '') + (showSel && sel.has(p) ? ' sel' : ''));
      th.style.aspectRatio = S.W + '/' + S.H; th.tabIndex = 0; th.setAttribute('aria-label', 'Página ' + (i + 1));
      th.onclick = e => {
        inStrip = true;
        if (e.ctrlKey || e.metaKey) { if (sel.has(p) && sel.size > 1) sel.delete(p); else sel.add(p); anchor = p; App.renderPages(); return; }
        if (e.shiftKey && anchor && S.pages.includes(anchor)) {
          const a = S.pages.indexOf(anchor), lo = Math.min(a, i), hi = Math.max(a, i);
          sel = new Set(S.pages.slice(lo, hi + 1)); App.renderPages(); return;
        }
        sel = new Set([p]); anchor = p; App.setPage(i);
      };
      th.onkeydown = e => { if (e.key === 'Enter') { sel = new Set([p]); anchor = p; App.setPage(i); } };
      p.items.forEach(it => { const d = App.mk(it); th.append(d); App.place(d, it); });
      const more = el('button', 'pmore', '···'); more.type = 'button'; more.setAttribute('aria-label', 'Opciones de la página ' + (i + 1));
      more.onclick = e => { e.stopPropagation(); inStrip = true; if (!sel.has(p)) { sel = new Set([p]); anchor = p; } menu = menu === p ? null : p; App.renderPages(); };
      card.append(th, more);
      card.append(el('div', 'plabel', PRINT + '<span>' + (i + 1) + '</span>'));
      // Arrastrar para mover (si la página está seleccionada se mueven todas las seleccionadas)
      card.draggable = true;
      card.ondragstart = e => {
        if (!sel.has(p)) { sel = new Set([p]); anchor = p; box.querySelectorAll('.thumb.sel').forEach(t => t.classList.remove('sel')); }
        const set = picked(), r0 = card.getBoundingClientRect(), gap = parseFloat(getComputedStyle(box).columnGap) || 16;
        drag = { set, M: set.length * (r0.width + gap), slots: null, cards: null, scroll0: 0, t0: performance.now(), r: -1 };
        e.dataTransfer.effectAllowed = 'move'; e.dataTransfer.setData('text/plain', 'paginas');
        // la página «se alza»: la imagen que se arrastra va inclinada, más grande y con sombra
        const wrap = el('div', 'lift-wrap'), g = card.cloneNode(true); g.style.width = r0.width + 'px'; g.classList.remove('drag'); wrap.append(g);
        if (set.length > 1) wrap.append(el('span', 'lift-n', String(set.length)));
        document.body.append(wrap); e.dataTransfer.setDragImage(wrap, wrap.offsetWidth / 2, wrap.offsetHeight / 2); setTimeout(() => wrap.remove(), 0);
        // la original se pliega (las demás se juntan) y se abre el espacio donde se vaya a soltar
        setTimeout(() => {
          if (!drag) return;
          [...box.querySelectorAll('.pcard')].forEach((c, k) => { if (set.includes(S.pages[k])) { c.style.width = c.getBoundingClientRect().width + 'px'; void c.offsetWidth; c.classList.add('drag'); } });
        }, 0);
      };
      card.ondragend = () => { if (drag) { drag = null; resetDrag(box); } };
      box.append(card);
      if (menu === p) menuBtn = more;
    });
    const add = el('button', 'padd', '<svg viewBox="0 0 24 24"><path d="M12 5v14M5 12h14"/></svg>');
    add.type = 'button'; add.style.aspectRatio = S.W + '/' + S.H; add.setAttribute('aria-label', 'Agregar página');
    add.onclick = App.addPage;
    box.append(add);
    box.ondragover = e => {
      if (!drag) return; e.preventDefault(); e.dataTransfer.dropEffect = 'move';
      if (!drag.slots) {        // se mide una vez, cuando las originales ya se plegaron (así el espacio no «baila» al moverse)
        if (performance.now() - drag.t0 < 340) return;
        drag.cards = [...box.querySelectorAll('.pcard')].filter((c, k) => !drag.set.includes(S.pages[k]));
        drag.slots = drag.cards.map(c => { const r = c.getBoundingClientRect(); return r.left + r.width / 2; }); drag.scroll0 = box.scrollLeft;
      }
      const x = e.clientX + (box.scrollLeft - drag.scroll0); let r = 0; drag.slots.forEach(c => { if (x > c) r++; });
      if (r === drag.r) return; drag.r = r;
      drag.cards.forEach((c, k) => { c.style.transform = k >= r ? 'translateX(' + drag.M + 'px)' : ''; });
      const ad = box.querySelector('.padd'); if (ad) ad.style.transform = 'translateX(' + drag.M + 'px)';
    };
    box.ondrop = e => {
      if (!drag) return; e.preventDefault(); e.stopPropagation();
      const d = drag; drag = null;
      if (d.r < 0) { resetDrag(box); return; }
      const moved = flip(() => moveTo(d.set, d.r));
      if (moved) App.toast(d.set.length > 1 ? d.set.length + ' páginas movidas' : 'Página movida'); else resetDrag(box);
    };
    if (floatBar) {
      // primero se fija (así mide su tamaño real) y luego se coloca pegada a la tira, centrada
      floatBar.classList.add('float'); Object.assign(floatBar.style, { position: 'fixed', left: '0px', top: '0px', right: 'auto', bottom: 'auto', width: 'max-content', visibility: 'hidden', zIndex: 55 });
      document.body.append(floatBar);
      const pr = box.getBoundingClientRect(), w = floatBar.getBoundingClientRect().width, h = floatBar.getBoundingClientRect().height;
      Object.assign(floatBar.style, { visibility: '',
        left: Math.max(8, Math.min(pr.left + pr.width / 2 - w / 2, innerWidth - w - 8)) + 'px', top: Math.max(8, pr.top - h - 6) + 'px' });
    }
    if (menuBtn) {
      // El menú va en <body> con posición fija: así la tira de páginas no lo recorta
      const list = picked(), many = list.length > 1, m = el('div', 'pmenu');
      const item = (txt, fn, cls, off) => { const b = el('button', cls || '', txt); b.type = 'button'; if (off) b.disabled = true; else b.onclick = () => { menu = null; fn(); }; m.append(b); };
      item(many ? 'Duplicar ' + list.length + ' páginas' : 'Duplicar página', () => dupPages(list));
      item(many ? 'Copiar ' + list.length + ' páginas' : 'Copiar página', () => { copyPages(list); App.renderPages(); });
      item(many ? 'Cortar ' + list.length + ' páginas' : 'Cortar página', () => cutPages(list), '', list.length >= S.pages.length);
      item('Pegar', pastePages, '', !(App.pageClip && App.pageClip.length));
      item('Mover atrás', () => moveBy(list, -1), '', S.pages.indexOf(list[0]) === 0 && list.every((p, k) => S.pages.indexOf(p) === k));
      item('Mover adelante', () => moveBy(list, 1), '', list.every((p, k) => S.pages.indexOf(p) === S.pages.length - list.length + k));
      item(many ? 'Eliminar ' + list.length + ' páginas' : 'Eliminar página', () => removePages(list), 'dng');
      m.style.visibility = 'hidden'; document.body.append(m);
      // Centrado sobre su botón «···» y justo encima de la tira de páginas (no tapa las miniaturas ni la barra)
      Object.assign(m.style, { position: 'fixed', left: '0px', top: '0px', right: 'auto' });   // se mide ya con su posición final
      const r = menuBtn.getBoundingClientRect(), pr = box.getBoundingClientRect(), w = m.offsetWidth, h = m.offsetHeight;
      let top = pr.top - h - 8; if (top < 8) top = Math.min(r.bottom + 6, innerHeight - h - 8);
      Object.assign(m.style, { position: 'fixed', right: 'auto', zIndex: 60, visibility: '',
        left: Math.max(8, Math.min(r.left + r.width / 2 - w / 2, innerWidth - w - 8)) + 'px', top: top + 'px' });
    }
  };

  // Teclado en la tira de páginas (solo si el último clic fue ahí): Ctrl+C / X / V / D / A, Supr, flechas y Alt + flechas para mover
  addEventListener('pointerdown', e => { inStrip = !!(e.target.closest && e.target.closest('#pages,.pmenu,.pbar')); }, true);
  addEventListener('keydown', e => {
    if (!inStrip || !S.showPages) return;
    const a = document.activeElement; if (a && /INPUT|TEXTAREA|SELECT/.test(a.tagName) && a.type !== 'range') return;
    if (document.querySelector('[role="dialog"]:not([hidden])')) return;
    const k = e.key.toLowerCase(), mod = e.ctrlKey || e.metaKey, list = picked(), stop = () => { e.preventDefault(); e.stopImmediatePropagation(); };
    if (mod && !e.altKey && k === 'c') { stop(); copyPages(list); }
    else if (mod && !e.altKey && k === 'x') { stop(); cutPages(list); }
    else if (mod && !e.altKey && k === 'v') { stop(); pastePages(); }
    else if (mod && !e.altKey && k === 'd') { stop(); dupPages(list); }
    else if (mod && !e.altKey && k === 'a') { stop(); sel = new Set(S.pages); App.renderPages(); }
    else if (!mod && (k === 'delete' || k === 'backspace')) { stop(); removePages(list); }
    else if (!mod && k === 'escape') { sel = new Set([cur()]); anchor = cur(); inStrip = false; App.renderPages(); }
    else if (e.altKey && !mod && (k === 'arrowleft' || k === 'arrowright')) { stop(); moveBy(list, k === 'arrowleft' ? -1 : 1); }
    else if (!mod && !e.altKey && (k === 'arrowleft' || k === 'arrowright')) {
      const j = S.page + (k === 'arrowleft' ? -1 : 1); if (j < 0 || j >= S.pages.length) return;
      stop(); sel = new Set([S.pages[j]]); anchor = S.pages[j]; App.setPage(j);
    }
  }, true);

  const setZoom = z => { S.zoom = Math.min(500, Math.max(25, z)); $('zoom').value = S.zoom; $('zoomVal').textContent = S.zoom + '%'; App.fit(); };
  $('zoom').oninput = e => setZoom(+e.target.value);
  $('zoomVal').onclick = () => setZoom(100);
  $('canvas').addEventListener('wheel', e => { if (!e.ctrlKey) return; e.preventDefault(); setZoom(S.zoom + (e.deltaY < 0 ? 10 : -10)); }, { passive: false });
  // Al cerrar "Páginas" la hoja vuelve sola al 100% (ya con el espacio completo)
  $('bPages').onclick = () => { const was = S.showPages; S.showPages = !S.showPages; App.render(); if (was) setZoom(100); };
  $('pPrev').onclick = () => { if (S.page > 0) App.setPage(S.page - 1); };
  $('pNext').onclick = () => { if (S.page < S.pages.length - 1) App.setPage(S.page + 1); };
  document.addEventListener('click', e => { if (menu && !e.target.closest('.pmore,.pmenu')) { menu = null; App.renderPages(); } });
})();
