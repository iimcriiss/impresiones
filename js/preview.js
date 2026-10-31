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
    '<span class="pv-mode"><button class="pv-m" data-g="0" type="button" aria-pressed="true">Color</button><button class="pv-m" data-g="1" type="button" aria-pressed="false">Blanco y negro</button></span></div>' +
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

  // Regla alrededor de la hoja (sigue el zoom y el movimiento)
  const drawRulers = () => {
    rraf = 0;
    const on = isOpen && S.ruler;
    ov.classList.toggle('pv-rulers', on); if (!on) return;
    const r = paper.getBoundingClientRect(), ppm = r.width / S.W;
    App.drawRuler(rh, { start: r.left - rh.getBoundingClientRect().left, ppm, len: S.W, margin: S.margin });
    App.drawRuler(rv, { vertical: true, start: r.top - rv.getBoundingClientRect().top, ppm, len: S.H, margin: S.margin });
  };
  const scheduleRuler = () => { if (!rraf) rraf = requestAnimationFrame(drawRulers); };

  // Zoom: rueda del mouse, botones o doble clic; con zoom se arrastra para mover la hoja
  const applyView = () => {
    scene.style.transform = 'translate(' + panX + 'px,' + panY + 'px) scale(' + z + ')';
    zv.textContent = Math.round(z * 100) + '%'; zout.disabled = z <= 1.001; zin.disabled = z >= MAXZ - .001;
    ov.classList.toggle('zoomed', z > 1); scheduleRuler();
  };
  const clampPan = () => { const w = paper.offsetWidth * z / 2, h = paper.offsetHeight * z / 2; panX = clamp(panX, -w, w); panY = clamp(panY, -h, h); };
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
  zv.onclick = () => zoomAt(1, ...mid(), true);
  ov.addEventListener('wheel', e => { if (!isOpen) return; e.preventDefault(); zoomAt(z * Math.exp(-e.deltaY * .0015), e.clientX, e.clientY); }, { passive: false });
  ov.addEventListener('dblclick', e => { if (!e.target.closest('button,.pv-cap')) zoomAt(z > 1 ? 1 : 2.5, e.clientX, e.clientY, true); });

  ov.addEventListener('pointerdown', e => {
    if (e.button > 1 || e.target.closest('button,.pv-cap')) return;
    downOn = e.target; moved = false;
    if (z <= 1) return;
    e.preventDefault(); drag = { x: e.clientX, y: e.clientY };
    ov.classList.add('grabbing'); ov.setPointerCapture(e.pointerId);
  });
  ov.addEventListener('pointermove', e => {
    if (!drag) return;
    const dx = e.clientX - drag.x, dy = e.clientY - drag.y; drag.x = e.clientX; drag.y = e.clientY;
    if (Math.abs(dx) + Math.abs(dy) > 1) moved = true;
    panX += dx; panY += dy; clampPan(); applyView();
  });
  const endDrag = () => { drag = null; ov.classList.remove('grabbing'); };
  ov.addEventListener('pointerup', endDrag); ov.addEventListener('pointercancel', endDrag);

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
    redraw();
    const paperName = $('paper').selectedOptions[0] ? $('paper').selectedOptions[0].textContent : '';
    cap.textContent = (n > 1 ? 'Hoja ' + (cur + 1) + ' de ' + n + ' · ' : '') + paperName + ' · ' + (S.W > S.H ? 'Horizontal' : 'Vertical') + ' · ' + p.items.length + (p.items.length === 1 ? ' imagen' : ' imágenes');
    bp.hidden = bn.hidden = n < 2; bp.disabled = cur === 0; bn.disabled = cur === n - 1;
    if (dir) { paper.classList.remove('flip-l', 'flip-r'); void paper.offsetWidth; paper.classList.add(dir > 0 ? 'flip-r' : 'flip-l'); }
    clampPan(); applyView();
  };
  const go = d => { const t = cur + d; if (t < 0 || t >= list.length) return; cur = t; show(d); };

  const open = () => {
    list = filled();
    if (!list.length) { App.toast('Primero agrega al menos una imagen.'); return; }
    const i = list.indexOf(S.pages[S.page]); cur = i < 0 ? 0 : i;
    clearTimeout(timer); lastFocus = document.activeElement; isOpen = true;
    z = 1; panX = panY = 0; setGray(S.gray);
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
    if (e.key === 'Escape') close();
    else if (e.key === 'ArrowLeft') go(-1);
    else if (e.key === 'ArrowRight') go(1);
    else if (e.key === '+' || e.key === '=') zoomAt(z * 1.4, ...mid(), true);
    else if (e.key === '-') zoomAt(z / 1.4, ...mid(), true);
    else if (e.key === '0') zoomAt(1, ...mid(), true);
    else if (e.key === 'Tab') {
      const b = [...ov.querySelectorAll('button')].filter(x => !x.hidden && !x.disabled), i = b.indexOf(document.activeElement);
      e.preventDefault(); b[(i + (e.shiftKey ? -1 : 1) + b.length) % b.length].focus();
    }
    e.stopImmediatePropagation();
  }, true);
})();
