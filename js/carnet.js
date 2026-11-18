/* Foto tipo carnet: acomoda la cara en el molde, elige el tamaño y manda las copias a la hoja */
(() => {
  const App = window.App, S = App.S;
  const DPI = 300, PX = DPI / 2.54, PW = 280;                       // PX: píxeles por cm al exportar; PW: ancho de la vista en pantalla
  const SIZES = [[3, 4, '3 × 4'], [3, 3, '3 × 3'], [3.5, 4.5, '3,5 × 4,5'], [2.5, 3, '2,5 × 3']];
  const st = { img: null, src: null, ox: 0, oy: 0, k: 1, base: 1, size: 0, copies: 8, cut: true };

  const M = document.createElement('div');
  M.className = 'cm'; M.id = 'carnetModal'; M.hidden = true;
  M.setAttribute('role', 'dialog'); M.setAttribute('aria-modal', 'true'); M.setAttribute('aria-label', 'Foto tipo carnet');
  M.innerHTML =
    '<div class="cm-box cn-box"><h2>Foto tipo carnet</h2>' +
    '<p class="note">Sube una foto, acomoda la cara dentro del óvalo y agrégala a la hoja o descárgala.</p>' +
    '<div class="cn-grid">' +
      '<div class="cn-stage"><canvas id="cnCv" aria-label="Foto con el molde de carnet"></canvas><small>Arrastra la foto para moverla. Ojos sobre la línea y cara dentro del óvalo.</small></div>' +
      '<div class="cn-side">' +
        '<button class="btn pri" id="cnPick" type="button">Elegir foto</button>' +
        '<button class="btn" id="cnUse" type="button">Usar la imagen elegida de la hoja</button>' +
        '<input id="cnFile" type="file" accept="image/*" hidden>' +
        '<span class="lbl">Tamaño (cm)</span><div class="cn-sizes" id="cnSizes"></div>' +
        '<span class="lbl">Zoom</span><input id="cnZoom" type="range" min="100" max="400" step="5" value="100" aria-label="Zoom de la foto" disabled>' +
        '<span class="lbl">Copias en la hoja</span>' +
        '<div class="step" id="cnStep"><button type="button" data-d="-1" aria-label="Menos copias">−</button><input type="text" inputmode="numeric" autocomplete="off" aria-label="Copias"><button type="button" data-d="1" aria-label="Más copias">+</button></div>' +
        '<label class="switch"><input type="checkbox" id="cnCut" checked><span>Líneas para recortar</span></label>' +
      '</div>' +
    '</div>' +
    '<div class="cm-act"><button class="btn" id="cnOne" type="button" disabled>Descargar 1 foto</button><button class="btn" id="cnClose" type="button">Cerrar</button><button class="btn pri" id="cnAdd" type="button" disabled>Agregar a la hoja</button></div></div>';
  document.body.append(M);

  const q = s => M.querySelector(s);
  const cv = q('#cnCv'), x = cv.getContext('2d'), zoom = q('#cnZoom'), inp = q('#cnStep input');
  const bOne = q('#cnOne'), bAdd = q('#cnAdd'), bUse = q('#cnUse');
  const chips = SIZES.map((s, i) => {
    const b = document.createElement('button'); b.type = 'button'; b.className = 'chip'; b.textContent = s[2];
    b.onclick = () => { st.size = i; dims(); fit(); draw(); syncUI(); };
    q('#cnSizes').append(b); return b;
  });
  const iw = () => st.img.naturalWidth || st.img.width, ih = () => st.img.naturalHeight || st.img.height;

  function dims() { const [w, h] = SIZES[st.size]; cv.width = PW; cv.height = Math.round(PW * h / w); }
  function fit() {
    if (!st.img) return;
    st.base = Math.max(cv.width / iw(), cv.height / ih()); st.k = 1; zoom.value = 100;
    st.ox = (cv.width - iw() * st.base) / 2; st.oy = (cv.height - ih() * st.base) * .4;
  }
  function clamp() {
    const s = st.base * st.k;
    st.ox = Math.min(0, Math.max(cv.width - iw() * s, st.ox));
    st.oy = Math.min(0, Math.max(cv.height - ih() * s, st.oy));
  }
  function draw() {
    const w = cv.width, h = cv.height;
    x.fillStyle = '#fff'; x.fillRect(0, 0, w, h);
    if (!st.img) {
      x.fillStyle = '#6B6B6B'; x.font = '14px system-ui,sans-serif'; x.textAlign = 'center';
      x.fillText('Elige una foto', w / 2, h / 2); x.textAlign = 'left';
    } else {
      clamp(); const s = st.base * st.k; x.drawImage(st.img, st.ox, st.oy, iw() * s, ih() * s);
    }
    const cx = w / 2, cy = h * .45, rx = w * .3, ry = h * .36;
    x.save(); x.fillStyle = document.documentElement.dataset.theme === 'light' ? 'rgba(0,0,0,.35)' : 'rgba(0,0,0,.45)'; x.beginPath(); x.rect(0, 0, w, h); x.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2); x.fill('evenodd'); x.restore();
    x.lineWidth = 2; x.strokeStyle = '#fff'; x.setLineDash([6, 5]);
    x.beginPath(); x.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2); x.stroke();
    x.beginPath(); x.moveTo(0, h * .4); x.lineTo(w, h * .4); x.stroke();
    x.beginPath(); x.moveTo(cx, 0); x.lineTo(cx, h); x.stroke();
    x.setLineDash([]); x.fillStyle = '#fff'; x.font = '12px system-ui,sans-serif'; x.fillText('ojos', 6, h * .4 - 5);
  }
  function syncUI() {
    chips.forEach((b, i) => { b.classList.toggle('on', i === st.size); b.setAttribute('aria-pressed', i === st.size); });
    inp.value = st.copies; zoom.disabled = !st.img; bOne.disabled = bAdd.disabled = !st.img;
    bUse.disabled = !(S.sel && App.byId(S.sel));
  }

  // Cargar la foto: archivo nuevo o la imagen elegida en la hoja
  function setImage(img, src) { st.img = img; st.src = src || null; fit(); draw(); syncUI(); }      // src: la imagen de la hoja de donde salió (se quita al agregar las fotos)
  q('#cnPick').onclick = () => q('#cnFile').click();
  q('#cnFile').onchange = e => {
    const f = e.target.files[0]; e.target.value = ''; if (!f) return;
    if (!f.type.startsWith('image/') || /hei[cf]/i.test(f.type) || /\.hei[cf]$/i.test(f.name)) {
      App.toast(/hei[cf]/i.test(f.type + f.name) ? 'Para HEIC: agrégala primero a la hoja y usa «Usar la imagen elegida».' : 'Ese archivo no es una imagen.'); return;
    }
    const url = URL.createObjectURL(f), im = new Image();
    im.onload = () => setImage(im); im.onerror = () => App.toast('No se pudo abrir «' + f.name + '».');
    im.src = url;
  };
  bUse.onclick = () => { const it = S.sel && App.byId(S.sel); if (it && it.img) setImage(it.img, { id: it.id }); };

  // Mover y acercar
  let drag = null;
  cv.onpointerdown = e => { if (!st.img) return; drag = { x: e.clientX, y: e.clientY, ox: st.ox, oy: st.oy }; cv.setPointerCapture(e.pointerId); };
  cv.onpointermove = e => {
    if (!drag) return; const r = cv.getBoundingClientRect(), f = cv.width / r.width;
    st.ox = drag.ox + (e.clientX - drag.x) * f; st.oy = drag.oy + (e.clientY - drag.y) * f; draw();
  };
  cv.onpointerup = cv.onpointercancel = () => { drag = null; };
  zoom.oninput = () => {
    const nk = zoom.value / 100, s0 = st.base * st.k, s1 = st.base * nk, mx = cv.width / 2, my = cv.height / 2;
    st.ox = mx - (mx - st.ox) * s1 / s0; st.oy = my - (my - st.oy) * s1 / s0; st.k = nk; draw();
  };

  // Copias y líneas de recorte
  const setCopies = v => { st.copies = Math.min(60, Math.max(1, Math.round(v) || 1)); inp.value = st.copies; };
  q('#cnStep').onclick = e => { const b = e.target.closest('button'); if (b) setCopies(st.copies + +b.dataset.d); };
  inp.addEventListener('focus', () => inp.select());
  inp.addEventListener('input', () => { inp.value = inp.value.replace(/[^0-9]/g, ''); });
  inp.addEventListener('change', () => setCopies(parseInt(inp.value, 10)));
  q('#cnCut').onchange = e => { st.cut = e.target.checked; };

  // La foto lista, al tamaño real y a 300 ppp
  function photo() {
    const [cw, ch] = SIZES[st.size], w = Math.round(cw * PX), h = Math.round(ch * PX), r = w / cv.width;
    const o = document.createElement('canvas'); o.width = w; o.height = h; const t = o.getContext('2d');
    t.fillStyle = '#fff'; t.fillRect(0, 0, w, h);
    const s = st.base * st.k * r; t.imageSmoothingQuality = 'high';
    t.drawImage(st.img, st.ox * r, st.oy * r, iw() * s, ih() * s);
    if (st.cut) { t.strokeStyle = '#9a9a9a'; t.lineWidth = 2; t.strokeRect(1, 1, w - 2, h - 2); }
    return o;
  }
  let dl = 0;
  bOne.onclick = async () => {
    if (!st.img) return;
    let c; try { c = photo(); } catch (e) { App.toast('No se pudo preparar la foto. Prueba con otra imagen.'); return; }
    // 1) Chrome/Edge: ventana «Guardar como», que funciona en cada clic (los navegadores limitan las descargas automáticas repetidas)
    if (window.showSaveFilePicker) {
      try {
        const h = await showSaveFilePicker({ suggestedName: 'foto-carnet.png', types: [{ description: 'Imagen PNG', accept: { 'image/png': ['.png'] } }] });
        const blob = await new Promise(ok => c.toBlob(ok, 'image/png'));
        const w = await h.createWritable(); await w.write(blob); await w.close();
        App.toast('Foto guardada'); return;
      } catch (e) { if (e && e.name === 'AbortError') return; }   // cancelaste: no pasa nada; otro error: se usa la descarga normal
    }
    // 2) Resto de navegadores: descarga normal con nombre distinto cada vez
    try {
      const u = c.toDataURL('image/png'), bin = atob(u.split(',')[1]), arr = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
      const url = URL.createObjectURL(new Blob([arr], { type: 'image/png' })), a = document.createElement('a');
      a.href = url; a.download = 'foto-carnet' + (dl++ ? '-' + dl : '') + '.png'; a.style.display = 'none';
      document.body.append(a); a.click();
      setTimeout(() => { a.remove(); URL.revokeObjectURL(url); }, 60000);
      App.toast('Descarga iniciada. Si no aparece el archivo, revisa los permisos de descargas del navegador.');
    } catch (e) { App.toast('No se pudo descargar la foto. Prueba con otra imagen.'); }
  };

  // Manda las copias a la hoja que estás trabajando: si ya tiene imágenes, las coloca en el espacio libre (no crea otra página)
  bAdd.onclick = () => {
    if (!st.img) return;
    const [cw, ch] = SIZES[st.size], w = cw * 10, h = ch * 10, want = st.copies;
    App.dims();
    const orig = st.src && S.items.find(o => o.id === st.src.id) || null;      // el original de la hoja: se quita al agregar las fotos
    const rest = S.items.filter(o => o !== orig);
    const m = S.margin, g = Math.max(S.gap, 2), pos = [];
    if (!rest.length) {
      // Hoja vacía: cuadrícula centrada
      const cols = Math.floor((S.W - 2 * m + g) / (w + g)), rows = Math.floor((S.H - 2 * m + g) / (h + g)), cap = cols * rows;
      if (cap < 1) { App.toast('La foto no cabe en esta hoja. Cambia el papel o el margen.'); return; }
      const n = Math.min(want, cap), x0 = (S.W - (cols * w + (cols - 1) * g)) / 2;
      for (let i = 0; i < n; i++) pos.push({ x: x0 + (i % cols) * (w + g), y: m + Math.floor(i / cols) * (h + g) });
    } else {
      // Hoja con imágenes: busca huecos libres (arriba-izquierda primero), sin tocar ni tapar nada
      const taken = rest.map(o => ({ x: o.x, y: o.y, w: o.w, h: o.h }));
      const clear = (x, y) => x >= m - .01 && y >= m - .01 && x + w <= S.W - m + .01 && y + h <= S.H - m + .01 &&
        taken.every(o => x + w + g <= o.x + .01 || o.x + o.w + g <= x + .01 || y + h + g <= o.y + .01 || o.y + o.h + g <= y + .01);
      const uniq = a => [...new Set(a.map(v => Math.round(v * 100) / 100))].sort((a, b) => a - b);
      while (pos.length < want) {
        const xs = uniq([m, ...taken.map(o => o.x + o.w + g)]), ys = uniq([m, ...taken.map(o => o.y + o.h + g)]);
        let spot = null;
        for (const y of ys) { for (const x of xs) if (clear(x, y)) { spot = { x, y }; break; } if (spot) break; }
        if (!spot) break;
        pos.push(spot); taken.push({ x: spot.x, y: spot.y, w, h });
      }
      if (!pos.length) { App.toast('No hay espacio libre en esta hoja para esa foto. Mueve o quita alguna imagen, o elige un tamaño más chico.'); return; }
    }
    const n = pos.length, onSheet = rest.length > 0;
    photo().toBlob(b => {
      const im = new Image();
      im.onload = () => {
        const wasManual = S.manual, at = orig ? S.items.indexOf(orig) : -1, added = [];
        if (orig && at >= 0) S.items.splice(at, 1);      // se quita el original
        pos.forEach(q => {
          const c = { id: 'i' + (++S.uid), name: 'Foto carnet', img: im, src: im.src, x: q.x, y: q.y,
                      w, h, rot: 0, fit: 'cover', z: 1, fx: 0, fy: 0, l: App.nextLayer() };
          S.items.push(c); added.push(c);
        });
        S.manual = true; S.sel = null; S.group = []; st.src = null; close(); App.render();
        const msg = n < want ? 'Caben ' + n + ' fotos' + (onSheet ? ' en el espacio libre' : ' en la hoja') + ' (pediste ' + want + ').' : n + (n === 1 ? ' foto agregada' : ' fotos agregadas') + ' a la hoja.';
        const pageNo = S.page;
        if (orig && at >= 0) App.toast(msg + ' El original se quitó.', 'Deshacer', () => {      // vuelve el original y se quitan las fotos
          if (S.page !== pageNo && S.pages[pageNo]) App.setPage(pageNo);
          added.forEach(c => { const k = S.items.indexOf(c); if (k >= 0) S.items.splice(k, 1); });
          S.items.splice(Math.min(at, S.items.length), 0, orig); S.manual = wasManual; S.sel = null; S.group = [];
          if (!S.manual) App.layout(); App.render();
        }); else App.toast(msg);
      };
      im.src = URL.createObjectURL(b);
    }, 'image/png');
  };

  // Abrir y cerrar
  let last = null;
  function open() {
    last = document.activeElement; dims(); if (st.img) fit(); draw(); syncUI(); M.hidden = false; q('#cnPick').focus();
  }
  function close() { M.hidden = true; if (last && last.focus) last.focus(); }
  App.openCarnet = open;
  q('#cnClose').onclick = close;
  M.addEventListener('pointerdown', e => { if (e.target === M) close(); });
  // Con la ventana abierta, el teclado no debe mover ni borrar imágenes de la hoja
  addEventListener('keydown', e => { if (M.hidden) return; if (e.key === 'Escape') close(); e.stopPropagation(); }, true);

  dims(); draw(); syncUI();
})();
