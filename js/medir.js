/* Medir en la hoja principal: datos de la hoja, color / blanco y negro, regla y referencias con medida real.
   Todo se ve sobre la hoja y la barra de abajo; nada de esto se imprime ni se exporta. */
(() => {
  const App = window.App, S = App.S, $ = App.$;
  const ic = d => '<svg viewBox="0 0 24 24">' + d + '</svg>';
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  const sheet = $('sheet'), canvas = $('canvas'), stage = $('stage'), bar = document.querySelector('.bar');
  const info = $('barInfo'), rbtn = $('bRuler'), mbtn = $('bMeasure');
  S.gray = false;       // solo para ver
  S.ruler = false;

  /* ---- Datos de la hoja: «A4 · Vertical · 1 imagen» ---- */
  const updateInfo = () => {
    const sel = $('paper').selectedOptions[0], n = S.items.length;
    info.textContent = (sel ? sel.textContent + ' · ' : '') + (S.W > S.H ? 'Horizontal' : 'Vertical') + ' · ' + n + (n === 1 ? ' imagen' : ' imágenes');
  };

  /* ---- Regla fina con medida (diseño B) + franjas azules sobre la hoja (diseño C) ---- */
  let RH = 42, RV = 52, U = 1;      // alto de la regla de arriba y ancho de la de la izquierda (pegadas a la hoja); U: escala según el tamaño de la hoja
  const REF = 2.4;                  // px por mm con los que se diseñó la regla (U = 1); si la hoja se ve más chica, la regla se encoge
  const rbox = document.createElement('div'); rbox.className = 'mrulers'; rbox.hidden = true;
  rbox.innerHTML = '<canvas class="mr-guides"></canvas><canvas class="pv-rul pv-rh"></canvas><canvas class="pv-rul pv-rv"></canvas><div class="pv-corner">cm</div><span class="mr-pill mr-ph"></span><span class="mr-pill mr-pv"></span>';
  stage.append(rbox);
  const rh = rbox.querySelector('.pv-rh'), rv = rbox.querySelector('.pv-rv'), corner = rbox.querySelector('.pv-corner');
  const cg = rbox.querySelector('.mr-guides'), pillH = rbox.querySelector('.mr-ph'), pillV = rbox.querySelector('.mr-pv');
  let mx = null, my = null, rraf = 0, pressed = false, rp = 0, tw = 0;      // rp: 0 = sin regla, 1 = con regla (se anima)
  const showing = () => S.ruler || rp > .001;
  const cm1 = mm => (Math.round(mm) / 10).toFixed(1).replace('.', ',');
  const cssv = n => getComputedStyle(document.documentElement).getPropertyValue(n).trim();

  // Franjas azules que cruzan toda la hoja (ancho y alto de cada imagen elegida) con líneas punteadas en sus bordes
  const applyUnit = () => {
    const desk = matchMedia('(min-width:1101px)').matches, pg = $('pages');
    const pb = desk ? 16 + bar.offsetHeight + 8 + (pg && !pg.hidden ? pg.offsetHeight + 8 : 0) : 0;
    const aw = canvas.clientWidth - 32, ah = desk ? canvas.clientHeight - 32 - pb : 1e9;
    const s0 = Math.max(.5, Math.min(aw / S.W, ah / S.H));            // tamaño de la hoja al 100 %, sin contar la regla ni el zoom
    U = clamp(Math.round(s0 / REF * 20) / 20, .75, 1.3);
    RH = Math.round(42 * U); RV = Math.round(52 * U);
    canvas.style.setProperty('--rht', RH - 10 + 'px'); canvas.style.setProperty('--rwd', RV - 10 + 'px');
    rbox.style.setProperty('--mu', U);
  };
  const drawGuides = (its, rl, rt, ppm, W, H) => {
    const dpr = Math.min(devicePixelRatio || 1, 2);
    if (cg.width !== Math.round(W * dpr) || cg.height !== Math.round(H * dpr)) { cg.width = Math.round(W * dpr); cg.height = Math.round(H * dpr); }
    Object.assign(cg.style, { left: '0px', top: '0px', width: W + 'px', height: H + 'px' });
    const g = cg.getContext('2d'); g.setTransform(dpr, 0, 0, dpr, 0, 0); g.clearRect(0, 0, W, H);
    if (!its.length) return;
    const acc = cssv('--c4') || '#1F7FD8', sw = S.W * ppm, sh = S.H * ppm;
    const rc = its.map(it => [rl + it.x * ppm, rt + it.y * ppm, it.w * ppm, it.h * ppm]);
    g.save(); g.beginPath(); g.rect(rl, rt, sw, sh); g.clip();
    g.fillStyle = acc; g.globalAlpha = .11;
    rc.forEach(([x, y, w, h]) => { g.fillRect(x, rt, w, sh); g.fillRect(rl, y, sw, h); });
    g.globalAlpha = 1;
    rc.forEach(([x, y, w, h]) => g.clearRect(x, y, w, h));                  // la imagen queda limpia, sin tinte
    g.strokeStyle = acc; g.lineWidth = 1; g.globalAlpha = .75; g.setLineDash([5, 4]); g.beginPath();
    rc.forEach(([x, y, w, h]) => {
      [x, x + w].forEach(a => { g.moveTo(Math.round(a) + .5, rt); g.lineTo(Math.round(a) + .5, rt + sh); });
      [y, y + h].forEach(a => { g.moveTo(rl, Math.round(a) + .5); g.lineTo(rl + sw, Math.round(a) + .5); });
    });
    g.stroke(); g.restore();
  };

  const drawRulers = () => {
    rraf = 0; applyUnit();
    if (!showing()) { rbox.hidden = true; return; }
    const sr = stage.getBoundingClientRect(), c = canvas.getBoundingClientRect();
    const W = canvas.clientWidth, H = canvas.clientHeight;
    Object.assign(rbox.style, { left: c.left - sr.left + 'px', top: c.top - sr.top + 'px', width: W + 'px', height: H + 'px', opacity: rp });
    const r = sheet.getBoundingClientRect(), ppm = r.width / S.W;
    const rl = r.left - c.left, rt = r.top - c.top;
    const top = clamp(rt - RH, 0, Math.max(0, H - RH)), left = clamp(rl - RV, 0, Math.max(0, W - RV));
    const right = Math.min(W, r.right - c.left), bottom = Math.min(H, r.bottom - c.top);
    const w = right - left - RV, h = bottom - top - RH;
    rbox.hidden = false;
    if (w < 20 || h < 20) { rbox.hidden = true; return; }
    Object.assign(rh.style, { left: left + RV + 'px', top: top + 'px', width: w + 'px', height: RH + 'px' });
    Object.assign(rv.style, { left: left + 'px', top: top + RH + 'px', width: RV + 'px', height: h + 'px' });
    Object.assign(corner.style, { left: left + 'px', top: top + 'px', width: RV + 'px', height: RH + 'px' });
    // Las imágenes elegidas se marcan en las dos reglas y siguen a la imagen cuando la mueves.
    // Mientras agarras algo no se dibuja la línea del mouse: solo se ve la de la imagen.
    const its = App.sels().map(id => App.byId(id)).filter(Boolean);
    const hx = pressed || mx == null ? null : (mx - r.left) / ppm, hy = pressed || my == null ? null : (my - r.top) / ppm;
    drawGuides(its, rl, rt, ppm, W, H);
    App.drawRuler(rh, { thin: true, fs: 10 * U, start: rl - (left + RV), ppm, len: S.W, margin: S.margin, bands: its.map(it => [it.x, it.x + it.w]), hover: hx });
    App.drawRuler(rv, { thin: true, fs: 10 * U, vertical: true, start: rt - (top + RH), ppm, len: S.H, margin: S.margin, bands: its.map(it => [it.y, it.y + it.h]), hover: hy });
    // Pastillas con la medida (varias imágenes: la medida del conjunto)
    if (!its.length) { pillH.hidden = pillV.hidden = true; return; }
    const x0 = Math.min(...its.map(i => i.x)), x1 = Math.max(...its.map(i => i.x + i.w));
    const y0 = Math.min(...its.map(i => i.y)), y1 = Math.max(...its.map(i => i.y + i.h));
    const place = (pill, text, a0, a1, lo, hi, horiz) => {
      a0 = Math.max(a0, lo); a1 = Math.min(a1, hi);
      if (a1 <= a0) { pill.hidden = true; return; }
      pill.hidden = false; pill.textContent = text;
      const pw = horiz ? pill.offsetWidth : pill.offsetHeight;
      const mid = hi - lo > pw ? clamp((a0 + a1) / 2, lo + pw / 2, hi - pw / 2) : (lo + hi) / 2;
      if (horiz) Object.assign(pill.style, { left: mid - pw / 2 + 'px', top: top + 9.5 * U + 'px' });
      else { const pwx = pill.offsetWidth; Object.assign(pill.style, { left: left + Math.min(RV - 32.5 * U - pwx / 2, RV - 14.25 * U - pwx) + 'px', top: mid - pw / 2 + 'px' }); }
    };
    place(pillH, cm1(x1 - x0) + ' cm', rl + x0 * ppm, rl + x1 * ppm, left + RV, left + RV + w, true);
    place(pillV, cm1(y1 - y0), rt + y0 * ppm, rt + y1 * ppm, top + RH, top + RH + h, false);
  };
  const scheduleRuler = () => { if (!rraf && showing()) rraf = requestAnimationFrame(drawRulers); };
  // Al mostrar u ocultar la regla, el espacio que ocupa (--rp en el lienzo) y su opacidad se animan; la hoja se reajusta en cada cuadro
  const setRp = p => { rp = p; canvas.style.setProperty('--rp', p); App.fit(); drawRulers(); };
  const animateRuler = on => {
    cancelAnimationFrame(tw);
    const from = rp, to = on ? 1 : 0, t0 = performance.now();
    const D = matchMedia('(prefers-reduced-motion:reduce)').matches ? 0 : 340 * Math.abs(to - from);
    const step = now => {
      const t = D ? Math.min(1, (now - t0) / D) : 1, e = 1 - Math.pow(1 - t, 3);
      setRp(from + (to - from) * e);
      if (t < 1) tw = requestAnimationFrame(step);
    };
    tw = requestAnimationFrame(step);
  };
  const setRuler = on => {
    S.ruler = on; rbtn.classList.toggle('on', on); rbtn.setAttribute('aria-pressed', on);
    animateRuler(on);
  };
  rbtn.onclick = () => setRuler(!S.ruler);
  canvas.addEventListener('pointermove', e => { mx = e.clientX; my = e.clientY; scheduleRuler(); });
  canvas.addEventListener('pointerleave', () => { mx = my = null; scheduleRuler(); });
  canvas.addEventListener('scroll', scheduleRuler, { passive: true });
  canvas.addEventListener('pointerdown', e => { if (e.target.closest('#sheet')) { pressed = true; scheduleRuler(); } }, true);
  ['pointerup', 'pointercancel'].forEach(t => addEventListener(t, () => { if (pressed) { pressed = false; scheduleRuler(); } }));
  new MutationObserver(scheduleRuler).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });   // la regla toma los colores del tema

  /* ---- Referencias con medida real: manos, objetos y medidas libres ---- */
  const ART = App.REF_ART || [], artOf = id => ART.find(a => a.id === id);
  const panel = document.createElement('div');
  panel.className = 'pv-panel'; panel.hidden = true;
  panel.setAttribute('role', 'dialog'); panel.setAttribute('aria-label', 'Referencias con medida real');
  panel.innerHTML =
    '<button class="pv-px" type="button" aria-label="Cerrar medidas" title="Cerrar (Esc)">' + ic('<path d="M6 6l12 12M18 6L6 18"/>') + '</button>' +
    '<div class="pv-pt">Referencias con medida real<small>Elige una, arrástrala sobre la hoja y cambia su medida abajo. Solo se ven en pantalla (no se imprimen ni se exportan).</small></div>' +
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
    '<div class="pv-pf"><button class="pv-clear" type="button">Quitar todas</button><button class="pv-reset" type="button">Restaurar medidas</button></div>';
  stage.append(panel);
  const q = s => panel.querySelector(s);
  const iw = q('.pv-w'), ih = q('.pv-h'), ie = q('.pv-e');
  const form = q('.pv-form'), lwTxt = q('.pv-lw span'), lh = q('.pv-lh'), le = q('.pv-le'), bAdd = q('.pv-add'), bSave = q('.pv-save');
  const grid = q('.pv-grid'), short = q('.pv-short');
  const layer = document.createElement('div'); layer.className = 'pv-refs'; sheet.append(layer);
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

  const refs = () => { const p = S.pages[S.page]; return p ? (p.refs = p.refs || []) : []; };      // cada página tiene las suyas
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
  const emojiSize = () => { const ppm = sheet.offsetWidth / S.W; layer.querySelectorAll('.pv-re').forEach(em => { em.style.fontSize = Math.min(em._r.w, em._r.h) * ppm * .8 + 'px'; }); };
  const startRef = (e, r, d) => {
    if (e.button > 1) return;
    e.stopPropagation(); e.preventDefault();
    selRef = r; fillInputs(r); mark(); updateForm(); setPanel(false);      // el panel se cierra para ver la hoja completa
    const P0 = sheet.getBoundingClientRect(), k0 = P0.width / S.W;
    const gx = (e.clientX - P0.left) / k0 - r.x, gy = (e.clientY - P0.top) / k0 - r.y;      // por dónde la agarraste
    d.setPointerCapture(e.pointerId);
    d.onpointermove = ev => {
      const P = sheet.getBoundingClientRect(), k = P.width / S.W, L = lim(r);
      r.x = clamp((ev.clientX - P.left) / k - gx, L.x0, L.x1); r.y = clamp((ev.clientY - P.top) / k - gy, L.y0, L.y1);
      d.style.left = r.x / S.W * 100 + '%'; d.style.top = r.y / S.H * 100 + '%';
    };
    d.onpointerup = d.onpointercancel = () => { d.onpointermove = null; };
  };
  const renderRefs = () => {
    layer.textContent = '';
    refs().forEach(r => {
      const a = r.art && artOf(r.art);
      const d = document.createElement('div'); d.className = 'pv-ref' + (a ? ' art' : '') + (a && a.mb ? ' mb' : '') + (r === selRef ? ' on' : '');
      d.style.left = r.x / S.W * 100 + '%'; d.style.top = r.y / S.H * 100 + '%'; d.style.width = r.w / S.W * 100 + '%'; d.style.height = r.h / S.H * 100 + '%';
      if (a) {
        const w = document.createElement('span'); w.className = 'pv-art'; w.innerHTML = App.refSvg(a); d.append(w);
        if (a.mb) {      // el marco punteado cubre solo lo que se mide (por ejemplo, los dedos levantados)
          const z = document.createElement('span'); z.className = 'pv-mb';
          z.style.left = a.mb[0] / a.vb[0] * 100 + '%'; z.style.top = a.mb[1] / a.vb[1] * 100 + '%'; z.style.width = a.mb[2] / a.vb[0] * 100 + '%'; z.style.height = a.mb[3] / a.vb[1] * 100 + '%'; d.append(z);
        }
      } else if (r.t) { const em = document.createElement('span'); em.className = 'pv-re'; em.textContent = r.t; em._r = r; d.append(em); }
      const l = document.createElement('span'); l.className = 'pv-rl'; l.textContent = a ? a.n + ' · ' + fmt(r.m) + ' cm' : fmt(r.w) + ' × ' + fmt(r.h) + ' cm'; d.append(l);
      const x = document.createElement('button'); x.type = 'button'; x.className = 'pv-rx'; x.textContent = '×'; x.setAttribute('aria-label', 'Quitar referencia');
      x.onpointerdown = e => e.stopPropagation(); x.onclick = e => { e.stopPropagation(); removeRef(r); };
      d.append(x); d.onpointerdown = e => startRef(e, r, d); d.onclick = e => e.stopPropagation(); layer.append(d);
    });
    emojiSize(); updateForm();
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
  panel.querySelectorAll('.pv-tab').forEach(t => t.onclick = () => {
    tab = t.dataset.t; if (selRef && (tab === 'f') === !!selRef.art) { selRef = null; mark(); }   // al cambiar de pestaña se suelta la referencia de otro tipo
    panel.querySelectorAll('.pv-tab').forEach(o => o.classList.toggle('on', o === t)); renderGrid(); updateForm();
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

  // El panel flota justo encima de la barra de abajo (y de la tira de páginas, si está abierta)
  const placePanel = () => {
    const pg = $('pages'), sb = stage.getBoundingClientRect(), bb = bar.getBoundingClientRect();
    panel.style.bottom = Math.max(8, sb.bottom - bb.top + 12 + (pg && !pg.hidden ? pg.offsetHeight + 8 : 0)) + 'px';
  };
  const setPanel = on => {
    if (on) placePanel();
    panel.hidden = !on; mbtn.classList.toggle('on', on); mbtn.setAttribute('aria-expanded', on);
  };
  mbtn.onclick = () => setPanel(panel.hidden);
  q('.pv-px').onclick = () => { setPanel(false); mbtn.focus(); };
  document.addEventListener('pointerdown', e => { if (selRef && !e.target.closest('.pv-ref,.pv-panel')) { selRef = null; mark(); updateForm(); } });
  renderGrid(); updateForm();

  // Teclado: con el panel o una referencia elegida, las teclas no tocan las imágenes
  document.addEventListener('keydown', e => {
    if (e.target.closest && e.target.closest('.pv-panel') && e.target.tagName === 'INPUT') {
      if (e.key === 'Escape') e.target.blur();
      if (e.key !== 'Tab') e.stopPropagation();
      return;
    }
    if (e.key === 'Escape' && !panel.hidden) { setPanel(false); e.stopImmediatePropagation(); return; }
    if ((e.key === 'Delete' || e.key === 'Backspace') && selRef && !/INPUT|SELECT|TEXTAREA/.test(document.activeElement.tagName)) {
      e.preventDefault(); removeRef(selRef); e.stopImmediatePropagation();
    }
  }, true);

  /* ---- Se engancha al dibujo de la hoja ---- */
  const fit0 = App.fit;       App.fit = () => { applyUnit(); fit0(); scheduleRuler(); emojiSize(); if (!panel.hidden) placePanel(); };
  const render0 = App.render; App.render = () => { render0(); updateInfo(); if (selRef && !refs().includes(selRef)) selRef = null; renderRefs(); scheduleRuler(); };
  const sel0 = App.refreshSel; App.refreshSel = () => { sel0(); scheduleRuler(); };
  new MutationObserver(updateInfo).observe(sheet, { childList: true });     // al agregar o quitar imágenes
  updateInfo();
})();
