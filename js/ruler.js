/* Regla tipo Word (en cm, con marcas cada mm): en la hoja y, en vista plana, en la vista previa */
(() => {
  const App = window.App, S = App.S, $ = App.$;
  S.ruler = true;
  const RUL = 22;                                           // grosor de la regla en px
  const css = n => getComputedStyle(document.documentElement).getPropertyValue(n).trim();

  // Dibuja una regla en un <canvas>. o = { vertical, start (px donde empieza la hoja), ppm (px por mm), len (mm), margin (mm), band: [mm, mm], hover: mm }
  App.drawRuler = (cv, o) => {
    const dpr = Math.min(devicePixelRatio || 1, 2), w = cv.clientWidth, h = cv.clientHeight;
    if (!w || !h) return;
    if (cv.width !== Math.round(w * dpr) || cv.height !== Math.round(h * dpr)) { cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr); }
    const g = cv.getContext('2d'); g.setTransform(dpr, 0, 0, dpr, 0, 0); g.clearRect(0, 0, w, h);
    const v = !!o.vertical, L = v ? h : w, T = v ? w : h, ppm = o.ppm;
    const R = (a0, a1, col) => { a0 = Math.max(0, a0); a1 = Math.min(L, a1); if (a1 <= a0) return; g.fillStyle = col; if (v) g.fillRect(0, a0, T, a1 - a0); else g.fillRect(a0, 0, a1 - a0, T); };
    const Ln = (a, c0, c1, col, lw) => { g.strokeStyle = col; g.lineWidth = lw || 1; g.beginPath(); if (v) { g.moveTo(c0, a); g.lineTo(c1, a); } else { g.moveTo(a, c0); g.lineTo(a, c1); } g.stroke(); };
    const c2 = css('--c2'), c3 = css('--c3'), c5 = css('--c5'), c6 = css('--c6');
    const s0 = o.start, s1 = o.start + o.len * ppm, m = o.margin * ppm;
    R(0, L, c2); R(s0, s1, '#fff');                          // fuera de la hoja / hoja
    R(s0, s0 + m, c3); R(s1 - m, s1, c3);                    // márgenes
    if (o.band) { R(s0 + o.band[0] * ppm, s0 + o.band[1] * ppm, 'rgba(88,161,211,.55)'); Ln(s0 + o.band[0] * ppm, 0, T, c5); Ln(s0 + o.band[1] * ppm, 0, T, c5); }
    // marcas: 1 mm (si caben), 5 mm y 10 mm con número en cm
    const i0 = Math.max(0, Math.floor(-s0 / ppm) - 1), i1 = Math.min(Math.ceil(o.len), Math.ceil((L - s0) / ppm) + 1);
    const every = ppm * 10 >= 26 ? 1 : ppm * 10 >= 13 ? 2 : 5;
    g.font = '600 10px system-ui, -apple-system, "Segoe UI", sans-serif'; g.fillStyle = c6; g.textAlign = 'center'; g.textBaseline = 'middle';
    for (let i = i0; i <= i1; i++) {
      const a = s0 + i * ppm; if (a < -1 || a > L + 1) continue;
      const big = i % 10 === 0, mid = i % 5 === 0;
      if (!big && !mid && ppm < 1.8) continue;
      if (!big && ppm < .9) continue;
      const len = big ? 9 : mid ? 6 : 3;
      Ln(a + .5, T - len, T, c6, 1);
      if (big && (i / 10) % every === 0) g.fillText(String(i / 10), v ? T / 2 - 2 : a, v ? a : T / 2 - 3);
    }
    if (o.hover != null) Ln(s0 + o.hover * ppm, 0, T, c5, 1.5);
    g.fillStyle = 'rgba(2,44,80,.3)'; if (v) g.fillRect(T - 1, 0, 1, L); else g.fillRect(0, T - 1, L, 1);
  };

  /* ---- Regla en la hoja ---- */
  const main = $('stage'), cvs = $('canvas'), sheet = $('sheet');
  const mkc = cls => { const c = document.createElement('canvas'); c.className = 'rul ' + cls; main.append(c); return c; };
  const rh = mkc('rul-h'), rv = mkc('rul-v'), corner = document.createElement('div');
  corner.className = 'rul-corner'; corner.textContent = 'cm'; main.append(corner);
  main.classList.add('rulers');

  let raf = 0, mx = null, my = null;
  const draw = () => {
    raf = 0; if (!S.ruler) return;
    const mr = main.getBoundingClientRect(), sr = sheet.getBoundingClientRect(), ppm = sr.width / S.W;
    if (!ppm) return;
    rh.style.width = Math.max(0, cvs.clientWidth - RUL) + 'px'; rv.style.height = Math.max(0, cvs.clientHeight - RUL) + 'px';
    const its = App.sels().map(App.byId).filter(Boolean);
    const bx = its.length ? [Math.min(...its.map(i => i.x)), Math.max(...its.map(i => i.x + i.w))] : null;
    const by = its.length ? [Math.min(...its.map(i => i.y)), Math.max(...its.map(i => i.y + i.h))] : null;
    App.drawRuler(rh, { start: sr.left - mr.left - RUL, ppm, len: S.W, margin: S.margin, band: bx, hover: mx == null ? null : (mx - sr.left) / ppm });
    App.drawRuler(rv, { vertical: true, start: sr.top - mr.top - RUL, ppm, len: S.H, margin: S.margin, band: by, hover: my == null ? null : (my - sr.top) / ppm });
  };
  const schedule = () => { if (!raf) raf = requestAnimationFrame(draw); };

  // La hoja se ajusta al espacio que deja la regla
  App.fit = () => {
    const x = S.ruler ? RUL : 0;
    const aw = cvs.clientWidth - 32 - x;
    const ah = matchMedia('(min-width:1101px)').matches ? cvs.clientHeight - 32 - x : 1e9;
    const s = Math.max(.5, Math.min(aw / S.W, ah / S.H)) * S.zoom / 100;
    sheet.style.width = S.W * s + 'px'; sheet.style.height = S.H * s + 'px';
    schedule();
  };
  ['render', 'refreshSel', 'syncFields'].forEach(n => { const f = App[n]; App[n] = (...a) => { const r = f(...a); schedule(); return r; }; });

  cvs.addEventListener('scroll', schedule, { passive: true });
  cvs.addEventListener('pointermove', e => { mx = e.clientX; my = e.clientY; schedule(); });
  cvs.addEventListener('pointerleave', () => { mx = my = null; schedule(); });
  addEventListener('resize', schedule);
  if (window.ResizeObserver) { const ro = new ResizeObserver(schedule); ro.observe(cvs); ro.observe(sheet); }

  // Botón para mostrar u ocultar la regla (en la barra de zoom)
  const btn = document.createElement('button');
  btn.id = 'bRuler'; btn.type = 'button'; btn.className = 'pbtn on'; btn.title = 'Mostrar u ocultar la regla';
  btn.innerHTML = '<svg viewBox="0 0 24 24"><rect x="3" y="8" width="18" height="8" rx="1.5"/><path d="M7 8v3M11 8v4M15 8v3M19 8v4" transform="translate(-1 0)"/></svg>Regla';
  btn.setAttribute('aria-pressed', 'true');
  btn.onclick = () => {
    S.ruler = !S.ruler; btn.classList.toggle('on', S.ruler); btn.setAttribute('aria-pressed', S.ruler);
    main.classList.toggle('rulers', S.ruler); App.fit(); schedule();
  };
  $('bPages').after(btn);
})();
