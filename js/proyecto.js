/* Guardar y abrir proyecto (.hoja)
   Guarda toda la hoja en un archivo que se descarga al equipo: páginas, imágenes (con sus recortes y filtros), posiciones,
   tamaños, giros, márgenes, bordes y marcas. Abrirlo la deja como estaba. No se sube nada a ningún servidor.
   Atajos: Ctrl+S guardar, Ctrl+O abrir. Se carga después de marks-ui.js y antes de main.js. */
(() => {
  const App = window.App, S = App.S, $ = App.$;
  const FORMAT = 'hoja-impresion', VERSION = 1;
  const BIG = 2.5 * 1024 * 1024, MAXSIDE = 4961;            // fotos de más de 2,5 MB se reducen a 4961 px (A3 a 300 ppp; en A4 son ~420 ppp)
  const MAX_FILE = 600 * 1024 * 1024, MAX_PIXELS = 150e6;
  const CFG = ['paper', 'orient', 'margin', 'gap', 'cols', 'rows', 'fit', 'snap', 'marks', 'pm', 'pg'];
  const SKIP = new Set(['img', 'o', '_t', 'src']);
  let busy = false;

  const readURL = b => new Promise((ok, no) => { const r = new FileReader(); r.onload = () => ok(r.result); r.onerror = no; r.readAsDataURL(b); });
  const loadImg = url => new Promise((ok, no) => { const i = new Image(); i.onload = () => ok(i); i.onerror = no; i.src = url; });

  // data: -> Blob sin fetch (la política de seguridad del sitio solo deja fetch a «self», y fetch(data:) quedaría bloqueado)
  const dataToBlob = u => {
    const m = /^data:([^;,]*)((?:;[^;,]*)*?),([\s\S]*)$/i.exec(u); if (!m) throw new Error('data');
    const b64 = /;base64/i.test(m[2]), raw = b64 ? atob(m[3].replace(/\s/g, '')) : decodeURIComponent(m[3]);
    const a = new Uint8Array(raw.length); for (let i = 0; i < raw.length; i++) a[i] = raw.charCodeAt(i);
    return new Blob([a], { type: m[1] || 'application/octet-stream' });
  };
  // Imagen de la hoja (blob: o data:) -> Blob. Si fetch no puede leer el blob, se redibuja la imagen en un canvas (sale como PNG)
  const srcBlob = async src => {
    if (/^data:/i.test(src)) return dataToBlob(src);
    try { return await (await fetch(src)).blob(); }
    catch (e) {
      const im = await loadImg(src), c = document.createElement('canvas'); c.width = im.naturalWidth; c.height = im.naturalHeight;
      c.getContext('2d').drawImage(im, 0, 0);
      const out = await new Promise(ok => c.toBlob(ok, 'image/png')); if (!out) throw e; return out;
    }
  };

  // Foto grande -> JPEG más liviano (sin transparencia); el resto se guarda tal cual
  const shrink = async (b, hq) => {
    if (hq || b.size <= BIG) return b;
    const u = URL.createObjectURL(b);
    try {
      const im = await loadImg(u), k = Math.min(1, MAXSIDE / Math.max(im.naturalWidth, im.naturalHeight));
      const c = document.createElement('canvas'); c.width = Math.max(1, Math.round(im.naturalWidth * k)); c.height = Math.max(1, Math.round(im.naturalHeight * k));
      const x = c.getContext('2d'); x.imageSmoothingQuality = 'high'; x.fillStyle = '#fff'; x.fillRect(0, 0, c.width, c.height); x.drawImage(im, 0, 0, c.width, c.height);
      const out = await new Promise(ok => c.toBlob(ok, 'image/jpeg', .95));
      return out && out.size < b.size ? out : b;
    } catch (e) { return b; } finally { URL.revokeObjectURL(u); }
  };

  const plain = o => { try { return JSON.parse(JSON.stringify(o)); } catch (e) { return undefined; } };

  async function save(hq) {
    if (busy) return; if (App.save) App.save();
    if (!S.pages.some(p => p.items.length)) { App.toast('La hoja está vacía: agrega imágenes antes de guardar.'); return; }
    busy = true; const wait = App.toast('Guardando proyecto…');
    try {
      const imgs = {}, keys = new Map();
      const keyOf = async src => {
        if (!src) return null;
        if (keys.has(src)) return keys.get(src);
        const k = 'm' + keys.size; keys.set(src, k);
        const b = await shrink(await srcBlob(src), hq);
        imgs[k] = await readURL(b); return k;
      };
      const pages = [];
      for (const p of S.pages) {
        const extra = {}; for (const k in p) if (k !== 'items') extra[k] = p[k];
        const items = [];
        for (const it of p.items) {
          const d = {}; for (const k in it) if (!SKIP.has(k)) d[k] = it[k];
          const c = plain(d); if (!c) continue;
          c.s = await keyOf(it.src);
          if (it.o && it.o.src && it.o.src !== it.src) c.os = await keyOf(it.o.src); else if (it.o) c.os = c.s;
          items.push(c);
        }
        pages.push({ x: plain(extra) || {}, manual: !!p.manual, items });
      }
      const cfg = {}; CFG.forEach(k => { if (S[k] !== undefined) cfg[k] = S[k]; });
      const data = { app: FORMAT, v: VERSION, saved: new Date().toISOString(), cfg, page: S.page, uid: S.uid, pages, imgs };
      const blob = new Blob([JSON.stringify(data)], { type: 'application/octet-stream' });
      const d = new Date(), pad = n => String(n).padStart(2, '0');
      const name = 'hoja-' + d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()) + '-' + pad(d.getHours()) + pad(d.getMinutes()) + (hq ? '-original' : '') + '.hoja';
      const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name; document.body.append(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(a.href), 10000);
      wait.remove(); App.toast(name + ' descargado (' + (blob.size / 1048576 < 10 ? (blob.size / 1048576).toFixed(1) : Math.round(blob.size / 1048576)) + ' MB)');
    } catch (e) { wait.remove(); App.toast('No se pudo guardar el proyecto.'); }
    busy = false;
  }

  const num = v => typeof v === 'number' && isFinite(v);

  async function open(file) {
    if (busy || !file) return;
    if (file.size > MAX_FILE) { App.toast('Ese archivo es demasiado grande.'); return; }
    busy = true; const wait = App.toast('Abriendo proyecto…');
    try {
      let d; try { d = JSON.parse(await file.text()); } catch (e) { d = null; }
      if (!d || d.app !== FORMAT || !Array.isArray(d.pages) || !d.pages.length || !d.imgs || typeof d.imgs !== 'object') throw new Error('formato');
      if (d.v > VERSION) throw new Error('versión');

      const loaded = {};
      for (const k of Object.keys(d.imgs)) {
        const u = d.imgs[k];
        if (typeof u !== 'string' || !/^data:image\//i.test(u)) continue;
        try {
          const url = URL.createObjectURL(dataToBlob(u)), img = await loadImg(url);
          if (!img.naturalWidth || img.naturalWidth * img.naturalHeight > MAX_PIXELS) { URL.revokeObjectURL(url); continue; }
          loaded[k] = { img, src: url };
        } catch (e) { /* esa imagen no se pudo leer: se omite */ }
      }

      let maxId = 0, lost = 0; const seen = new Set();
      const pages = d.pages.map(p => {
        const items = [];
        (Array.isArray(p.items) ? p.items : []).forEach(c => {
          const m = c && loaded[c.s];
          if (!m || ![c.x, c.y, c.w, c.h].every(num) || c.w <= 0 || c.h <= 0) { lost++; return; }
          const { s, os, ...rest } = c, it = { ...rest, img: m.img, src: m.src };
          if ([it.x, it.y, it.w, it.h].some(v => Math.abs(v) > 5000)) { lost++; return; }      // medidas imposibles: se descarta esa imagen
          if (typeof it.id !== 'string' || seen.has(it.id)) it.id = 'i' + (++maxId);
          seen.add(it.id);
          if (os && loaded[os]) it.o = { img: loaded[os].img, src: loaded[os].src };
          const n = parseInt(String(it.id).replace(/\D/g, ''), 10); if (n > maxId) maxId = n;
          items.push(it);
        });
        const extra = p.x && typeof p.x === 'object' && !Array.isArray(p.x) ? p.x : {};
        return { ...extra, items, manual: !!p.manual };
      });
      if (!pages.some(p => p.items.length)) throw new Error('vacío');

      const cfg = d.cfg && typeof d.cfg === 'object' ? d.cfg : {};
      if (App.save) App.save();
      if (cfg.paper in App.PAPER) S.paper = cfg.paper;
      if (cfg.orient === 'p' || cfg.orient === 'l') S.orient = cfg.orient;
      // Valores dentro de los mismos rangos que los controles (un archivo dañado no puede dejar 0 columnas ni 1e9 filas)
      const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
      [['margin', 0, 60], ['gap', 0, 60], ['cols', 1, 12], ['rows', 1, 12], ['pm', 0, 60], ['pg', 0, 60]].forEach(([k, a, b]) => {
        if (num(cfg[k])) S[k] = clamp(k === 'cols' || k === 'rows' ? Math.round(cfg[k]) : cfg[k], a, b);
      });
      if (cfg.fit === 'contain' || cfg.fit === 'cover') S.fit = cfg.fit;
      if (typeof cfg.snap === 'boolean') S.snap = cfg.snap;
      if (['none', 'corners', 'lines'].includes(cfg.marks)) S.marks = cfg.marks;
      S.uid = Math.max(S.uid || 0, num(d.uid) ? d.uid : 0, maxId);
      S.pages = pages; S.page = Math.max(0, Math.min(pages.length - 1, +d.page || 0));
      S.items = pages[S.page].items; S.manual = pages[S.page].manual;
      S.sel = null; S.group = []; S.crop = false;
      App.dims(); App.render();
      wait.remove();
      const n = pages.reduce((a, p) => a + p.items.length, 0);
      App.toast('Proyecto abierto: ' + n + (n === 1 ? ' imagen' : ' imágenes') + (pages.length > 1 ? ', ' + pages.length + ' páginas' : '') + (lost ? ' (' + lost + ' no se pudieron leer)' : ''),
        App.undo ? 'Deshacer' : '', App.undo ? () => App.undo() : null);
    } catch (e) {
      wait.remove();
      App.toast(e && e.message === 'versión' ? 'Ese proyecto es de una versión más nueva de la herramienta.' : 'Ese archivo no es un proyecto de la hoja.');
    }
    busy = false;
  }

  const input = $('projFile');
  $('bSave').onclick = () => save(false);
  $('bSaveHQ').onclick = () => save(true);

  // Menú «···»
  const mb = $('bMore'), mm = $('rMenu');
  const closeM = () => { mm.hidden = true; mb.setAttribute('aria-expanded', 'false'); };
  mb.onclick = e => { e.stopPropagation(); mm.hidden = !mm.hidden; mb.setAttribute('aria-expanded', String(!mm.hidden)); };
  mm.addEventListener('click', closeM);
  document.addEventListener('click', e => { if (!e.target.closest('#racts')) closeM(); });
  addEventListener('keydown', e => { if (e.key === 'Escape') closeM(); });
  $('bOpen').onclick = () => input.click();
  input.onchange = e => { const f = e.target.files[0]; e.target.value = ''; open(f); };

  // Arrastrar un .hoja a la página también lo abre (las imágenes siguen yendo a la hoja)
  const isProj = dt => dt && [...dt.files].some(f => /\.hoja$/i.test(f.name));
  addEventListener('dragover', e => { if (isProj(e.dataTransfer)) e.preventDefault(); }, true);
  addEventListener('drop', e => {
    if (!isProj(e.dataTransfer)) return;
    e.preventDefault(); e.stopPropagation(); open([...e.dataTransfer.files].find(f => /\.hoja$/i.test(f.name)));
  }, true);

  addEventListener('keydown', e => {
    if (!(e.ctrlKey || e.metaKey) || e.altKey || e.shiftKey) return;
    const k = e.key.toLowerCase(); if (k !== 's' && k !== 'o') return;
    if (document.querySelector('[role="dialog"]:not([hidden])')) return;
    e.preventDefault(); if (k === 's') save(false); else input.click();
  }, true);
})();
