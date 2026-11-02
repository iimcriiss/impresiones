/* Vista previa: la hoja en grande, como saldría impresa (zoom, regla, blanco y negro) */
(() => {
  const App = window.App, S = App.S, $ = App.$;
  const ic = d => '<svg viewBox="0 0 24 24">' + d + '</svg>';
  const EYE = ic('<path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>');
  S.gray = false;

  // Botón flotante
  const fab = document.createElement('button');
  fab.id = 'bPreview'; fab.className = 'fab'; fab.type = 'button';
  fab.title = 'Ver cómo quedará la hoja impresa';
  fab.innerHTML = EYE + '<span>Vista previa</span>';
  $('stage').append(fab);

  // Ventana de vista previa
  const ov = document.createElement('div');
  ov.id = 'prev'; ov.hidden = true;
  ov.setAttribute('role', 'dialog'); ov.setAttribute('aria-modal', 'true'); ov.setAttribute('aria-label', 'Vista previa de la hoja');
  ov.innerHTML =
    '<canvas class="pv-rul pv-rh"></canvas><canvas class="pv-rul pv-rv"></canvas>' +
    '<button class="pv-x" type="button" aria-label="Cerrar vista previa">' + ic('<path d="M6 6l12 12M18 6L6 18"/>') + '</button>' +
    '<button class="pv-nav pv-prev" type="button" aria-label="Página anterior">' + ic('<path d="M15 5l-7 7 7 7"/>') + '</button>' +
    '<div class="pv-box"><div class="pv-scene"><div class="pv-paper"><canvas></canvas></div></div>' +
    '<div class="pv-cap"><span class="pv-txt"></span>' +
    '<span class="pv-zg"><button class="pv-zb pv-zout" type="button" aria-label="Alejar" title="Alejar (rueda del mouse)">−</button><button class="pv-zv" type="button" title="Volver al tamaño normal">100%</button><button class="pv-zb pv-zin" type="button" aria-label="Acercar" title="Acercar (rueda del mouse). Con zoom, arrastra para mover la hoja">+</button></span>' +
    '<span class="pv-mode"><button class="pv-m" data-g="0" type="button" aria-pressed="true">Color</button><button class="pv-m" data-g="1" type="button" aria-pressed="false">Blanco y negro</button></span>' +
    '<span class="pv-mode"><button class="pv-rb pv-rg on" type="button" aria-pressed="true" title="Mostrar u ocultar la regla">Regla</button><button class="pv-rb pv-rm" type="button" aria-expanded="false" title="Agregar referencias con medidas reales en cm">Medidas</button></span>' +
    '<div class="pv-panel" hidden>' +
      '<button class="pv-px" type="button" aria-label="Cerrar medidas" title="Cerrar (Esc)">' + ic('<path d="M6 6l12 12M18 6L6 18"/>') + '</button>' +
      '<div class="pv-pt">Referencias con medida real<small>Elige una, arrástrala sobre la hoja y cambia su medida abajo. Solo se ve en la vista previa (no se imprime).</small></div>' +
      '<div class="pv-tabs"><button class="pv-tab on" type="button" data-t="m">Manos</button><button class="pv-tab" type="button" data-t="o">Objetos</button><button class="pv-tab" type="button" data-t="f">Libre</button></div>' +
      '<div class="pv-grid"></div>' +
      '<div class="pv-short" hidden></div>' +
      '<div class="pv-form" hidden>' +
        '<label class="pv-lw"><span>Ancho (cm)</span><input class="pv-w" type="number" min="0.2" step="0.1" value="4"></label>' +
        '<label class="pv-lh"><span>Alto (cm)</span><input class="pv-h" type="number" min="0.2" step="0.1" value="4"></label>' +
        '<label class="pv-le"><span>Emoji</span><input class="pv-e" type="text" maxlength="4" placeholder="opcional"></label>' +
        '<button class="pv-add" type="button">Agregar</button>' +
        '<button class="pv-save" type="button" hidden>Guardar medida</button>' +
      '</div>' +
      '<div class="pv-pf"><button class="pv-clear" type="button">Quitar todas</button><button class="pv-reset" type="button">Restaurar medidas</button></div>' +
    '</div></div>' +
    '</div>' +
    '<button class="pv-nav pv-next" type="button" aria-label="Página siguiente">' + ic('<path d="M9 5l7 7-7 7"/>') + '</button>';
  document.body.append(ov);
  const q = s => ov.querySelector(s);
  const cv = q('.pv-paper canvas'), scene = q('.pv-scene'), paper = q('.pv-paper'), cap = q('.pv-txt');
  const bx = q('.pv-x'), bp = q('.pv-prev'), bn = q('.pv-next'), zin = q('.pv-zin'), zout = q('.pv-zout'), zv = q('.pv-zv');
  const rh = q('.pv-rh'), rv = q('.pv-rv');
  let list = [], cur = 0, isOpen = false, lastFocus = null, timer = 0, downOn = null;
  let z = 1, panX = 0, panY = 0, base = 1, tz = 0, rraf = 0, drag = null, moved = false;
  const MAXZ = 6, clamp = (v, a, b) => Math.min(b, Math.max(a, v));

  // Regla pegada a los bordes de la hoja (sale en la captura), grande y con línea que sigue al mouse
  const RT = 36, corner = document.createElement('div');
  corner.className = 'pv-corner'; corner.textContent = 'cm'; ov.append(corner);
  let mx = null, my = null;
  const drawRulers = () => {
    rraf = 0;
    const on = isOpen && S.ruler;
    rgb.classList.toggle('on', !!S.ruler); rgb.setAttribute('aria-pressed', !!S.ruler);
    ov.classList.toggle('pv-rulers', on); if (!on) return;
    const r = paper.getBoundingClientRect(), ppm = r.width / S.W;
    const top = clamp(r.top - RT, 0, innerHeight - RT), left = clamp(r.left - RT, 0, innerWidth - RT);
    const right = Math.min(innerWidth, r.right), bottom = Math.min(innerHeight, r.bottom);
    const w = right - left - RT, h = bottom - top - RT; if (w < 20 || h < 20) return;
    Object.assign(rh.style, { left: left + RT + 'px', top: top + 'px', width: w + 'px', height: RT + 'px' });
    Object.assign(rv.style, { left: left + 'px', top: top + RT + 'px', width: RT + 'px', height: h + 'px' });
    Object.assign(corner.style, { left: left + 'px', top: top + 'px', width: RT + 'px', height: RT + 'px' });
    App.drawRuler(rh, { start: r.left - (left + RT), ppm, len: S.W, margin: 0, fs: 13, hover: mx == null ? null : (mx - r.left) / ppm });
    App.drawRuler(rv, { vertical: true, start: r.top - (top + RT), ppm, len: S.H, margin: 0, fs: 13, hover: my == null ? null : (my - r.top) / ppm });
  };
  const rgb = q('.pv-rg');
  rgb.onclick = () => { const b = document.getElementById('bRuler'); if (b) b.click(); else S.ruler = !S.ruler; drawRulers(); };
  const scheduleRuler = () => { if (!rraf) rraf = requestAnimationFrame(drawRulers); };

  // Zoom: rueda del mouse, botones o doble clic; con zoom se arrastra para mover la hoja
  const applyView = () => {
    scene.style.transform = 'translate(' + panX + 'px,' + panY + 'px) scale(' + z + ')';
    zv.textContent = Math.round(z * 100) + '%'; zout.disabled = z <= 1.001; zin.disabled = z >= MAXZ - .001;
    ov.classList.add('zoomed'); scene.style.setProperty('--iz', 1 / z); scheduleRuler();
  };
  // Cámara libre: se puede mover aunque no haya zoom, hasta dejar cualquier borde de la hoja más allá del centro de la pantalla
  const clampPan = () => { const w = paper.offsetWidth * z / 2 + innerWidth * .4, h = paper.offsetHeight * z / 2 + innerHeight * .4; panX = clamp(panX, -w, w); panY = clamp(panY, -h, h); };
  const zoomAt = (nz, cx, cy, smooth) => {
    nz = clamp(nz, 1, MAXZ); if (Math.abs(nz - z) < 1e-4) return;
    const r = scene.getBoundingClientRect(), ox = r.left + r.width / 2 - panX, oy = r.top + r.height / 2 - panY;
    const dx = cx - ox, dy = cy - oy;
    panX = dx - (dx - panX) * nz / z; panY = dy - (dy - panY) * nz / z; z = nz;
    if (z <= 1.001) { z = 1; panX = panY = 0; }
    clampPan();
    if (smooth) { scene.classList.add('zs'); setTimeout(() => scene.classList.remove('zs'), 300); }
    applyView(); clearTimeout(tz); tz = setTimeout(redraw, 150);
  };
  const mid = () => [innerWidth / 2, innerHeight / 2];
  zin.onclick = () => zoomAt(z * 1.4, ...mid(), true);
  zout.onclick = () => zoomAt(z / 1.4, ...mid(), true);
  zv.onclick = () => {      // 100%: vuelve al zoom normal y centra la hoja
    if (Math.abs(z - 1) > 1e-4) return zoomAt(1, ...mid(), true);
    panX = panY = 0; scene.classList.add('zs'); setTimeout(() => scene.classList.remove('zs'), 300); applyView();
  };
  ov.addEventListener('wheel', e => { if (!isOpen) return; if (e.target.closest('.pv-panel')) return; e.preventDefault(); zoomAt(z * Math.exp(-e.deltaY * .0015), e.clientX, e.clientY); }, { passive: false });
  ov.addEventListener('dblclick', e => { if (!e.target.closest('button,.pv-cap,.pv-ref')) zoomAt(z > 1 ? 1 : 2.5, e.clientX, e.clientY, true); });

  ov.addEventListener('pointerdown', e => {
    if (e.button > 1 || e.target.closest('button,.pv-cap')) return;
    downOn = e.target; moved = false;
    e.preventDefault(); drag = { x: e.clientX, y: e.clientY };
    ov.classList.add('grabbing'); ov.setPointerCapture(e.pointerId);
  });
  ov.addEventListener('pointermove', e => {
    if (!drag) return;
    const dx = e.clientX - drag.x, dy = e.clientY - drag.y; drag.x = e.clientX; drag.y = e.clientY;
    if (Math.abs(dx) + Math.abs(dy) > 1) moved = true;
    panX += dx; panY += dy; clampPan(); applyView();
  });
  ov.addEventListener('pointermove', e => { mx = e.clientX; my = e.clientY; scheduleRuler(); });
  ov.addEventListener('pointerleave', () => { mx = my = null; scheduleRuler(); });
  const endDrag = () => { drag = null; ov.classList.remove('grabbing'); };
  ov.addEventListener('pointerup', endDrag); ov.addEventListener('pointercancel', endDrag);

  /* ---- Referencias con medida real: manos, objetos y medidas libres (solo para ver en la vista previa) ---- */
  const ART = App.REF_ART || [], artOf = id => ART.find(a => a.id === id);
  const panel = q('.pv-panel'), rbtn = q('.pv-rm'), iw = q('.pv-w'), ih = q('.pv-h'), ie = q('.pv-e');
  const form = q('.pv-form'), lwTxt = q('.pv-lw span'), lh = q('.pv-lh'), le = q('.pv-le'), bAdd = q('.pv-add'), bSave = q('.pv-save');
  const grid = q('.pv-grid'), short = q('.pv-short');
  const layer = document.createElement('div'); layer.className = 'pv-refs'; paper.append(layer);
  let selRef = null, tab = 'm';
  // Hasta dónde se puede llevar una referencia: lo que se mide (los dedos de las manos) siempre queda dentro de la hoja,
  // el resto (la muñeca, el brazo) puede sobresalir; los objetos pueden sobresalir hasta la mitad.
  const lim = r => {
    const a = r.art && artOf(r.art);
    if (a && a.mb) {
      const k = r.w / a.vb[0], mx = a.mb[0] * k, my = a.mb[1] * k, mw = a.mb[2] * k, mh = a.mb[3] * k;
      return { x0: -mx, x1: S.W - mx - mw, y0: -my, y1: S.H - my - mh };
    }
    return { x0: -r.w / 2, x1: S.W - r.w / 2, y0: -r.h / 2, y1: S.H - r.h / 2 };
  };

  // Medidas que guarda la persona (quedan en este navegador)
  const KEY = 'saphix.refs.v1', DEF_SHORT = () => [{ w: 4, h: 4, t: '' }];
  const store = { over: {}, short: DEF_SHORT() };
  try {
    const o = JSON.parse(localStorage.getItem(KEY) || 'null');
    if (o && typeof o === 'object') { if (o.over && typeof o.over === 'object') store.over = o.over; if (Array.isArray(o.short)) store.short = o.short; }
  } catch (_) {}
  const persist = () => { try { localStorage.setItem(KEY, JSON.stringify(store)); } catch (_) {} };
  const cmOf = a => { const v = +store.over[a.id]; return v > 0 && v < 200 ? v : a.cm; };

  const refs = () => { const p = list[cur]; return p ? (p.refs = p.refs || []) : []; };
  const fmt = mm => String(Math.round(mm / 10 * 100) / 100).replace('.', ',');
  const fillInputs = r => { if (r.art) iw.value = Math.round(r.m) / 10; else { iw.value = Math.round(r.w) / 10; ih.value = Math.round(r.h) / 10; ie.value = r.t || ''; } };
  const mark = () => { const a = refs(); layer.querySelectorAll('.pv-ref').forEach((d, i) => d.classList.toggle('on', a[i] === selRef)); };
  // Dibujos: la medida (m) es lo que mide la parte marcada del dibujo; el marco se calcula a partir de ella
  const sizeArt = r => {
    const a = artOf(r.art), k = a.vb[0] / (a.span || a.vb[0]), asp = a.vb[1] / a.vb[0];
    r.m = clamp(r.m, 5, Math.min(S.W / k, S.H / (k * asp)));
    r.w = r.m * k; r.h = r.w * asp;
  };
  const updateForm = () => {
    const art = !!(selRef && selRef.art), free = tab === 'f';
    form.hidden = !(free || selRef);
    lwTxt.textContent = art ? 'Medida (cm)' : 'Ancho (cm)';
    lh.hidden = le.hidden = art;
    bAdd.hidden = !free || art;
    bSave.hidden = !selRef; bSave.disabled = false; bSave.textContent = art ? 'Guardar mi medida' : 'Guardar atajo';
  };
  const removeRef = r => { const a = refs(), i = a.indexOf(r); if (i >= 0) a.splice(i, 1); if (selRef === r) selRef = null; renderRefs(); };
  const startRef = (e, r, d) => {
    if (e.button > 1) return;
    e.stopPropagation(); e.preventDefault();
    selRef = r; fillInputs(r); mark(); updateForm(); setPanel(false);      // el panel se cierra para ver la hoja completa
    const P0 = paper.getBoundingClientRect(), k0 = P0.width / S.W;
    const gx = (e.clientX - P0.left) / k0 - r.x, gy = (e.clientY - P0.top) / k0 - r.y;      // por dónde la agarraste
    let px = e.clientX, py = e.clientY, on = true;
    d.setPointerCapture(e.pointerId);
    const place = () => {        // la posición se calcula con la hoja tal como está en pantalla (con zoom y cámara)
      const P = paper.getBoundingClientRect(), k = P.width / S.W;
      const L = lim(r); r.x = clamp((px - P.left) / k - gx, L.x0, L.x1); r.y = clamp((py - P.top) / k - gy, L.y0, L.y1);
      d.style.left = r.x / S.W * 100 + '%'; d.style.top = r.y / S.H * 100 + '%';
    };
    // Cerca del borde de la pantalla la cámara se mueve sola para seguirla, así no se sale de la vista
    const M = 80, sp = (a, n) => a < M ? (M - a) / M * 16 : a > n - M ? -(a - (n - M)) / M * 16 : 0;
    const tick = () => {
      if (!on) return;
      const vx = sp(px, innerWidth), vy = sp(py, innerHeight);
      if (vx || vy) { const ox = panX, oy = panY; panX += vx; panY += vy; clampPan(); if (panX !== ox || panY !== oy) { applyView(); place(); } }
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
    d.onpointermove = ev => { px = clamp(ev.clientX, 0, innerWidth); py = clamp(ev.clientY, 0, innerHeight); place(); };
    d.onpointerup = d.onpointercancel = () => { on = false; d.onpointermove = null; };
  };
  const renderRefs = () => {
    layer.textContent = '';
    const ppm = paper.offsetWidth / S.W;
    refs().forEach(r => {
      const a = r.art && artOf(r.art);
      const d = document.createElement('div'); d.className = 'pv-ref' + (a ? ' art' : '') + (a && a.mb ? ' mb' : '') + (r === selRef ? ' on' : '');
      d.style.left = r.x / S.W * 100 + '%'; d.style.top = r.y / S.H * 100 + '%'; d.style.width = r.w / S.W * 100 + '%'; d.style.height = r.h / S.H * 100 + '%';
      if (a) { const w = document.createElement('span'); w.className = 'pv-art'; w.innerHTML = App.refSvg(a); d.append(w); 
        if (a.mb) { const z = document.createElement('span'); z.className = 'pv-mb';   // el marco punteado cubre solo lo que se mide (por ejemplo, los dedos levantados)
          z.style.left = a.mb[0] / a.vb[0] * 100 + '%'; z.style.top = a.mb[1] / a.vb[1] * 100 + '%'; z.style.width = a.mb[2] / a.vb[0] * 100 + '%'; z.style.height = a.mb[3] / a.vb[1] * 100 + '%'; d.append(z); } }
      else if (r.t) { const em = document.createElement('span'); em.className = 'pv-re'; em.textContent = r.t; em.style.fontSize = Math.min(r.w, r.h) * ppm * .8 + 'px'; d.append(em); }
      const l = document.createElement('span'); l.className = 'pv-rl'; l.textContent = a ? a.n + ' · ' + fmt(r.m) + ' cm' : fmt(r.w) + ' × ' + fmt(r.h) + ' cm'; d.append(l);
      const x = document.createElement('button'); x.type = 'button'; x.className = 'pv-rx'; x.textContent = '×'; x.setAttribute('aria-label', 'Quitar referencia');
      x.onpointerdown = e => e.stopPropagation(); x.onclick = e => { e.stopPropagation(); removeRef(r); };
      d.append(x); d.onpointerdown = e => startRef(e, r, d); layer.append(d);
    });
    updateForm();
  };
  // Las nuevas aparecen arriba a la izquierda (el panel queda a la derecha y no las tapa)
  const putRef = r => {
    const n = refs().length;
    r.x = clamp(12 + n * 8, 0, Math.max(0, S.W - r.w)); r.y = clamp(12 + n * 8, 0, Math.max(0, S.H - r.h));
    refs().push(r); selRef = r; fillInputs(r); renderRefs();
  };
  const addArt = a => { const r = { art: a.id, m: cmOf(a) * 10 }; sizeArt(r); putRef(r); };
  const addFree = (wcm, hcm, t) => putRef({ w: clamp((wcm || 4) * 10, 2, S.W), h: clamp((hcm || 4) * 10, 2, S.H), t: t || '' });
  // Con una referencia elegida, los campos de abajo la cambian en vivo
  const onEdit = () => {
    if (!selRef) return;
    if (selRef.art) { const m = parseFloat(iw.value); if (!(m > 0)) return; selRef.m = m * 10; sizeArt(selRef); }
    else {
      const w = parseFloat(iw.value), h = parseFloat(ih.value); if (!(w > 0 && h > 0)) return;
      selRef.w = clamp(w * 10, 2, S.W); selRef.h = clamp(h * 10, 2, S.H); selRef.t = ie.value.trim();
    }
    const L = lim(selRef); selRef.x = clamp(selRef.x, L.x0, L.x1); selRef.y = clamp(selRef.y, L.y0, L.y1); renderRefs();
  };
  [iw, ih, ie].forEach(i => i.oninput = onEdit);

  const renderGrid = () => {
    grid.hidden = tab === 'f'; short.hidden = tab !== 'f';
    grid.textContent = ''; short.textContent = '';
    ART.filter(a => a.g === tab).forEach(a => {
      const b = document.createElement('button'); b.type = 'button'; b.className = 'pv-card';
      b.innerHTML = '<span class="pv-th">' + App.refSvg(a) + '</span><b></b><small></small>';
      b.querySelector('b').textContent = a.n; b.querySelector('small').textContent = fmt(cmOf(a) * 10) + ' cm';
      b.onclick = () => addArt(a); grid.append(b);
    });
    store.short.forEach((sc, i) => {
      if (!(sc && sc.w > 0 && sc.h > 0)) return;
      const box = document.createElement('span'); box.className = 'pv-sc';
      const c = document.createElement('button'); c.type = 'button'; c.className = 'pv-chip'; c.textContent = (sc.t ? sc.t + ' ' : '') + fmt(sc.w * 10) + ' × ' + fmt(sc.h * 10) + ' cm';
      c.onclick = () => addFree(sc.w, sc.h, sc.t);
      const x = document.createElement('button'); x.type = 'button'; x.className = 'pv-sx'; x.textContent = '×'; x.setAttribute('aria-label', 'Borrar atajo');
      x.onclick = () => { store.short.splice(i, 1); persist(); renderGrid(); };
      box.append(c, x); short.append(box);
    });
  };
  ov.querySelectorAll('.pv-tab').forEach(t => t.onclick = () => {
    tab = t.dataset.t; if (selRef && (tab === 'f') === !!selRef.art) { selRef = null; mark(); }   // al cambiar de pestaña se suelta la referencia de otro tipo
    ov.querySelectorAll('.pv-tab').forEach(o => o.classList.toggle('on', o === t)); renderGrid(); updateForm();
  });
  bAdd.onclick = () => addFree(parseFloat(iw.value), parseFloat(ih.value), ie.value.trim());
  bSave.onclick = () => {
    if (!selRef) return;
    if (selRef.art) store.over[selRef.art] = Math.round(selRef.m) / 10;
    else {
      const sc = { w: Math.round(selRef.w) / 10, h: Math.round(selRef.h) / 10, t: selRef.t || '' };
      if (!store.short.some(x => x.w === sc.w && x.h === sc.h && (x.t || '') === sc.t)) store.short.push(sc);
    }
    persist(); renderGrid(); bSave.textContent = '¡Guardado!'; bSave.disabled = true; setTimeout(updateForm, 1200);
  };
  q('.pv-clear').onclick = () => { refs().length = 0; selRef = null; renderRefs(); };
  q('.pv-reset').onclick = () => { store.over = {}; store.short = DEF_SHORT(); persist(); renderGrid(); };
  const setPanel = on => { panel.hidden = !on; rbtn.classList.toggle('on', on); rbtn.setAttribute('aria-expanded', on); };
  rbtn.onclick = () => setPanel(panel.hidden);
  q('.pv-px').onclick = () => { setPanel(false); rbtn.focus(); };
  ov.addEventListener('pointerdown', e => { if (!e.target.closest('.pv-ref,.pv-cap')) { selRef = null; mark(); updateForm(); } });
  renderGrid(); updateForm();

  /* ---- Blanco y negro (solo para ver) ---- */
  const gbtn = document.createElement('button');
  gbtn.id = 'bGray'; gbtn.type = 'button'; gbtn.className = 'pbtn'; gbtn.title = 'Ver la hoja en blanco y negro';
  gbtn.innerHTML = ic('<circle cx="12" cy="12" r="8"/><path d="M12 4a8 8 0 0 1 0 16z" fill="currentColor"/>') + 'B/N';
  gbtn.setAttribute('aria-pressed', 'false');
  ($('bRuler') || $('bPages')).after(gbtn);
  gbtn.onclick = () => setGray(!S.gray);
  const setGray = g => {
    S.gray = g; ov.classList.toggle('gray', g); document.body.classList.toggle('gray', g);
    gbtn.classList.toggle('on', g); gbtn.setAttribute('aria-pressed', g);
    ov.querySelectorAll('.pv-m').forEach(b => { const on = (b.dataset.g === '1') === g; b.classList.toggle('on', on); b.setAttribute('aria-pressed', on); });
  };
  ov.querySelectorAll('.pv-m').forEach(b => b.onclick = () => setGray(b.dataset.g === '1'));

  const filled = () => { App.save(); return S.pages.filter(p => p.items.length); };

  // Mismo dibujo que al exportar a PNG/PDF, para que la vista previa sea fiel
  const redraw = () => {
    if (!isOpen || !list[cur]) return;
    const k = Math.min(base * Math.min(devicePixelRatio || 1, 2) * z, 3200 / Math.max(S.W, S.H));
    cv.width = Math.round(S.W * k); cv.height = Math.round(S.H * k);
    const g = cv.getContext('2d'); g.imageSmoothingQuality = 'high';
    g.fillStyle = '#fff'; g.fillRect(0, 0, cv.width, cv.height);
    list[cur].items.forEach(it => {
      App.clampCrop(it);
      const im = it.img, bw = it.w * k, bh = it.h * k, r = it.rot % 180 !== 0, iw = r ? bh : bw, ih = r ? bw : bh;
      g.save(); g.beginPath(); g.rect(it.x * k, it.y * k, bw, bh); g.clip();
      g.translate((it.x + it.w / 2) * k, (it.y + it.h / 2) * k); g.translate(it.fx * bw, it.fy * bh); g.rotate(it.rot * Math.PI / 180);
      const [sx, sy] = App.imgScale(it, im.naturalWidth, im.naturalHeight, iw, ih);
      const dw = im.naturalWidth * sx * it.z, dh = im.naturalHeight * sy * it.z;
      g.drawImage(im, -dw / 2, -dh / 2, dw, dh); g.restore();
    });
  };

  const show = dir => {
    const p = list[cur], n = list.length;
    const availW = Math.max(200, innerWidth - (n > 1 ? 230 : 110)), availH = Math.max(200, innerHeight - 190);
    base = Math.min(availW / S.W, availH / S.H);                          // px de pantalla por mm
    paper.style.width = Math.round(S.W * base) + 'px'; paper.style.height = Math.round(S.H * base) + 'px';
    redraw(); renderRefs();
    const paperName = $('paper').selectedOptions[0] ? $('paper').selectedOptions[0].textContent : '';
    cap.textContent = (n > 1 ? 'Hoja ' + (cur + 1) + ' de ' + n + ' · ' : '') + paperName + ' · ' + (S.W > S.H ? 'Horizontal' : 'Vertical') + ' · ' + p.items.length + (p.items.length === 1 ? ' imagen' : ' imágenes');
    bp.hidden = bn.hidden = n < 2; bp.disabled = cur === 0; bn.disabled = cur === n - 1;
    if (dir) { paper.classList.remove('flip-l', 'flip-r'); void paper.offsetWidth; paper.classList.add(dir > 0 ? 'flip-r' : 'flip-l'); }
    clampPan(); applyView(); setTimeout(scheduleRuler, 520);
  };
  const go = d => { const t = cur + d; if (t < 0 || t >= list.length) return; cur = t; selRef = null; show(d); };

  const open = () => {
    list = filled();
    if (!list.length) { App.toast('Primero agrega al menos una imagen.'); return; }
    const i = list.indexOf(S.pages[S.page]); cur = i < 0 ? 0 : i;
    clearTimeout(timer); lastFocus = document.activeElement; isOpen = true;
    z = 1; panX = panY = 0; selRef = null; setPanel(false); setGray(S.gray);
    ov.hidden = false; show(0); void ov.offsetWidth; ov.classList.add('open'); document.body.classList.add('pv-lock');
    bx.focus();
  };
  const close = () => {
    if (!isOpen) return; isOpen = false; ov.classList.remove('open', 'pv-rulers', 'zoomed', 'grabbing'); document.body.classList.remove('pv-lock');
    timer = setTimeout(() => { ov.hidden = true; cv.width = cv.height = 1; }, 280);
    if (lastFocus && lastFocus.focus) lastFocus.focus();
  };

  fab.onclick = open; bx.onclick = close; bp.onclick = () => go(-1); bn.onclick = () => go(1);
  ov.addEventListener('click', e => {
    if (moved) { moved = false; return; }
    const t = downOn || e.target; downOn = null;                       // con el puntero capturado, el clic llega al fondo: se usa donde se presionó
    if (t === ov || t.classList.contains('pv-box') || t.classList.contains('pv-scene')) close();
  });
  addEventListener('resize', () => { if (isOpen) show(0); });
  // Con la vista previa abierta, el teclado no toca las imágenes de atrás
  document.addEventListener('keydown', e => {
    if (!isOpen) return;
    if (e.target.tagName === 'INPUT' && e.key !== 'Tab') { if (e.key === 'Escape') e.target.blur(); e.stopPropagation(); return; }   // escribir en los campos no activa atajos
    if (e.key === 'Escape' && !panel.hidden) { setPanel(false); e.stopImmediatePropagation(); return; }
    if ((e.key === 'Delete' || e.key === 'Backspace') && selRef) removeRef(selRef);
    if (e.key === 'Escape') close();
    else if (e.key === 'ArrowLeft') go(-1);
    else if (e.key === 'ArrowRight') go(1);
    else if (e.key === '+' || e.key === '=') zoomAt(z * 1.4, ...mid(), true);
    else if (e.key === '-') zoomAt(z / 1.4, ...mid(), true);
    else if (e.key === '0') zoomAt(1, ...mid(), true);
    else if (e.key === 'Tab') {
      const b = [...ov.querySelectorAll('button,input')].filter(x => !x.hidden && !x.disabled && x.offsetParent), i = b.indexOf(document.activeElement);
      e.preventDefault(); b[(i + (e.shiftKey ? -1 : 1) + b.length) % b.length].focus();
    }
    e.stopImmediatePropagation();
  }, true);
})();
