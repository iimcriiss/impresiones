/* Páginas, zoom y vista de miniaturas */
(() => {
  const App = window.App, $ = App.$, S = App.S;
  S.pages = [{ items: S.items, manual: false }]; S.page = 0; S.showPages = false;
  let menu = -1;
  const PRINT = '<svg viewBox="0 0 24 24"><path d="M7 9V4h10v5"/><rect x="4" y="9" width="16" height="8" rx="2"/><rect x="7" y="14" width="10" height="6"/></svg>';

  // S.items y S.manual siempre son los de la página actual
  const save = App.save = () => { const p = S.pages[S.page]; p.items = S.items; p.manual = S.manual; };
  const load = i => { S.page = i; const p = S.pages[i]; S.items = p.items; S.manual = p.manual; S.sel = null; menu = -1; App.render(); };
  App.setPage = i => { save(); load(i); };
  App.addPage = () => { save(); S.pages.push({ items: [], manual: false }); load(S.pages.length - 1); };
  App.dupPage = i => {
    save(); const src = S.pages[i];
    S.pages.splice(i + 1, 0, { items: src.items.map(it => ({ ...it, id: 'i' + (++S.uid) })), manual: src.manual });
    load(i + 1);
  };
  App.delPage = i => {
    if (S.pages.length < 2) { App.toast('Debe quedar al menos una página.'); return; }
    save(); const [gone] = S.pages.splice(i, 1); load(Math.min(i, S.pages.length - 1));
    App.toast('Página eliminada', 'Deshacer', () => { save(); S.pages.splice(i, 0, gone); load(i); });
  };

  const el = (tag, cls, html) => { const e = document.createElement(tag); if (cls) e.className = cls; if (html) e.innerHTML = html; return e; };
  App.renderPages = () => {
    const box = $('pages'); save();
    $('pageNo').textContent = (S.page + 1) + ' de ' + S.pages.length;
    $('bPages').classList.toggle('on', S.showPages); $('bPages').setAttribute('aria-expanded', S.showPages);
    box.hidden = !S.showPages; if (!S.showPages) return;
    box.textContent = '';
    S.pages.forEach((p, i) => {
      const card = el('div', 'pcard'), th = el('div', 'thumb' + (i === S.page ? ' on' : ''));
      th.style.aspectRatio = S.W + '/' + S.H; th.tabIndex = 0; th.setAttribute('aria-label', 'Página ' + (i + 1));
      th.onclick = () => App.setPage(i);
      th.onkeydown = e => { if (e.key === 'Enter') App.setPage(i); };
      p.items.forEach(it => { const d = App.mk(it); th.append(d); App.place(d, it); });
      const more = el('button', 'pmore', '···'); more.type = 'button'; more.setAttribute('aria-label', 'Opciones de la página ' + (i + 1));
      more.onclick = e => { e.stopPropagation(); menu = menu === i ? -1 : i; App.renderPages(); };
      card.append(th, more);
      if (menu === i) {
        const m = el('div', 'pmenu'), a = el('button', '', 'Duplicar página'), b = el('button', '', 'Eliminar página');
        a.onclick = () => App.dupPage(i); b.onclick = () => App.delPage(i); m.append(a, b); card.append(m);
      }
      card.append(el('div', 'plabel', PRINT + '<span>' + (i + 1) + '</span>'));
      box.append(card);
    });
    const add = el('button', 'padd', '<svg viewBox="0 0 24 24"><path d="M12 5v14M5 12h14"/></svg>');
    add.type = 'button'; add.style.aspectRatio = S.W + '/' + S.H; add.setAttribute('aria-label', 'Agregar página');
    add.onclick = App.addPage; box.append(add);
  };

  const setZoom = z => { S.zoom = Math.min(300, Math.max(25, z)); $('zoom').value = S.zoom; $('zoomVal').textContent = S.zoom + '%'; App.fit(); };
  $('zoom').oninput = e => setZoom(+e.target.value);
  $('zoomVal').onclick = () => setZoom(100);
  $('canvas').addEventListener('wheel', e => { if (!e.ctrlKey) return; e.preventDefault(); setZoom(S.zoom + (e.deltaY < 0 ? 10 : -10)); }, { passive: false });
  // Al cerrar "Páginas" la hoja vuelve sola al 100% (ya con el espacio completo)
  $('bPages').onclick = () => { const was = S.showPages; S.showPages = !S.showPages; App.render(); if (was) setZoom(100); };
  $('pPrev').onclick = () => { if (S.page > 0) App.setPage(S.page - 1); };
  $('pNext').onclick = () => { if (S.page < S.pages.length - 1) App.setPage(S.page + 1); };
  document.addEventListener('click', e => { if (menu >= 0 && !e.target.closest('.pmore,.pmenu')) { menu = -1; App.renderPages(); } });
})();
