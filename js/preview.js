/* Vista previa: la hoja en grande, como saldría impresa */
(() => {
  const App = window.App, S = App.S, $ = App.$;
  const ic = d => '<svg viewBox="0 0 24 24">' + d + '</svg>';
  const EYE = ic('<path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>');

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
    '<button class="pv-x" type="button" aria-label="Cerrar vista previa">' + ic('<path d="M6 6l12 12M18 6L6 18"/>') + '</button>' +
    '<button class="pv-nav pv-prev" type="button" aria-label="Página anterior">' + ic('<path d="M15 5l-7 7 7 7"/>') + '</button>' +
    '<div class="pv-box"><div class="pv-scene"><div class="pv-floor"></div><div class="pv-paper"><div class="pv-tilt"><div class="pv-face pv-front"><canvas></canvas></div><div class="pv-face pv-back"></div></div></div></div>' +
    '<div class="pv-cap"><span class="pv-txt"></span><button class="pv-flat" type="button" aria-pressed="false">Vista plana</button></div></div>' +
    '<button class="pv-nav pv-next" type="button" aria-label="Página siguiente">' + ic('<path d="M9 5l7 7-7 7"/>') + '</button>';
  document.body.append(ov);
  const cv = ov.querySelector('canvas'), paper = ov.querySelector('.pv-paper'), cap = ov.querySelector('.pv-txt');
  const tilt = ov.querySelector('.pv-tilt'), floor = ov.querySelector('.pv-floor'), faces = ov.querySelectorAll('.pv-face'), bflat = ov.querySelector('.pv-flat');
  const bx = ov.querySelector('.pv-x'), bp = ov.querySelector('.pv-prev'), bn = ov.querySelector('.pv-next');
  let list = [], cur = 0, isOpen = false, lastFocus = null, timer = 0;

  /* ---- 3D: arrastra para girar la hoja; la sombra y el brillo la siguen ---- */
  const REST = { x: 7, y: -14 };
  let rx = REST.x, ry = REST.y, vx = 0, vy = 0, drag = null, moved = false, raf = 0, flat = false;
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  const apply = () => {
    tilt.style.transform = 'rotateX(' + rx + 'deg) rotateY(' + ry + 'deg)';
    const a = clamp((Math.abs(rx) + Math.abs(Math.sin(ry * Math.PI / 180)) * 90) / 100, 0, 1);
    faces.forEach(f => { f.style.filter = 'brightness(' + (1 - clamp(a - .18, 0, 1) * .5) + ')'; });
    floor.style.transform = 'translate(' + (-Math.sin(ry * Math.PI / 180) * 70) + 'px,' + (34 + rx * 1.4) + 'px) scale(' + (1 - a * .1) + ')';
    floor.style.opacity = String(.85 - a * .35);
  };
  const setFlat = f => {
    flat = f; bflat.setAttribute('aria-pressed', f); bflat.textContent = f ? 'Vista 3D' : 'Vista plana';
    ov.classList.add('settle'); rx = f ? 0 : REST.x; ry = f ? 0 : REST.y; vx = vy = 0; apply();
    setTimeout(() => ov.classList.remove('settle'), 600);
  };
  const coast = () => {
    if (drag) { raf = 0; return; }
    vx *= .9; vy *= .9;
    if (Math.abs(vx) < .03 && Math.abs(vy) < .03) { raf = 0; return; }
    ry += vx; rx = clamp(rx + vy, -70, 70); apply(); raf = requestAnimationFrame(coast);
  };
  ov.addEventListener('pointerdown', e => {
    if (e.button || e.target.closest('button,.pv-cap')) return;
    drag = { x: e.clientX, y: e.clientY }; moved = false; vx = vy = 0; ov.classList.add('grabbing'); ov.classList.remove('settle');
    ov.setPointerCapture(e.pointerId);
  });
  ov.addEventListener('pointermove', e => {
    if (!drag) return;
    const dx = e.clientX - drag.x, dy = e.clientY - drag.y; drag.x = e.clientX; drag.y = e.clientY;
    if (Math.abs(dx) + Math.abs(dy) > 1) moved = true;
    vx = clamp(dx * .3, -4, 4); vy = clamp(-dy * .3, -4, 4); ry += dx * .3; rx = clamp(rx + -dy * .3, -60, 60); apply();
    if (flat) { flat = false; bflat.setAttribute('aria-pressed', false); bflat.textContent = 'Vista plana'; }
  });
  const endDrag = () => { if (!drag) return; drag = null; ov.classList.remove('grabbing'); if (!raf) raf = requestAnimationFrame(coast); };
  ov.addEventListener('pointerup', endDrag); ov.addEventListener('pointercancel', endDrag);
  ov.addEventListener('dblclick', e => { if (!e.target.closest('button,.pv-cap')) setFlat(!flat); });
  bflat.onclick = () => setFlat(!flat);

  const filled = () => { App.save(); return S.pages.filter(p => p.items.length); };

  // Mismo dibujo que al exportar a PNG/PDF, para que la vista previa sea fiel
  const draw = (items, k) => {
    cv.width = Math.round(S.W * k); cv.height = Math.round(S.H * k);
    const g = cv.getContext('2d'); g.imageSmoothingQuality = 'high';
    g.fillStyle = '#fff'; g.fillRect(0, 0, cv.width, cv.height);
    items.forEach(it => {
      App.clampCrop(it);
      const im = it.img, bw = it.w * k, bh = it.h * k, r = it.rot % 180 !== 0, iw = r ? bh : bw, ih = r ? bw : bh;
      g.save(); g.beginPath(); g.rect(it.x * k, it.y * k, bw, bh); g.clip();
      g.translate((it.x + it.w / 2) * k, (it.y + it.h / 2) * k); g.translate(it.fx * bw, it.fy * bh); g.rotate(it.rot * Math.PI / 180);
      const sc = (it.fit === 'cover' ? Math.max : Math.min)(iw / im.naturalWidth, ih / im.naturalHeight) * it.z;
      const dw = im.naturalWidth * sc, dh = im.naturalHeight * sc;
      g.drawImage(im, -dw / 2, -dh / 2, dw, dh); g.restore();
    });
  };

  const show = (dir) => {
    const p = list[cur], n = list.length;
    const availW = Math.max(200, innerWidth - (n > 1 ? 230 : 110)), availH = Math.max(200, innerHeight - 190);
    const s = Math.min(availW / S.W, availH / S.H);                       // px de pantalla por mm
    paper.style.width = Math.round(S.W * s) + 'px'; paper.style.height = Math.round(S.H * s) + 'px';
    const k = Math.min(s * Math.min(devicePixelRatio || 1, 2), 4000 / Math.max(S.W, S.H));
    draw(p.items, k);
    const paperName = $('paper').selectedOptions[0] ? $('paper').selectedOptions[0].textContent : '';
    cap.textContent = (n > 1 ? 'Hoja ' + (cur + 1) + ' de ' + n + ' · ' : '') + paperName + ' · ' + (S.W > S.H ? 'Horizontal' : 'Vertical') + ' · ' + p.items.length + (p.items.length === 1 ? ' imagen' : ' imágenes');
    bp.hidden = bn.hidden = n < 2; bp.disabled = cur === 0; bn.disabled = cur === n - 1;
    if (dir) { paper.classList.remove('flip-l', 'flip-r'); void paper.offsetWidth; paper.classList.add(dir > 0 ? 'flip-r' : 'flip-l'); }
  };
  const go = d => { const t = cur + d; if (t < 0 || t >= list.length) return; cur = t; show(d); };

  const open = () => {
    list = filled();
    if (!list.length) { App.toast('Primero agrega al menos una imagen.'); return; }
    const i = list.indexOf(S.pages[S.page]); cur = i < 0 ? 0 : i;
    clearTimeout(timer); lastFocus = document.activeElement; isOpen = true;
    rx = REST.x; ry = REST.y; vx = vy = 0; flat = false; bflat.setAttribute('aria-pressed', false); bflat.textContent = 'Vista plana'; apply();
    ov.hidden = false; show(0); void ov.offsetWidth; ov.classList.add('open'); document.body.classList.add('pv-lock');
    bx.focus();
  };
  const close = () => {
    if (!isOpen) return; isOpen = false; ov.classList.remove('open'); document.body.classList.remove('pv-lock');
    timer = setTimeout(() => { ov.hidden = true; cv.width = cv.height = 1; }, 280);
    if (lastFocus && lastFocus.focus) lastFocus.focus();
  };

  fab.onclick = open; bx.onclick = close; bp.onclick = () => go(-1); bn.onclick = () => go(1);
  ov.addEventListener('click', e => {
    if (moved) { moved = false; return; }
    if (e.target === ov || e.target.classList.contains('pv-box') || e.target.classList.contains('pv-scene')) close();
  });
  addEventListener('resize', () => { if (isOpen) show(0); });
  // Con la vista previa abierta, el teclado no toca las imágenes de atrás
  document.addEventListener('keydown', e => {
    if (!isOpen) return;
    if (e.key === 'Escape') close();
    else if (e.key === 'ArrowLeft') go(-1);
    else if (e.key === 'ArrowRight') go(1);
    else if (e.key === 'Tab') { const b = [bx, bp, bn].filter(x => !x.hidden && !x.disabled), i = b.indexOf(document.activeElement); e.preventDefault(); b[(i + (e.shiftKey ? -1 : 1) + b.length) % b.length].focus(); }
    e.stopImmediatePropagation();
  }, true);
})();
