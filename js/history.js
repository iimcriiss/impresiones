/* Historial: deshacer y rehacer (Ctrl+Z, Ctrl+Y / Ctrl+Shift+Z y los botones junto a «1 de 1»).
   Guarda «fotos» del estado (páginas, imágenes y ajustes de la hoja). Cada vez que termina una acción (soltar el mouse,
   soltar una tecla, un clic, un cambio) compara el estado con la última foto y, si es distinto, guarda un paso.
   Al deshacer o rehacer te lleva a la página donde ocurrió el cambio y elige las imágenes que cambiaron.
   Cambiar de página, hacer zoom, la regla y los objetos de referencia (Medidas) NO cuentan como pasos. */
(() => {
  const App = window.App, S = App.S, $ = App.$;
  const MAX = 100, CFG = ['paper', 'orient', 'margin', 'gap', 'cols', 'rows', 'fit', 'snap', 'pm', 'pg', 'marks'];
  const undo = [], redo = [];
  let cur = null, curSig = '', tNow = 0, tSlow = 0, down = false, busy = false;

  // Copia de objetos simples (las imágenes, Blob y nodos del DOM se comparten, no se copian)
  const cl = v => {
    if (!v || typeof v !== 'object') return v;
    if (Array.isArray(v)) return v.map(cl);
    if (Object.getPrototypeOf(v) !== Object.prototype) return v;
    const o = {}; for (const k in v) o[k] = cl(v[k]); return o;
  };
  // Firma de una imagen: todo menos el objeto <img> (de src solo cuenta el largo y el final)
  const itSig = it => { try { return JSON.stringify(it, (k, v) => k === 'img' ? undefined : (k === 'src' && typeof v === 'string' ? v.length + v.slice(-24) : v)); } catch (e) { return String(Math.random()); } };
  const pgSig = p => p.manual + '|' + p.items.map(itSig).join(',');
  const snapshot = () => {
    if (App.save) App.save();
    const cfg = {}; CFG.forEach(k => { cfg[k] = S[k]; });
    // Las páginas conservan todo lo suyo (p. ej. sus referencias de Medidas, que se comparten y no se deshacen)
    const pages = S.pages.map(p => ({ ...p, manual: !!p.manual, items: p.items.map(cl) }));
    return { cfg, pages, sigs: pages.map(pgSig) };
  };
  const sigOf = s => JSON.stringify([s.cfg, s.sigs]);

  /* ---- Botones junto a «1 de 1» ---- */
  const ic = d => '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">' + d + '</svg>';
  const box = document.createElement('span'); box.className = 'pnav hist';
  box.innerHTML = '<button id="bUndo" type="button" aria-label="Deshacer" title="Deshacer (Ctrl+Z)" disabled>' + ic('<path d="M9 14 4 9l5-5"/><path d="M4 9h10.5a5.5 5.5 0 0 1 0 11H11"/>') + '</button>' +
                  '<button id="bRedo" type="button" aria-label="Rehacer" title="Rehacer (Ctrl+Y)" disabled>' + ic('<path d="m15 14 5-5-5-5"/><path d="M20 9H9.5a5.5 5.5 0 0 0 0 11H13"/>') + '</button>';
  const nav = document.querySelector('.pnav'); if (nav) nav.after(box); else document.querySelector('.bar').append(box);
  const bU = $('bUndo'), bR = $('bRedo');
  const sync = () => { bU.disabled = !undo.length; bR.disabled = !redo.length; };

  /* ---- Guardar pasos ---- */
  const commit = () => {
    clearTimeout(tNow); clearTimeout(tSlow); tNow = tSlow = 0;
    if (busy || down) return;
    const s = snapshot(), sg = sigOf(s);
    if (sg === curSig) return;
    undo.push(cur); if (undo.length > MAX) undo.shift();
    redo.length = 0; cur = s; curSig = sg; sync();
  };
  const now = () => { if (!busy && !tNow) tNow = setTimeout(commit, 0); };                      // al terminar una acción
  const slow = () => { if (busy) return; clearTimeout(tSlow); tSlow = setTimeout(commit, 450); };  // cambios seguidos (escribir, deslizar, cargar imágenes) = un solo paso

  /* ---- Volver a una foto ---- */
  const restore = (snap, from) => {
    // ¿Dónde cambió? Se va a la primera página distinta y se eligen las imágenes que cambiaron
    let pg = -1;
    for (let i = 0; i < Math.max(snap.sigs.length, from.sigs.length); i++) if (snap.sigs[i] !== from.sigs[i]) { pg = i; break; }
    busy = true;
    CFG.forEach(k => { S[k] = snap.cfg[k]; });
    S.pages = snap.pages.map(p => ({ ...p, items: p.items.map(cl) }));
    S.page = Math.max(0, Math.min(pg < 0 ? S.page : pg, S.pages.length - 1));
    S.items = S.pages[S.page].items; S.manual = S.pages[S.page].manual;
    const old = new Map(); (from.pages[S.page] ? from.pages[S.page].items : []).forEach(it => old.set(it.id, itSig(it)));
    const ch = S.items.filter(it => old.get(it.id) !== itSig(it)).map(it => it.id);
    S.group = ch; S.sel = ch.length ? ch[ch.length - 1] : null; S.crop = false;
    App.dims(); App.render();
    busy = false;
    cur = snapshot(); curSig = sigOf(cur); sync();
  };
  const go = (from, to, msg) => {
    if (down) return false;
    commit();
    if (!from.length) { App.toast(msg); return false; }
    to.push(cur); restore(from.pop(), cur); return true;
  };
  App.undo = () => go(undo, redo, 'No hay nada más que deshacer');
  App.redo = () => go(redo, undo, 'No hay nada que rehacer');
  // (go() pone en la pila contraria la foto de «ahora» y vuelve a la otra)
  bU.onclick = () => App.undo();
  bR.onclick = () => App.redo();

  /* ---- Atajos ---- */
  addEventListener('keydown', e => {
    if (!(e.ctrlKey || e.metaKey) || e.altKey) return;
    const k = e.key.toLowerCase(); if (k !== 'z' && k !== 'y') return;
    const a = document.activeElement;      // en campos de texto se deja el deshacer del propio campo
    if (a && (a.tagName === 'TEXTAREA' || a.tagName === 'SELECT' || a.isContentEditable || (a.tagName === 'INPUT' && !/^(range|checkbox|radio|button)$/.test(a.type)))) return;
    if (document.querySelector('[role="dialog"]:not([hidden])')) return;      // con una ventana abierta (recortar, carnet) no se toca la hoja
    e.preventDefault();
    if (k === 'y' || e.shiftKey) App.redo(); else App.undo();
  }, true);

  /* ---- Cuándo revisar si algo cambió ---- */
  addEventListener('pointerdown', () => { down = true; }, true);
  ['pointerup', 'pointercancel'].forEach(t => addEventListener(t, () => { down = false; now(); }, true));
  document.addEventListener('click', now, true);
  document.addEventListener('change', now, true);
  document.addEventListener('input', slow, true);
  document.addEventListener('keyup', e => { const a = e.target; (a && a.tagName === 'INPUT' && !/^(range|checkbox|radio|button)$/.test(a.type)) ? slow() : now(); }, true);
  const render0 = App.render; App.render = (...a) => { const r = render0.apply(App, a); slow(); return r; };

  cur = snapshot(); curSig = sigOf(cur); sync();
})();
