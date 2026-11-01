/* Recortar y modo escáner. Trabajan siempre sobre la imagen original (it.o) y generan una copia procesada
   en el navegador: nada se sube a ningún servidor y siempre se puede volver al original. */
(() => {
  const App = window.App, $ = App.$, S = App.S;
  const MAXSIDE = 3200;   // lado mayor de la copia procesada (A4 a ~250 ppp)

  /* ---- Filtros tipo escáner (sobre los píxeles RGBA) ---- */
  const lum = (r, g, b) => .299 * r + .587 * g + .114 * b;
  // Rango de tonos real de la imagen (percentil 1 y 99), para estirarlo a todo el rango
  const range = d => {
    const h = new Uint32Array(256), n = d.length / 4;
    for (let i = 0; i < d.length; i += 4) h[lum(d[i], d[i + 1], d[i + 2]) | 0]++;
    let lo = 0, hi = 255, a = 0;
    while (lo < 255 && (a += h[lo]) < n * .01) lo++;
    a = 0; while (hi > 0 && (a += h[hi]) < n * .01) hi--;
    lo = Math.min(lo, 110); hi = Math.max(hi, 140);   // no ennegrece un fondo gris ni apaga un blanco por una zona muy oscura o clara
    return hi - lo < 16 ? [0, 255] : [lo, hi];
  };
  const cl = v => v < 0 ? 0 : v > 255 ? 255 : v;
  const CURVE = new Uint8ClampedArray(256);   // curva en S suave: más contraste sin quemar
  for (let i = 0; i < 256; i++) { const t = i / 255, s = t * t * (3 - 2 * t); CURVE[i] = (t + (s - t) * .4) * 255; }
  const FX = {
    // «Mejorado»: aclara el fondo, sube contraste y un poco de color
    magic(d) {
      const [lo, hi] = range(d), k = 255 / (hi - lo);
      for (let i = 0; i < d.length; i += 4) {
        let r = cl((d[i] - lo) * k), g = cl((d[i + 1] - lo) * k), b = cl((d[i + 2] - lo) * k);
        const y = lum(r, g, b);
        d[i] = CURVE[cl(y + (r - y) * 1.15) | 0]; d[i + 1] = CURVE[cl(y + (g - y) * 1.15) | 0]; d[i + 2] = CURVE[cl(y + (b - y) * 1.15) | 0];
      }
    },
    // «Grises»: blanco y negro con todos los tonos, ya con el contraste estirado
    gray(d) {
      const [lo, hi] = range(d), k = 255 / (hi - lo);
      for (let i = 0; i < d.length; i += 4) d[i] = d[i + 1] = d[i + 2] = CURVE[cl((lum(d[i], d[i + 1], d[i + 2]) - lo) * k) | 0];
    },
    // «Documento»: solo blanco y negro; el umbral se calcula por zonas, así las sombras no manchan la hoja
    bw(d, w, h) {
      const W = w + 1, L = new Uint8Array(w * h), I = new Uint32Array(W * (h + 1));
      for (let y = 0, p = 0; y < h; y++) {
        let row = 0;
        for (let x = 0; x < w; x++, p++) { const q = p * 4; L[p] = lum(d[q], d[q + 1], d[q + 2]); row += L[p]; I[(y + 1) * W + x + 1] = I[y * W + x + 1] + row; }
      }
      const r = Math.max(8, Math.round(Math.max(w, h) / 24));
      for (let y = 0, p = 0; y < h; y++) {
        const y0 = Math.max(0, y - r), y1 = Math.min(h, y + r + 1);
        for (let x = 0; x < w; x++, p++) {
          const x0 = Math.max(0, x - r), x1 = Math.min(w, x + r + 1);
          const m = (I[y1 * W + x1] - I[y0 * W + x1] - I[y1 * W + x0] + I[y0 * W + x0]) / ((x1 - x0) * (y1 - y0));
          const v = (L[p] < 60 || L[p] < m * .9) ? 0 : 255, q = p * 4;
          d[q] = d[q + 1] = d[q + 2] = v;
        }
      }
    }
  };

  /* ---- Enderezar: gira la imagen original un ángulo libre (it.ang) sobre un lienzo blanco más grande ---- */
  const dim = s => [s.naturalWidth || s.width, s.naturalHeight || s.height];
  const straighten = (im, ang, cap) => {
    if (!ang) return im;
    const [nw, nh] = dim(im), a = ang * Math.PI / 180, c = Math.abs(Math.cos(a)), s = Math.abs(Math.sin(a));
    const bw = nw * c + nh * s, bh = nw * s + nh * c, k = Math.min(1, cap / Math.max(bw, bh));
    const cv = document.createElement('canvas'); cv.width = Math.max(1, Math.round(bw * k)); cv.height = Math.max(1, Math.round(bh * k));
    const g = cv.getContext('2d'); g.fillStyle = '#fff'; g.fillRect(0, 0, cv.width, cv.height); g.imageSmoothingQuality = 'high';
    g.translate(cv.width / 2, cv.height / 2); g.rotate(a); g.drawImage(im, -nw * k / 2, -nh * k / 2, nw * k, nh * k);
    return cv;
  };

  /* ---- Copia procesada: ángulo (it.ang) + recorte (it.cr) + filtro (it.flt) sobre el original ---- */
  let tk = 0;
  App.orig = it => it.o || (it.o = { img: it.img, src: it.src });
  App.rebuild = it => new Promise(done => {
    const o = App.orig(it), cr = it.cr, f = it.flt || 'none', ang = it.ang || 0, t = it._t = ++tk;
    if (!cr && f === 'none' && !ang) { it.img = o.img; it.src = o.src; return done(); }
    const im = straighten(o.img, ang, 4000), [nw, nh] = dim(im);
    const sx = cr ? cr.l * nw : 0, sy = cr ? cr.t * nh : 0;
    const sw = cr ? (1 - cr.l - cr.r) * nw : nw, sh = cr ? (1 - cr.t - cr.b) * nh : nh;
    const k = Math.min(1, MAXSIDE / Math.max(sw, sh)), w = Math.max(1, Math.round(sw * k)), h = Math.max(1, Math.round(sh * k));
    const c = document.createElement('canvas'); c.width = w; c.height = h;
    const g = c.getContext('2d', { willReadFrequently: f !== 'none' });
    g.drawImage(im, sx, sy, sw, sh, 0, 0, w, h);
    if (f !== 'none') { const id = g.getImageData(0, 0, w, h); FX[f](id.data, w, h); g.putImageData(id, 0, 0); }
    c.toBlob(b => {
      if (!b || it._t !== t) return done();
      const url = URL.createObjectURL(b), n = new Image();
      n.onload = () => { if (it._t === t) { it.img = n; it.src = url; } done(); };
      n.onerror = () => done(); n.src = url;
    }, 'image/png');
  });

  /* ---- Escáner: botones del panel ---- */
  const applyFilter = async f => {
    const ids = App.sels(); if (!ids.length) return;
    const wait = App.toast('Aplicando…');
    for (const id of ids) { const it = App.byId(id); if (it) { it.flt = f; await App.rebuild(it); } }
    wait.remove(); App.render();
  };
  document.querySelectorAll('[data-flt]').forEach(b => b.onclick = () => applyFilter(b.dataset.flt));
  const syncScan = () => {
    const it = App.byId(S.sel), f = (it && it.flt) || 'none';
    document.querySelectorAll('[data-flt]').forEach(b => b.classList.toggle('on', b.dataset.flt === f));
  };
  const rs = App.refreshSel; App.refreshSel = () => { rs(); syncScan(); };

  /* ---- Recortar: ventana con el original y un recuadro libre ---- */
  const M = $('cropModal'), cv = $('cmCanvas'), rect = $('cmRect'), wrap = $('cmWrap'), outer = $('cmOuter'), hs = $('cmHs');
  const rotBtn = $('cmRot'), badge = $('cmBadge');
  let it = null, c = null, dg = null, ang = 0, raw = 0;     // c = lo que se quita en cada lado, en fracciones, tal como se ve en la ventana
  const rot = () => ((it.rot % 360) + 360) % 360;
  // Ventana (con la imagen girada) <-> imagen original
  const toOrig = (d, r) => r === 0 ? { ...d } : r === 90 ? { t: d.r, r: d.b, b: d.l, l: d.t } : r === 180 ? { l: d.r, r: d.l, t: d.b, b: d.t } : { t: d.l, r: d.t, b: d.r, l: d.b };
  const toView = (o, r) => toOrig(o, (360 - r) % 360);
  const draw = () => {
    [rect.style, hs.style].forEach(s => {
      s.left = c.l * 100 + '%'; s.top = c.t * 100 + '%'; s.width = (1 - c.l - c.r) * 100 + '%'; s.height = (1 - c.t - c.b) * 100 + '%';
    });
  };
  const close = () => { M.hidden = true; it = null; dg = null; work = null; if (rq) { cancelAnimationFrame(rq); rq = 0; } };

  // Dibuja en la ventana la imagen original, enderezada (ang) y girada (rot).
  // Usa una copia liviana de la original y una sola pasada, para que girar se sienta fluido.
  let work = null, fillCol = '#fff', rq = 0;
  const makeWork = () => {
    const o = App.orig(it).img, [w, h] = dim(o), k = Math.min(1, 1400 / Math.max(w, h));
    if (k === 1) return o;
    const c2 = document.createElement('canvas'); c2.width = Math.max(1, Math.round(w * k)); c2.height = Math.max(1, Math.round(h * k));
    const g = c2.getContext('2d'); g.imageSmoothingQuality = 'high'; g.drawImage(o, 0, 0, c2.width, c2.height); return c2;
  };
  const paint = () => {
    if (!work) return;
    const r = rot(), [nw, nh] = dim(work), a = ang * Math.PI / 180, ca = Math.abs(Math.cos(a)), sa = Math.abs(Math.sin(a));
    const bw = nw * ca + nh * sa, bh = nw * sa + nh * ca;          // tamaño de la imagen enderezada
    const sw = r % 180 ? bh : bw, sh = r % 180 ? bw : bh, k = Math.min(1, 1000 / Math.max(sw, sh));
    cv.width = Math.max(1, Math.round(sw * k)); cv.height = Math.max(1, Math.round(sh * k));
    const g = cv.getContext('2d'); g.fillStyle = fillCol; g.fillRect(0, 0, cv.width, cv.height); g.save();
    g.imageSmoothingQuality = 'high'; g.translate(cv.width / 2, cv.height / 2); g.rotate((r + ang) * Math.PI / 180);
    g.drawImage(work, -nw * k / 2, -nh * k / 2, nw * k, nh * k); g.restore();
  };
  const queue = () => { if (!rq) rq = requestAnimationFrame(() => { rq = 0; paint(); }); };
  const RNG = 45; let tgt = 0, animCall = false, animId = 0;   // riel: de -45° a 45°
  const fmt = v => (Math.round(v * 10) / 10).toString().replace('.', ',') + '°';
  // Ángulo libre de -180° a 180°, de décima en décima; se pega a 0°, ±45°, ±90° y ±135° cuando estás muy cerca (Alt: sin imán)
  const setAng = (v, free, now) => {
    v = ((((+v || 0) + 180) % 360) + 360) % 360 - 180;
    raw = v;
    if (!free) { const n = Math.round(v / 45) * 45; if (Math.abs(v - n) <= 0.3) v = n; }
    ang = Math.round(v * 10) / 10; if (ang === 180) ang = -180;
    badge.textContent = fmt(ang); rotBtn.setAttribute('aria-valuenow', ang);
    badge.style.left = ((Math.max(-RNG, Math.min(RNG, ang)) + RNG) / (2 * RNG) * 100) + '%'; if (!animCall) tgt = ang;
    if (now) paint(); else queue();
  };

  App.openCrop = () => {
    it = App.byId(S.sel); if (!it) return;
    work = makeWork(); setAng(it.ang || 0, true, true);
    c = it.cr ? toView(it.cr, rot()) : { l: 0, t: 0, r: 0, b: 0 };
    M.hidden = false; draw(); $('cmOk').focus();
  };

  // Mover y cambiar el tamaño del recuadro (arrastrando dentro o los tiradores)
  outer.addEventListener('pointerdown', e => {
    const h = e.target.dataset.h || (rect.contains(e.target) ? 'm' : null); if (!h) return;
    const b = wrap.getBoundingClientRect();
    dg = { h, x: e.clientX, y: e.clientY, c: { ...c }, bw: b.width, bh: b.height };
    outer.setPointerCapture(e.pointerId); e.preventDefault();
  });
  outer.addEventListener('pointermove', e => {
    if (!dg) return;
    const dx = (e.clientX - dg.x) / dg.bw, dy = (e.clientY - dg.y) / dg.bh, o = dg.c, h = dg.h, MIN = .05, n = { ...o };
    if (h === 'm') {
      const w = 1 - o.l - o.r, hh = 1 - o.t - o.b;
      n.l = Math.max(0, Math.min(1 - w, o.l + dx)); n.r = 1 - w - n.l;
      n.t = Math.max(0, Math.min(1 - hh, o.t + dy)); n.b = 1 - hh - n.t;
    } else {
      if (h.includes('w')) n.l = Math.max(0, Math.min(1 - o.r - MIN, o.l + dx));
      if (h.includes('e')) n.r = Math.max(0, Math.min(1 - o.l - MIN, o.r - dx));
      if (h.includes('n')) n.t = Math.max(0, Math.min(1 - o.b - MIN, o.t + dy));
      if (h.includes('s')) n.b = Math.max(0, Math.min(1 - o.t - MIN, o.b - dy));
    }
    c = n; draw();
  });
  ['pointerup', 'pointercancel'].forEach(t => outer.addEventListener(t, () => { dg = null; }));

  // Riel amortiguado (debajo de la imagen): arrastra la píldora o toca el riel. El giro "sigue" suavemente al dedo.
  // Shift: de 5° en 5°. Alt: sin imán al 0°.
  let spin = null;
  const trk = rotBtn.querySelector('.cm-track');
  const tick = () => {
    animCall = true;
    const d = tgt - raw; raw = Math.abs(d) < .04 ? tgt : raw + d * .22;
    setAng(raw, true); animCall = false;
    animId = raw === tgt ? 0 : requestAnimationFrame(tick);
  };
  const go = e => {
    const r = trk.getBoundingClientRect();
    let v = (Math.max(0, Math.min(1, (e.clientX - r.left) / r.width)) * 2 - 1) * RNG;
    if (e.shiftKey) v = Math.round(v / 5) * 5; else if (!e.altKey && Math.abs(v) <= .6) v = 0;
    tgt = Math.round(v * 10) / 10; if (!animId) animId = requestAnimationFrame(tick);
  };
  rotBtn.addEventListener('pointerdown', e => {
    spin = true; rotBtn.setPointerCapture(e.pointerId); wrap.classList.add('grid'); badge.classList.add('on'); go(e); e.preventDefault();
  });
  rotBtn.addEventListener('pointermove', e => { if (spin) go(e); });
  ['pointerup', 'pointercancel'].forEach(t => rotBtn.addEventListener(t, () => { spin = null; wrap.classList.remove('grid'); badge.classList.remove('on'); }));
  // Botones −/+: 0,1° por toque; si los mantienes, siguen cambiando
  const nudge = (btn, dir) => {
    let t1 = 0, t2 = 0; const step = () => setAng(ang + dir * .1, true), stop = () => { clearTimeout(t1); clearInterval(t2); };
    btn.addEventListener('pointerdown', e => { e.preventDefault(); step(); stop(); t1 = setTimeout(() => { t2 = setInterval(step, 70); }, 400); });
    ['pointerup', 'pointerleave', 'pointercancel'].forEach(t => btn.addEventListener(t, stop));
    btn.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); step(); } });
  };
  nudge($('cmMinus'), -1); nudge($('cmPlus'), 1);
  rotBtn.addEventListener('dblclick', () => setAng(0, true));
  rotBtn.addEventListener('wheel', e => { e.preventDefault(); setAng(ang + (e.deltaY < 0 ? .1 : -.1), true); }, { passive: false });
  rotBtn.addEventListener('keydown', e => {
    const st = e.shiftKey ? 1 : .1;
    if (e.key === 'ArrowRight' || e.key === 'ArrowUp') setAng(ang + st, true);
    else if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') setAng(ang - st, true);
    else if (e.key === 'Home' || e.key === '0') setAng(0, true);
    else return;
    e.preventDefault();
  });

  /* ---- Recorte automático: busca el documento sobre un fondo parejo, lo endereza y lo recorta ---- */
  const hullOf = pts => {
    pts.sort((a, b) => a[0] - b[0] || a[1] - b[1]);
    const cr = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]), lo = [], up = [];
    for (const p of pts) { while (lo.length >= 2 && cr(lo[lo.length - 2], lo[lo.length - 1], p) <= 0) lo.pop(); lo.push(p); }
    for (let i = pts.length - 1; i >= 0; i--) { const p = pts[i]; while (up.length >= 2 && cr(up[up.length - 2], up[up.length - 1], p) <= 0) up.pop(); up.push(p); }
    return lo.slice(0, -1).concat(up.slice(0, -1));
  };
  const areaAt = (H, deg) => {   // área del rectángulo más chico que cubre el contorno girado deg grados
    const a = deg * Math.PI / 180, co = Math.cos(a), si = Math.sin(a);
    let x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9;
    for (const [x, y] of H) { const u = x * co - y * si, v = x * si + y * co; if (u < x0) x0 = u; if (u > x1) x1 = u; if (v < y0) y0 = v; if (v > y1) y1 = v; }
    return (x1 - x0) * (y1 - y0);
  };
  const detect = withTilt => {
    const w = cv.width, h = cv.height, d = cv.getContext('2d', { willReadFrequently: true }).getImageData(0, 0, w, h).data;
    const border = [], at = (x, y) => { const i = (y * w + x) * 4; return [d[i], d[i + 1], d[i + 2]]; };
    for (let x = 0; x < w; x++) border.push(at(x, 0), at(x, h - 1));
    for (let y = 1; y < h - 1; y++) border.push(at(0, y), at(w - 1, y));
    const med = ch => { const v = border.map(p => p[ch]).sort((a, b) => a - b); return v[v.length >> 1]; };
    const bg = [med(0), med(1), med(2)], dist = (r, g, b) => (r - bg[0]) ** 2 + (g - bg[1]) ** 2 + (b - bg[2]) ** 2;
    if (border.filter(p => dist(p[0], p[1], p[2]) < 1600).length / border.length < .6) return { err: 'fondo' };   // el borde no es de un solo color
    const m = new Uint8Array(w * h), rc = new Uint16Array(h), cc = new Uint16Array(w); let n = 0;
    for (let y = 0, p = 0; y < h; y++) for (let x = 0; x < w; x++, p++) {
      const i = p * 4;
      if (dist(d[i], d[i + 1], d[i + 2]) > 2304) { m[p] = 1; rc[y]++; cc[x]++; n++; }   // distinto del fondo (más de 48 de diferencia)
    }
    if (n < w * h * .02) return { err: 'vacio' };
    const minR = Math.max(3, Math.round(w * .01)), minC = Math.max(3, Math.round(h * .01));
    let x0 = w, x1 = -1, y0 = h, y1 = -1; const pts = [];
    for (let y = 0; y < h; y++) if (rc[y] >= minR) {
      let a = -1, b = -1; for (let x = 0; x < w; x++) if (m[y * w + x]) { if (a < 0) a = x; b = x; }
      if (y < y0) y0 = y; y1 = y; pts.push([a, y], [b, y]);
    }
    for (let x = 0; x < w; x++) if (cc[x] >= minC) {
      let a = -1, b = -1; for (let y = 0; y < h; y++) if (m[y * w + x]) { if (a < 0) a = y; b = y; }
      if (x < x0) x0 = x; x1 = x; pts.push([x, a], [x, b]);
    }
    if (x1 < 0 || y1 < 0) return { err: 'vacio' };
    const out = { bg, x0, x1, y0, y1, w, h, tilt: 0 };
    if (withTilt && pts.length > 8) {
      const H = hullOf(pts), a0 = areaAt(H, 0); let best = 0, ba = a0;
      for (let t = -30; t <= 30; t += .5) { const a = areaAt(H, t); if (a < ba) { ba = a; best = t; } }
      for (let t = best - .5; t <= best + .5; t += .1) { const a = areaAt(H, t); if (a < ba) { ba = a; best = t; } }
      if (Math.abs(best) >= .7 && ba < a0 * .985) out.tilt = Math.round(best * 10) / 10;
    }
    return out;
  };
  const autoCrop = () => {
    paint();
    let r = detect(true), tilt = 0;
    if (r.err) { App.toast(r.err === 'fondo' ? 'No encontré un fondo parejo. Pon el documento sobre una superficie lisa o recórtalo a mano.' : 'No encontré nada que recortar.'); return; }
    if (r.tilt) {
      tilt = r.tilt;
      // se endereza con el fondo de su propio color (así las esquinas nuevas no cuentan como documento) y se vuelve a medir
      fillCol = 'rgb(' + r.bg.join(',') + ')'; setAng(ang + r.tilt, true, true);
      const r2 = detect(false); fillCol = '#fff'; paint(); if (r2.err) return;
      r = r2;
    }
    const pad = .006, W = r.w, Hh = r.h;
    const n = { l: Math.max(0, r.x0 / W - pad), r: Math.max(0, 1 - (r.x1 + 1) / W - pad), t: Math.max(0, r.y0 / Hh - pad), b: Math.max(0, 1 - (r.y1 + 1) / Hh - pad) };
    if (n.l < .01 && n.r < .01 && n.t < .01 && n.b < .01 && !tilt) { App.toast('La imagen ya está recortada: no hay bordes que quitar.'); return; }
    c = n; draw();
    App.toast(tilt ? 'Listo: lo enderecé ' + fmt(tilt) + ' y lo recorté. Ajusta los bordes si hace falta.' : 'Listo: recorté los bordes. Ajusta los bordes si hace falta.');
  };
  $('cmAuto').onclick = autoCrop;

  $('cmReset').onclick = () => { c = { l: 0, t: 0, r: 0, b: 0 }; setAng(0, true); draw(); };
  $('cmCancel').onclick = close;
  M.addEventListener('pointerdown', e => { if (e.target === M) close(); });
  $('cmOk').onclick = async () => {
    const x = it, o = toOrig(c, rot());
    x.cr = ['l', 't', 'r', 'b'].every(k => o[k] < .002) ? null : { l: o.l, t: o.t, r: o.r, b: o.b };
    x.ang = ang || 0;
    x.z = 1; x.fx = 0; x.fy = 0; close();
    const wait = App.toast('Recortando…'); await App.rebuild(x); wait.remove();
    if (!S.manual) App.layout();        // el marco se ajusta a la nueva proporción
    App.render();
  };
  // Con la ventana abierta, el teclado no debe mover ni borrar imágenes de la hoja
  addEventListener('keydown', e => { if (M.hidden) return; if (e.key === 'Escape') close(); if (!M.contains(e.target)) e.stopPropagation(); }, true);
})();
