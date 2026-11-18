/* Copia de documento: frente y reverso de una cédula, tarjeta o licencia, al tamaño real (8,56 × 5,4 cm), en una hoja */
(() => {
  const App = window.App, S = App.S;
  const CW = 85.6, CH = 54, PAD = 2.5, PX = 300 / 25.4, PW = 280;   // mm de la tarjeta · espacio alrededor (mm) · píxeles por mm al exportar · ancho de la vista
  const FW = CW + 2 * PAD, FH = CH + 2 * PAD;                      // cada cara ocupa su tarjeta más un poquito de espacio
  const PH = Math.round(PW * FH / FW);
  const slots = [
    { key: 'f', name: 'Frente', img: null, rot: 0, ox: 0, oy: 0, k: 1 },
    { key: 'r', name: 'Reverso', img: null, rot: 0, ox: 0, oy: 0, k: 1 }
  ];
  const st = { layout: 'v' };                                      // v = una sobre otra · h = lado a lado

  const st0 = document.createElement('style');
  st0.textContent = '.dc-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:16px;margin-top:14px}' +
    '.dc-slot{display:grid;gap:8px;justify-items:center;padding:12px;border-radius:16px;background:rgba(2,44,80,.14)}' +
    '.dc-slot canvas{display:block;max-width:100%;height:auto;background:#fff;touch-action:none;cursor:grab;box-shadow:0 0 0 2px var(--c4)}' +
    '.dc-slot canvas:active{cursor:grabbing}.dc-slot b{font-size:15px}' +
    '.dc-row{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px;width:100%}.dc-row .btn{margin:0;width:100%;padding:8px 8px;font-size:13px}' +
    '.dc-row .dc-del{grid-column:1/-1}' +
    '.dc-slot .cm-rotrow{margin-top:2px;gap:8px;flex-wrap:nowrap;width:100%}.dc-slot .cm-rail{flex:1;width:auto;min-width:0}' +
    '.dc-slot .cm-nudge{flex:none;width:38px;height:38px}.dc-zr{display:flex;justify-content:space-between;width:100%;font-size:13px;opacity:.85}' +
    '.dc-slot .dc-off{opacity:.45;pointer-events:none}.dc-slot canvas:focus-visible{outline:3px solid var(--c4);outline-offset:3px}' +
    '.dc-slot input[type=range]{width:100%}' +
    '.dc-opt{margin-top:14px}@media(max-width:700px){.dc-grid{grid-template-columns:1fr}}';
  document.head.append(st0);

  const M = document.createElement('div');
  M.className = 'cm'; M.id = 'docModal'; M.hidden = true;
  M.setAttribute('role', 'dialog'); M.setAttribute('aria-modal', 'true'); M.setAttribute('aria-label', 'Copia de documento');
  M.innerHTML =
    '<div class="cm-box cn-box"><h2>Copia de documento</h2>' +
    '<p class="note">Sube el frente y el reverso. Se recortan y enderezan solos (si la tarjeta está sobre un fondo liso; si traes las dos caras en una foto, también las separa) y la tarjeta queda al tamaño real (8,56 × 5,4 cm) con un poquito de espacio alrededor.</p>' +
    '<div class="dc-grid">' + slots.map(s =>
      '<div class="dc-slot" data-k="' + s.key + '"><b>' + s.name + '</b><canvas tabindex="0" width="' + PW + '" height="' + PH + '" aria-label="' + s.name + ' del documento"></canvas>' +
      '<div class="dc-row"><button class="btn pri" data-a="pick" type="button">Elegir foto</button><button class="btn" data-a="use" type="button">Usar la elegida de la hoja</button><button class="btn" data-a="rot" type="button" disabled>Girar</button><button class="btn" data-a="auto" type="button" disabled>Recorte automático</button><button class="btn dng dc-del" data-a="del" type="button" disabled>Quitar foto</button></div>' +
      '<div class="cm-rotrow dc-off"><button class="cm-nudge" data-a="rm" type="button" aria-label="Restar 0,1 grados" title="−0,1°">−</button>' +
      '<div class="cm-rail" data-a="rail" role="slider" tabindex="0" aria-label="Girar ' + s.name + '" aria-valuemin="-45" aria-valuemax="45" aria-valuenow="0" title="Arrastra para girar · Shift: de 5° en 5° · Doble clic: 0°"><div class="cm-track"><i class="cm-ticks"></i><i class="cm-mid"></i><span class="cm-badge">0°</span></div></div>' +
      '<button class="cm-nudge" data-a="rp" type="button" aria-label="Sumar 0,1 grados" title="+0,1°">+</button></div>' +
      '<div class="dc-zr"><span>Zoom</span><span data-a="zv">100%</span></div>' +
      '<input type="range" data-a="zoom" min="0" max="1000" step="1" value="0" aria-label="Zoom ' + s.name + '" disabled>' +
      '<input type="file" data-a="file" accept="image/*" hidden></div>').join('') +
    '</div>' +
    '<div class="dc-opt"><span class="lbl">Cómo quedan en la hoja</span>' +
    '<div class="seg" id="dcSeg"><button type="button" data-v="v">Una sobre otra</button><button type="button" data-v="h">Lado a lado</button></div>' +
    '<p class="note">Arrastra cada foto para encuadrarla (las flechas del teclado la mueven de a poco), usa la rueda del mouse o la barra para el zoom, y el riel para girarla de a décimas de grado. Después, en la hoja, puedes usar Recortar y el modo «Documento» para dejarlas limpias.</p></div>' +
    '<div class="cm-act"><button class="btn" id="dcClose" type="button">Cerrar</button><button class="btn pri" id="dcAdd" type="button" disabled>Agregar a la hoja</button></div></div>';
  document.body.append(M);

  const q = s => M.querySelector(s), bAdd = q('#dcAdd');
  const view = k => q('.dc-slot[data-k="' + k + '"]');
  slots.forEach(s => { s.el = view(s.key); s.cv = s.el.querySelector('canvas'); s.x = s.cv.getContext('2d'); });

  // Giro total = pasos de 90° (botón Girar) + ajuste fino del riel (-45° a 45°). La foto siempre cubre el marco, aunque esté girada.
  const rawOf = s => [s.img.naturalWidth || s.img.width, s.img.naturalHeight || s.img.height];
  function geo(s, w, h) {
    const [iw, ih] = rawOf(s), t = (s.rot + (s.ang || 0)) * Math.PI / 180, c = Math.abs(Math.cos(t)), n = Math.abs(Math.sin(t));
    const uw = (w * c + h * n) / 2, vh = (w * n + h * c) / 2, sc = Math.max(2 * uw / iw, 2 * vh / ih) * s.k;
    return { iw, ih, t, sc, au: Math.max(0, iw * sc / 2 - uw), av: Math.max(0, ih * sc / 2 - vh) };
  }
  function clamp(s, w, h) {
    const g = geo(s, w, h), co = Math.cos(g.t), si = Math.sin(g.t);
    let u = s.ox * co + s.oy * si, v = -s.ox * si + s.oy * co;
    u = Math.max(-g.au, Math.min(g.au, u)); v = Math.max(-g.av, Math.min(g.av, v));
    s.ox = u * co - v * si; s.oy = u * si + v * co;
  }
  // Dibuja la foto de una cara en un lienzo de w × h (ox y oy se guardan en píxeles de la vista; r las escala)
  function paint(s, g, w, h, r) {
    g.fillStyle = '#fff'; g.fillRect(0, 0, w, h);
    if (!s.img) return;
    const k = geo(s, w, h);
    g.save(); g.imageSmoothingQuality = 'high';
    g.translate(w / 2 + s.ox * r, h / 2 + s.oy * r); g.rotate(k.t);
    g.drawImage(s.img, -k.iw * k.sc / 2, -k.ih * k.sc / 2, k.iw * k.sc, k.ih * k.sc); g.restore();
  }
  function draw(s) {
    const w = s.cv.width, h = s.cv.height, g = s.x;
    if (s.img) clamp(s, w, h);
    paint(s, g, w, h, 1);
    if (!s.img) {
      g.fillStyle = '#6B6B6B'; g.font = '14px system-ui,sans-serif'; g.textAlign = 'center';
      g.fillText('Elige la foto del ' + s.name.toLowerCase(), w / 2, h / 2); g.textAlign = 'left';
    }
  }
  function sync() {
    slots.forEach(s => {
      s.el.querySelector('[data-a=zoom]').disabled = !s.img; s.el.querySelector('[data-a=rot]').disabled = !s.img;
      s.el.querySelector('.cm-rotrow').classList.toggle('dc-off', !s.img);
      const ab = s.el.querySelector('[data-a=auto]'); ab.disabled = !s.img; ab.textContent = s.cropped ? 'Ver original' : 'Recorte automático';
      s.el.querySelector('[data-a=del]').disabled = !s.img;
      s.el.querySelector('[data-a=use]').disabled = !(S.sel && App.byId(S.sel));
      draw(s);
    });
    bAdd.disabled = !slots.some(s => s.img);
    M.querySelectorAll('#dcSeg button').forEach(b => { const on = b.dataset.v === st.layout; b.classList.toggle('on', on); b.setAttribute('aria-pressed', on); });
  }
  /* ---- Recorte automático: busca el documento sobre un fondo parejo, lo endereza y lo deja horizontal ---- */
  const hullOf = pts => {
    pts.sort((a, b) => a[0] - b[0] || a[1] - b[1]);
    const cr = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]), lo = [], up = [];
    for (const p of pts) { while (lo.length >= 2 && cr(lo[lo.length - 2], lo[lo.length - 1], p) <= 0) lo.pop(); lo.push(p); }
    for (let i = pts.length - 1; i >= 0; i--) { const p = pts[i]; while (up.length >= 2 && cr(up[up.length - 2], up[up.length - 1], p) <= 0) up.pop(); up.push(p); }
    return lo.slice(0, -1).concat(up.slice(0, -1));
  };
  // Rectángulo más chico que cubre el contorno girado «deg» grados: [área, u0, u1, v0, v1]
  const boxAt = (H, deg) => {
    const a = deg * Math.PI / 180, co = Math.cos(a), si = Math.sin(a);
    let u0 = 1e9, u1 = -1e9, v0 = 1e9, v1 = -1e9;
    for (const [x, y] of H) { const u = x * co - y * si, v = x * si + y * co; if (u < u0) u0 = u; if (u > u1) u1 = u; if (v < v0) v0 = v; if (v > v1) v1 = v; }
    return [(u1 - u0) * (v1 - v0), u0, u1, v0, v1];
  };
  // Marca los píxeles vecinos (radio r) para unir los pedacitos de un mismo documento
  const grow = (m, w, h, r) => {
    const t = new Uint8Array(w * h), o = new Uint8Array(w * h), pre = new Int32Array(Math.max(w, h) + 1);
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) pre[x + 1] = pre[x] + m[y * w + x];
      for (let x = 0; x < w; x++) t[y * w + x] = pre[Math.min(w, x + r + 1)] - pre[Math.max(0, x - r)] > 0 ? 1 : 0;
    }
    for (let x = 0; x < w; x++) {
      for (let y = 0; y < h; y++) pre[y + 1] = pre[y] + t[y * w + x];
      for (let y = 0; y < h; y++) o[y * w + x] = pre[Math.min(h, y + r + 1)] - pre[Math.max(0, y - r)] > 0 ? 1 : 0;
    }
    return o;
  };
  // Devuelve una lista (0, 1 o 2) de lienzos con cada documento enderezado y acostado. Con dos, van en orden: izquierda→derecha o arriba→abajo.
  function findDocs(img) {
    const iw = img.naturalWidth || img.width, ih = img.naturalHeight || img.height, k = Math.min(1, 480 / Math.max(iw, ih));
    const w = Math.max(8, Math.round(iw * k)), h = Math.max(8, Math.round(ih * k));
    const t = document.createElement('canvas'); t.width = w; t.height = h;
    const g = t.getContext('2d', { willReadFrequently: true }); g.drawImage(img, 0, 0, w, h);
    const d = g.getImageData(0, 0, w, h).data, at = (x, y) => { const i = (y * w + x) * 4; return [d[i], d[i + 1], d[i + 2]]; };
    const border = [];
    for (let x = 0; x < w; x++) border.push(at(x, 0), at(x, h - 1));
    for (let y = 1; y < h - 1; y++) border.push(at(0, y), at(w - 1, y));
    const med = c => { const v = border.map(p => p[c]).sort((a, b) => a - b); return v[v.length >> 1]; };
    const bg = [med(0), med(1), med(2)], dist = (r, gg, b) => (r - bg[0]) ** 2 + (gg - bg[1]) ** 2 + (b - bg[2]) ** 2;
    if (border.filter(p => dist(p[0], p[1], p[2]) < 1600).length / border.length < .6) return [];      // el borde no es de un solo color
    const m = new Uint8Array(w * h);
    for (let p = 0; p < w * h; p++) { const i = p * 4; if (dist(d[i], d[i + 1], d[i + 2]) > 900) m[p] = 1; }       // diferente al fondo (también tarjetas claras)
    const big = grow(m, w, h, Math.max(2, Math.round(w * .012))), lab = new Int32Array(w * h), comps = [];
    for (let p0 = 0; p0 < w * h; p0++) {
      if (!big[p0] || lab[p0]) continue;
      const id = comps.length + 1, st = [p0]; lab[p0] = id; let n = 0;
      while (st.length) {
        const p = st.pop(); n++; const x = p % w, y = (p / w) | 0;
        if (x > 0 && big[p - 1] && !lab[p - 1]) { lab[p - 1] = id; st.push(p - 1); }
        if (x < w - 1 && big[p + 1] && !lab[p + 1]) { lab[p + 1] = id; st.push(p + 1); }
        if (y > 0 && big[p - w] && !lab[p - w]) { lab[p - w] = id; st.push(p - w); }
        if (y < h - 1 && big[p + w] && !lab[p + w]) { lab[p + w] = id; st.push(p + w); }
      }
      comps.push({ id, n });
    }
    comps.sort((a, b) => b.n - a.n);
    let keep = comps.filter(c => c.n >= w * h * .05).slice(0, 2);
    if (keep.length > 1 && keep[1].n < keep[0].n * .25) keep = keep.slice(0, 1);
    const docs = [];
    keep.forEach(c => {
      const rMin = new Int16Array(h).fill(-1), rMax = new Int16Array(h).fill(-1), cMin = new Int16Array(w).fill(-1), cMax = new Int16Array(w).fill(-1);
      for (let y = 0, p = 0; y < h; y++) for (let x = 0; x < w; x++, p++) {
        if (!m[p] || lab[p] !== c.id) continue;
        if (rMin[y] < 0) rMin[y] = x; rMax[y] = x; if (cMin[x] < 0) cMin[x] = y; cMax[x] = y;
      }
      const pts = [];
      for (let y = 0; y < h; y++) if (rMin[y] >= 0) pts.push([rMin[y], y], [rMax[y], y]);
      for (let x = 0; x < w; x++) if (cMin[x] >= 0) pts.push([x, cMin[x]], [x, cMax[x]]);
      if (pts.length < 8) return;
      const H = hullOf(pts); let best = 0, ba = boxAt(H, 0)[0];
      for (let a = -45; a <= 45; a += .5) { const q = boxAt(H, a)[0]; if (q < ba) { ba = q; best = a; } }
      for (let a = best - .5; a <= best + .5; a += .1) { const q = boxAt(H, a)[0]; if (q < ba) { ba = q; best = a; } }
      const [, u0, u1, v0, v1] = boxAt(H, best);
      if ((u1 - u0) * (v1 - v0) < w * h * .05) return;                       // muy chico: no parece un documento
      const a = best * Math.PI / 180, co = Math.cos(a), si = Math.sin(a), inset = .008;
      const cu = (u0 + u1) / 2, cv = (v0 + v1) / 2, cx = (co * cu + si * cv) / k, cy = (-si * cu + co * cv) / k;   // centro, en píxeles de la foto original
      const bw = (u1 - u0) * (1 - 2 * inset) / k, bh = (v1 - v0) * (1 - 2 * inset) / k;
      const f = Math.min(1, 2400 / Math.max(bw, bh)); let W = Math.max(1, Math.round(bw * f)), Hh = Math.max(1, Math.round(bh * f));
      const ca = CW / CH, lg = Math.max(bw, bh) / Math.min(bw, bh);
      if (lg > ca * .8 && lg < ca * 1.2) {                                   // se parece a una tarjeta: se ajusta a su proporción real, así llena el marco y no quedan lados blancos
        if (bw >= bh) Hh = Math.max(1, Math.round(W / ca)); else W = Math.max(1, Math.round(Hh / ca));
      }
      const fx = W / bw, fy = Hh / bh;
      const o = document.createElement('canvas'); o.width = W; o.height = Hh;
      const x = o.getContext('2d'); x.imageSmoothingQuality = 'high'; x.fillStyle = 'rgb(' + bg.join(',') + ')'; x.fillRect(0, 0, W, Hh);
      x.setTransform(co * fx, si * fy, -si * fx, co * fy, W / 2 - fx * (co * cx - si * cy), Hh / 2 - fy * (si * cx + co * cy));
      x.drawImage(img, 0, 0);
      let out = o;
      if (Hh > W) {                                                           // la tarjeta va acostada: si quedó de pie, se gira 90°
        out = document.createElement('canvas'); out.width = Hh; out.height = W;
        const y = out.getContext('2d'); y.translate(Hh / 2, W / 2); y.rotate(Math.PI / 2); y.drawImage(o, -W / 2, -Hh / 2);
      }
      const pad = Math.round(out.width * PAD / CW), pc = document.createElement('canvas');    // un poco de espacio blanco alrededor para que no quede cortada
      pc.width = out.width + 2 * pad; pc.height = out.height + 2 * pad;
      const pg = pc.getContext('2d'); pg.fillStyle = '#fff'; pg.fillRect(0, 0, pc.width, pc.height); pg.drawImage(out, pad, pad);
      docs.push({ cv: pc, cx: cx * k, cy: cy * k });
    });
    if (docs.length === 2) {
      const horiz = Math.abs(docs[0].cx - docs[1].cx) >= Math.abs(docs[0].cy - docs[1].cy);
      docs.sort((p, q) => horiz ? p.cx - q.cx : p.cy - q.cy);
    }
    return docs.map(x => x.cv);
  }
  const KMAX = 8, LK = Math.log(KMAX), fmt = v => (Math.round(v * 10) / 10).toString().replace('.', ',') + '°';
  const showAng = s => {                                                // riel y número del giro fino
    const rail = s.el.querySelector('[data-a=rail]'), bd = rail.querySelector('.cm-badge');
    bd.textContent = fmt(s.ang); bd.style.left = ((s.ang + 45) / 90 * 100) + '%'; rail.setAttribute('aria-valuenow', s.ang);
  };
  const setAng = (s, v) => { s.ang = Math.round(Math.max(-45, Math.min(45, +v || 0)) * 10) / 10; showAng(s); if (s.img) draw(s); };
  const setZoom = (s, k) => {                                           // zoom continuo de 100% a 800% (escala logarítmica: cada pixel de la barra cambia poquito)
    s.k = Math.max(1, Math.min(KMAX, k));
    s.el.querySelector('[data-a=zoom]').value = Math.round(Math.log(s.k) / LK * 1000);
    s.el.querySelector('[data-a=zv]').textContent = Math.round(s.k * 100) + '%'; if (s.img) draw(s);
  };
  const reset = s => { s.rot = 0; s.ang = 0; s.ox = s.oy = 0; showAng(s); setZoom(s, 1); };
  const setImage = (s, img, srcId) => {      // srcId: imagen de la hoja de donde salió la foto (se quita al agregar el documento)
    s.orig = img; s.img = img; s.cropped = false; s.srcId = srcId || null; reset(s);
    let docs = []; try { docs = findDocs(img); } catch (e) { docs = []; }
    if (docs.length === 2) {                                           // una sola foto con las dos caras: se reparten solas
      slots.forEach((o, i) => { o.orig = img; o.img = docs[i]; o.cropped = true; o.srcId = srcId || null; reset(o); });
      App.toast('Encontré las dos caras en la foto: puse frente y reverso.');
    } else if (docs.length === 1) { s.img = docs[0]; s.cropped = true; App.toast('Listo: recorté y enderecé el ' + s.name.toLowerCase() + '.'); }
    else App.toast('No encontré el documento sobre un fondo parejo. Lo dejé completo: arrástralo para encuadrarlo.');
    sync();
  };
  const toggleAuto = s => {
    if (!s.orig) return;
    if (s.cropped) { s.img = s.orig; s.cropped = false; reset(s); sync(); return; }
    let docs = []; try { docs = findDocs(s.orig); } catch (e) { docs = []; }
    if (!docs.length) { App.toast('No encontré el documento. Pon la tarjeta sobre una superficie lisa y de un solo color.'); return; }
    s.img = docs.length > 1 && s.key === 'r' ? docs[1] : docs[0]; s.cropped = true; reset(s); sync();
  };
  slots.forEach(s => {
    const e = s.el, file = e.querySelector('[data-a=file]'), zoom = e.querySelector('[data-a=zoom]');
    e.querySelector('[data-a=pick]').onclick = () => file.click();
    file.onchange = ev => {
      const f = ev.target.files[0]; ev.target.value = ''; if (!f) return;
      if (/hei[cf]/i.test(f.type + f.name)) { App.toast('Para HEIC: agrégala primero a la hoja y usa «Usar la elegida de la hoja».'); return; }
      if (!f.type.startsWith('image/')) { App.toast('Ese archivo no es una imagen.'); return; }
      const im = new Image(); im.onload = () => setImage(s, im); im.onerror = () => App.toast('No se pudo abrir «' + f.name + '».');
      im.src = URL.createObjectURL(f);
    };
    e.querySelector('[data-a=use]').onclick = () => { const it = S.sel && App.byId(S.sel); if (it && it.img) setImage(s, it.img, it.id); };
    e.querySelector('[data-a=rot]').onclick = () => { s.rot = (s.rot + 90) % 360; s.ox = s.oy = 0; setZoom(s, 1); };
    e.querySelector('[data-a=auto]').onclick = () => toggleAuto(s);
    e.querySelector('[data-a=del]').onclick = () => { s.img = s.orig = null; s.srcId = null; s.cropped = false; reset(s); sync(); App.toast(s.name + ': foto quitada.'); };
    zoom.oninput = () => setZoom(s, Math.exp(LK * zoom.value / 1000));
    s.cv.addEventListener('wheel', ev => { if (!s.img) return; ev.preventDefault(); setZoom(s, s.k * (ev.deltaY < 0 ? 1.03 : 1 / 1.03)); }, { passive: false });
    s.cv.addEventListener('keydown', ev => {                            // flechas: mover de a poco (Shift: más)
      if (!s.img) return; const d = ev.shiftKey ? 8 : 1.5, m = { ArrowLeft: [-d, 0], ArrowRight: [d, 0], ArrowUp: [0, -d], ArrowDown: [0, d] }[ev.key];
      if (!m) return; ev.preventDefault(); s.ox += m[0]; s.oy += m[1]; draw(s);
    });
    // Riel de giro (igual que en Recortar): arrastra, Shift = de 5° en 5°, Alt = sin imán al 0°, doble clic = 0°, rueda = 0,1°
    const rail = e.querySelector('[data-a=rail]'), trk = rail.querySelector('.cm-track'); let spin = false;
    const go = ev => {
      const r = trk.getBoundingClientRect(); let v = (Math.max(0, Math.min(1, (ev.clientX - r.left) / r.width)) * 2 - 1) * 45;
      if (ev.shiftKey) v = Math.round(v / 5) * 5; else if (!ev.altKey && Math.abs(v) <= .6) v = 0;
      setAng(s, v);
    };
    rail.addEventListener('pointerdown', ev => { if (!s.img) return; spin = true; rail.setPointerCapture(ev.pointerId); rail.querySelector('.cm-badge').classList.add('on'); go(ev); ev.preventDefault(); });
    rail.addEventListener('pointermove', ev => { if (spin) go(ev); });
    ['pointerup', 'pointercancel'].forEach(t => rail.addEventListener(t, () => { spin = false; rail.querySelector('.cm-badge').classList.remove('on'); }));
    rail.addEventListener('dblclick', () => setAng(s, 0));
    rail.addEventListener('wheel', ev => { if (!s.img) return; ev.preventDefault(); setAng(s, s.ang + (ev.deltaY < 0 ? .1 : -.1)); }, { passive: false });
    rail.addEventListener('keydown', ev => {
      const st = ev.shiftKey ? 1 : .1;
      if (ev.key === 'ArrowRight' || ev.key === 'ArrowUp') setAng(s, s.ang + st); else if (ev.key === 'ArrowLeft' || ev.key === 'ArrowDown') setAng(s, s.ang - st);
      else if (ev.key === 'Home' || ev.key === '0') setAng(s, 0); else return; ev.preventDefault();
    });
    [['rm', -1], ['rp', 1]].forEach(([a, dir]) => {                     // botones −/+: 0,1° por toque; si los mantienes, siguen cambiando
      const btn = e.querySelector('[data-a=' + a + ']'); let t1 = 0, t2 = 0; const step = () => setAng(s, s.ang + dir * .1), stop = () => { clearTimeout(t1); clearInterval(t2); };
      btn.addEventListener('pointerdown', ev => { ev.preventDefault(); step(); stop(); t1 = setTimeout(() => { t2 = setInterval(step, 70); }, 400); });
      ['pointerup', 'pointerleave', 'pointercancel'].forEach(t => btn.addEventListener(t, stop));
      btn.addEventListener('keydown', ev => { if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); step(); } });
    });
    let drag = null;
    s.cv.onpointerdown = ev => { if (!s.img) return; drag = { x: ev.clientX, y: ev.clientY, ox: s.ox, oy: s.oy }; s.cv.setPointerCapture(ev.pointerId); };
    s.cv.onpointermove = ev => {
      if (!drag) return; const r = s.cv.getBoundingClientRect(), f = s.cv.width / r.width;
      s.ox = drag.ox + (ev.clientX - drag.x) * f; s.oy = drag.oy + (ev.clientY - drag.y) * f; draw(s);
    };
    s.cv.onpointerup = s.cv.onpointercancel = () => { drag = null; };
  });
  q('#dcSeg').onclick = e => { const b = e.target.closest('button'); if (!b) return; st.layout = b.dataset.v; sync(); };

  // Cada cara lista, al tamaño real y a 300 ppp
  const photo = s => {
    const w = Math.round(FW * PX), h = Math.round(FH * PX), o = document.createElement('canvas'); o.width = w; o.height = h;
    paint(s, o.getContext('2d'), w, h, w / s.cv.width); return o;
  };
  const blobOf = c => new Promise(ok => c.toBlob(ok, 'image/png'));
  const loadImg = b => new Promise((ok, no) => { const im = new Image(); im.onload = () => ok(im); im.onerror = no; im.src = URL.createObjectURL(b); });

  // Agrega el documento a la hoja que estás trabajando (nunca crea otra página). Si la foto salió de una imagen de la hoja
  // («Usar la elegida de la hoja»), esa imagen original se quita y el documento ocupa su lugar.
  bAdd.onclick = async () => {
    const have = slots.filter(s => s.img); if (!have.length) return;
    App.dims();
    const m = S.margin, gap = 4, side = st.layout === 'h', g = Math.max(S.gap, 2);
    const tw = side ? 2 * FW + gap : FW, th = side ? FH : 2 * FH + gap;
    if (FW > S.W - 2 * m || FH > S.H - 2 * m) { App.toast('No caben en esta hoja. Cambia el papel o el margen.'); return; }
    const ids = new Set(have.map(s => s.srcId).filter(Boolean));
    const origs = S.items.filter(o => ids.has(o.id)), rest = S.items.filter(o => !origs.includes(o));
    // Busca dónde cabe un rectángulo w × h sin tocar ni tapar nada
    const fits = (x, y, w, h, taken) => x >= m - .01 && y >= m - .01 && x + w <= S.W - m + .01 && y + h <= S.H - m + .01 &&
      taken.every(o => x + w + g <= o.x + .01 || o.x + o.w + g <= x + .01 || y + h + g <= o.y + .01 || o.y + o.h + g <= y + .01);
    const uniq = a => [...new Set(a.map(v => Math.round(v * 100) / 100))].sort((a, b) => a - b);
    const find = (w, h, taken, first) => {
      for (const c of first) if (fits(c.x, c.y, w, h, taken)) return c;
      const xs = uniq([m, ...taken.map(o => o.x + o.w + g)]), ys = uniq([m, ...taken.map(o => o.y + o.h + g)]);
      for (const y of ys) for (const x of xs) if (fits(x, y, w, h, taken)) return { x, y };
      return null;
    };
    const taken = rest.map(o => ({ x: o.x, y: o.y, w: o.w, h: o.h }));
    const o0 = origs[0], clampX = v => Math.max(m, Math.min(S.W - m - tw, v)), clampY = v => Math.max(m, Math.min(S.H - m - th, v));
    const first = [o0 ? { x: clampX(o0.x), y: clampY(o0.y) } : null, { x: (S.W - tw) / 2, y: m }].filter(Boolean);      // primero donde estaba la original, luego arriba al centro
    const spot = tw <= S.W - 2 * m && th <= S.H - 2 * m ? find(tw, th, taken, first) : null;
    const pos = [];
    if (spot) have.forEach(s => { const i = slots.indexOf(s); pos.push({ x: side ? spot.x + i * (FW + gap) : spot.x, y: side ? spot.y : spot.y + i * (FH + gap) }); });
    else {      // el conjunto no cabe junto: se acomoda cada cara donde haya espacio
      for (const s of have) {
        const c = find(FW, FH, taken, []); if (!c) { App.toast('No hay espacio libre en esta hoja para el documento. Mueve o quita alguna imagen.'); return; }
        pos.push(c); taken.push({ x: c.x, y: c.y, w: FW, h: FH });
      }
    }
    let ims;
    try { ims = await Promise.all(have.map(async s => loadImg(await blobOf(photo(s))))); } catch (e) { App.toast('No se pudo preparar la foto. Prueba con otra imagen.'); return; }
    const wasManual = S.manual, pageNo = S.page, added = [], gone = origs.map(o => ({ it: o, i: S.items.indexOf(o) })).sort((a, b) => a.i - b.i);
    [...gone].reverse().forEach(g => { if (g.i >= 0) S.items.splice(g.i, 1); });      // se quita la imagen original
    have.forEach((s, j) => {
      const c = { id: 'i' + (++S.uid), name: 'Documento · ' + s.name, img: ims[j], src: ims[j].src, x: pos[j].x, y: pos[j].y, w: FW, h: FH, rot: 0, fit: 'cover', z: 1, fx: 0, fy: 0, l: App.nextLayer() };
      S.items.push(c); added.push(c);
    });
    have.forEach(s => { s.srcId = null; });
    S.manual = true; S.sel = null; S.group = []; close(); App.render();
    const msg = have.length === 2 ? 'Frente y reverso agregados a la hoja.' : have[0].name + ' agregado a la hoja.';
    if (gone.length) App.toast(msg + ' La imagen original se quitó.', 'Deshacer', () => {      // vuelve la original y se quita el documento
      if (S.page !== pageNo && S.pages[pageNo]) App.setPage(pageNo);
      added.forEach(c => { const k = S.items.indexOf(c); if (k >= 0) S.items.splice(k, 1); });
      gone.forEach(g => S.items.splice(Math.min(Math.max(g.i, 0), S.items.length), 0, g.it));
      S.manual = wasManual; S.sel = null; S.group = [];
      if (!S.manual) App.layout(); App.render();
    }); else App.toast(msg);
  };

  // Ctrl+V con esta ventana abierta: la imagen pegada entra en la primera cara vacía (no se agrega a la hoja por detrás)
  addEventListener('paste', e => {
    if (M.hidden) return;
    const f = [...((e.clipboardData && e.clipboardData.files) || [])].find(x => x.type && x.type.startsWith('image/'));
    if (!f) return;
    e.preventDefault(); e.stopPropagation();
    const s = slots.find(x => !x.img) || slots[0], im = new Image();
    im.onload = () => setImage(s, im); im.onerror = () => App.toast('No se pudo abrir la imagen pegada.');
    im.src = URL.createObjectURL(f);
  }, true);

  let last = null;
  function open() { last = document.activeElement; sync(); M.hidden = false; slots[0].el.querySelector('[data-a=pick]').focus(); }
  function close() { M.hidden = true; if (last && last.focus) last.focus(); }
  App.openDocumento = open;
  q('#dcClose').onclick = close;
  M.addEventListener('pointerdown', e => { if (e.target === M) close(); });
  addEventListener('keydown', e => { if (M.hidden) return; if (e.key === 'Escape') close(); e.stopPropagation(); }, true);

  // Botón en la barra de arriba, junto a Carnet
  const ref = document.getElementById('tCarnet');
  if (ref && !document.getElementById('tDoc')) {
    const b = document.createElement('button');
    b.className = 'xtab'; b.id = 'tDoc'; b.type = 'button'; b.setAttribute('aria-label', 'Copia de documento');
    b.innerHTML = '<svg viewBox="0 0 24 24"><rect x="4" y="3" width="16" height="8" rx="2"/><rect x="4" y="13" width="16" height="8" rx="2"/><path d="M8 7h8M8 17h8"/></svg><span class="lb">Documento</span>';
    b.onclick = open; ref.after(b);
  }
  sync();
})();
