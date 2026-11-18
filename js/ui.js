/* Controles del panel, carga de archivos y avisos */
(() => {
  const App = window.App, $ = App.$, S = App.S, all = s => document.querySelectorAll(s);

  // Avisos: salen abajo a la derecha de la hoja (entre la barra de páginas y el panel derecho), duran poco y se colorean según el mensaje:
  // rojo = se quitó/borró algo o algo falló · verde = listo/guardado · azul = información
  const KIND = [
    ['err', /(borrad|quitad|eliminad|se quit[oó]|no se pudo\b|no hay |no encontr|no cabe|demasiado|no es una imagen|no es un proyecto|primero agrega|pesa(n)? m[aá]s|debe quedar|vac[ií]a|sin archivo)/i],
    ['ok', /(^listo|guardad|descargad|descarga iniciada|proyecto abierto|copiad|pegad|duplicad|movid|encontr[eé] las|restaurad)/i]
  ];
  const ICON = {
    err: '<path d="M12 8v5M12 16.5v.01"/><path d="M10.3 3.9L2.6 17.2A2 2 0 0 0 4.3 20h15.4a2 2 0 0 0 1.7-2.8L13.7 3.9a2 2 0 0 0-3.4 0z"/>',
    ok: '<circle cx="12" cy="12" r="9"/><path d="M8 12.5l3 3 5-6"/>',
    info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 8v.01"/>'
  };
  // Los avisos van arriba y centrados sobre la hoja (recortados al área visible del escenario)
  App.placeToasts = () => {
    const box = $('toasts'), st = $('stage'), sh = $('sheet'); if (!box || !st || !sh) return;
    const a = st.getBoundingClientRect(), b = sh.getBoundingClientRect();
    const l = Math.max(a.left, b.left), r = Math.min(a.right, b.right);
    if (r - l < 120) { box.style.left = box.style.right = box.style.top = ''; return; }      // hoja casi fuera de vista: centrado en el escenario
    box.style.left = (l - a.left) + 'px'; box.style.right = (a.right - r) + 'px';
    box.style.top = Math.max(14, Math.min(a.height - 70, b.top - a.top + 14)) + 'px';
  };
  addEventListener('resize', () => App.placeToasts());
  App.toast = (msg, label, fn) => {
    const box = $('toasts'), key = msg + '|' + (label || '');
    [...box.children].forEach(c => { if (c.dataset.tk === key) c.remove(); });      // un aviso igual no se apila: reemplaza al anterior
    const kind = (KIND.find(k => k[1].test(msg)) || ['info'])[0];
    const t = document.createElement('div'); t.className = 'toast ' + kind; t.dataset.tk = key;
    t.setAttribute('role', kind === 'err' ? 'alert' : 'status');
    t.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true">' + ICON[kind] + '</svg>';
    const s = document.createElement('span'); s.textContent = msg; t.append(s);
    if (label) { const b = document.createElement('button'); b.textContent = label; b.onclick = () => { fn(); t.remove(); }; t.append(b); }
    box.append(t); App.placeToasts();
    let timer = 0;
    const bye = () => { t.classList.add('out'); setTimeout(() => t.remove(), 260); };
    const arm = () => { clearTimeout(timer); timer = setTimeout(bye, label ? 5000 : 3200); };      // con «Deshacer» dura un poco más
    t.addEventListener('mouseenter', () => clearTimeout(timer)); t.addEventListener('mouseleave', arm);
    arm(); return t;
  };

  // HEIC/HEIF: se prueba (1) el navegador, (2) libheif-js y (3) heic2any; se baja solo si hace falta
  // Límites de seguridad: evitan que un archivo enorme o malicioso congele o agote la memoria del navegador
  const MAX_BYTES = 60 * 1024 * 1024, MAX_PIXELS = 150e6;
  const isHeic = f => /image\/hei[cf]/i.test(f.type) || /\.hei[cf]$/i.test(f.name);
  const canOpen = url => new Promise(ok => { const i = new Image(); i.onload = () => ok(true); i.onerror = () => ok(false); i.src = url; });
  const viaLibheif = async f => {
    const lh = await loadLib('lh', 'js/vendor/libheif-bundle-1.18.2.js', 'libheif');
    const im = new lh.HeifDecoder().decode(new Uint8Array(await f.arrayBuffer()))[0];
    if (!im) throw new Error('formato HEIC no reconocido');
    const w = im.get_width(), h = im.get_height();
    if (w * h > MAX_PIXELS) throw new Error('imagen demasiado grande');
    const c = document.createElement('canvas'); c.width = w; c.height = h;
    const ctx = c.getContext('2d'), id = ctx.createImageData(w, h);
    await new Promise((ok, no) => im.display(id, r => r ? ok() : no(new Error('no se pudo decodificar'))));
    ctx.putImageData(id, 0, 0); return canvasToURL(c);
  };
  const viaHeic2any = async f => {
    const conv = await loadLib('h2a', 'js/vendor/heic2any-0.0.4.min.js', 'heic2any');
    let out = await conv({ blob: f, toType: 'image/jpeg', quality: .92 });
    if (Array.isArray(out)) out = out[0];
    return URL.createObjectURL(out);
  };
  // La conversión HEIC corre en un marco aparte (heic/decoder.html) con sus propias reglas de seguridad
  let heicId = 0;
  const heicFrame = () => heicFrame.p || (heicFrame.p = new Promise((ok, no) => {
    const fr = document.createElement('iframe');
    fr.src = 'heic/decoder.html'; fr.hidden = true; fr.title = 'Conversor HEIC'; fr.setAttribute('aria-hidden', 'true');
    const fail = m => { heicFrame.p = null; removeEventListener('message', onMsg); fr.remove(); no(new Error(m)); };
    const t = setTimeout(() => fail('el conversor no respondió'), 15000);
    const onMsg = e => {
      if (e.source !== fr.contentWindow || e.origin !== location.origin || !e.data || !e.data.ready) return;
      clearTimeout(t); removeEventListener('message', onMsg); ok(fr);
    };
    addEventListener('message', onMsg); document.body.append(fr);
  }));
  const viaFrame = async f => {
    const fr = await heicFrame(), id = ++heicId;
    return new Promise((ok, no) => {
      const onMsg = e => {
        if (e.source !== fr.contentWindow || e.origin !== location.origin || !e.data || e.data.id !== id) return;
        removeEventListener('message', onMsg);
        e.data.blob instanceof Blob ? ok(URL.createObjectURL(e.data.blob)) : no(new Error(e.data.error || 'no se pudo convertir'));
      };
      addEventListener('message', onMsg); fr.contentWindow.postMessage({ id, file: f }, location.origin);
    });
  };
  const toBlobURL = async f => {
    const raw = URL.createObjectURL(f);
    if (!isHeic(f)) return raw;
    if (await canOpen(raw)) return raw;            // Safari lo abre directo
    URL.revokeObjectURL(raw);
    return viaFrame(f);
  };

  App.addFiles = list => {
    const imgs = [...list].filter(f => f.type.startsWith('image/') || isHeic(f));
    if (!imgs.length) { App.toast('Ese archivo no es una imagen.'); return; }
    const big = imgs.filter(f => f.size > MAX_BYTES), ok = imgs.filter(f => f.size <= MAX_BYTES);
    if (big.length) App.toast(big.length === 1 ? '«' + big[0].name + '» pesa más de 60 MB y se omitió.' : big.length + ' imágenes pesan más de 60 MB y se omitieron.');
    if (!ok.length) return;
    ok.forEach(async f => {
      let url;
      const wait = isHeic(f) ? App.toast('Convirtiendo «' + f.name + '»…') : null;
      try { url = await toBlobURL(f); if (wait) wait.remove(); } catch (e) { if (wait) wait.remove(); App.toast('No se pudo abrir «' + f.name + '»' + (e && e.message ? ' (' + e.message + ')' : '') + '.'); return; }
      const img = new Image();
      img.onload = () => {
        if (!img.naturalWidth || !img.naturalHeight || img.naturalWidth * img.naturalHeight > MAX_PIXELS) {
          URL.revokeObjectURL(url); App.toast('«' + f.name + '» tiene un tamaño no válido o demasiado grande.'); return;
        }
        const it = { id: 'i' + (++S.uid), name: f.name, img, src: img.src, x: 10, y: 10, w: 50, h: 50, rot: 0, fit: S.fit, z: 1, fx: 0, fy: 0, l: App.nextLayer() };
        S.items.push(it);
        if (!S.manual) App.layout();
        else { const k = S.items.length % 5; { const q = App.imgRatio(it), m = Math.min(60, S.W / 2); it.w = q >= 1 ? m : m * q; it.h = q >= 1 ? m / q : m; } it.x = 10 + k*6; it.y = 10 + k*6; }
        S.sel = it.id; App.render();
      };
      img.onerror = () => App.toast('No se pudo abrir «' + f.name + '».');
      img.src = url;
    });
  };

  // Refleja el estado en los controles
  App.syncUI = () => {
    all('[data-seg]').forEach(g => g.querySelectorAll('button').forEach(b => b.classList.toggle('on', b.dataset.v === S[g.dataset.seg])));
    all('[data-k]').forEach(g => { g.querySelector('input').value = S[g.dataset.k]; });
    all('[data-preset]').forEach(b => { const [c, r] = b.dataset.preset.split('x'); b.classList.toggle('on', +c === S.cols && +r === S.rows); });
    $('paper').value = S.paper;
    const n = S.items.length;
    $('count').textContent = n ? n + (n === 1 ? ' imagen en la hoja' : ' imágenes en la hoja') : 'Aún no hay imágenes';
  };

  all('[data-seg]').forEach(g => g.onclick = e => {
    const b = e.target.closest('button'); if (!b) return;
    const k = g.dataset.seg; S[k] = b.dataset.v;
    if (k === 'fit') S.pages.forEach(p => p.items.forEach(i => { i.fit = S.fit; }));
    App.change();
  });
  all('[data-k]').forEach(g => g.onclick = e => {
    const b = e.target.closest('button'); if (!b) return;
    const k = g.dataset.k, d = g.dataset;
    S[k] = Math.min(App.limit(k), Math.max(+d.min, S[k] + b.dataset.d * d.inc));
    if (k === 'cols' || k === 'rows') { App.keepOrder(); S.manual = false; }   // margen y espacio respetan lo que moviste a mano
    App.change();
  });
  // Escribir el valor con el teclado: Enter o salir del campo lo aplica, Esc cancela, ↑/↓ suben y bajan
  all('[data-k] input').forEach(inp => {
    const g = inp.closest('[data-k]'), k = g.dataset.k, int = k === 'cols' || k === 'rows';
    const apply = v => {
      if (isNaN(v)) { inp.value = S[k]; return; }
      S[k] = Math.min(App.limit(k), Math.max(+g.dataset.min, int ? Math.round(v) : Math.round(v * 10) / 10));
      if (int) { App.keepOrder(); S.manual = false; }
      App.change(); inp.value = S[k];
    };
    inp.addEventListener('focus', () => inp.select());
    inp.addEventListener('input', () => {
      let v = inp.value.replace(',', '.').replace(int ? /[^0-9]/g : /[^0-9.]/g, '');
      inp.value = int ? v : v.replace(/^([^.]*\.[^.]*)\..*$/, '$1');
    });
    inp.addEventListener('change', () => apply(parseFloat(inp.value)));
    inp.addEventListener('keydown', e => {
      if (e.key === 'Enter') { e.preventDefault(); inp.blur(); }
      else if (e.key === 'Escape') { inp.value = S[k]; inp.blur(); }
      else if (e.key === 'ArrowUp' || e.key === 'ArrowDown') { e.preventDefault(); apply((parseFloat(inp.value) || S[k]) + (e.key === 'ArrowUp' ? 1 : -1) * (!int && e.shiftKey ? 5 : 1)); }
    });
  });
  all('[data-preset]').forEach(b => b.onclick = () => {
    const [c, r] = b.dataset.preset.split('x'); S.cols = +c; S.rows = +r; App.keepOrder(); S.manual = false; App.change();
  });
  $('paper').onchange = e => { S.paper = e.target.value; App.change(); };
  $('bGrid').onclick = () => { App.keepOrder(); S.manual = false; App.change(); };
  $('snap').onchange = e => { S.snap = e.target.checked; };

  $('bRot').onclick = App.rotate;
  $('bDup').onclick = App.dup;    $('bDel').onclick = App.remove;
  $('bUp').onclick = () => App.layer('up');       $('bDown').onclick = () => App.layer('down');
  $('bTop').onclick = () => App.layer('top');     $('bBottom').onclick = () => App.layer('bottom');
  $('bClear').onclick = App.clearPage;

  // Encuadre: mover y acercar la imagen dentro de su marco
  $('bCrop').onclick = () => { if (S.sel) App.openCrop(); };

  // Cargar imágenes: botón, zona de arrastre, arrastrar y soltar, pegar
  $('bAdd').onclick = $('drop').onclick = () => $('file').click();
  $('file').onchange = e => { App.addFiles(e.target.files); e.target.value = ''; };
  const stage = $('stage'), sheet = $('sheet');
  // El aviso de «suelta aquí» se apaga solo: al soltar, al cancelar el arrastre o si dejan de llegar eventos de arrastre
  let overT = 0;
  const overOff = () => { clearTimeout(overT); sheet.classList.remove('over'); };
  stage.addEventListener('dragover', e => { if (![...(e.dataTransfer.types || [])].includes('Files')) return; e.preventDefault(); sheet.classList.add('over'); clearTimeout(overT); overT = setTimeout(overOff, 700); });
  stage.addEventListener('dragleave', e => { if (!e.relatedTarget || !stage.contains(e.relatedTarget)) overOff(); });
  stage.addEventListener('drop', e => { overOff(); if (!e.dataTransfer.files.length) return; e.preventDefault(); App.addFiles(e.dataTransfer.files); });
  ['drop', 'dragend'].forEach(t => addEventListener(t, overOff, true));
  addEventListener('paste', e => {
    const f = e.clipboardData && e.clipboardData.files; if (!f || !f.length) return;
    // si en el portapapeles hay un archivo que no es imagen y se acaba de copiar una imagen de la hoja, gana la de la hoja (la maneja interactions.js)
    if (App.clip && App.clip.length && ![...f].some(x => x.type.startsWith('image/') || isHeic(x))) return;
    App.addFiles(f);
  });

  // Riel izquierdo: elegir sección; pulsar la activa pliega el panel
  const B = document.body, tabs = all('.tab');
  function applyTab() {
    tabs.forEach(t => { const on = !B.classList.contains('min') && t.dataset.tab === B.dataset.tab; t.classList.toggle('on', on); t.setAttribute('aria-pressed', on); });
    all('[data-pane]').forEach(p => { p.hidden = p.dataset.pane !== B.dataset.tab; });
    placePill(); App.render();
  }
  // La píldora se desliza hasta la pestaña elegida
  function placePill() {
    const pill = $('pill'), on = document.querySelector('.tab.on');
    pill.style.opacity = on ? 1 : 0;
    if (on) { pill.style.left = on.offsetLeft + 'px'; pill.style.width = on.offsetWidth + 'px'; }
    requestAnimationFrame(() => pill.classList.add('anim'));
  }
  addEventListener('resize', placePill); addEventListener('load', placePill);
  if (document.fonts) document.fonts.ready.then(placePill);
  tabs.forEach(t => t.onclick = () => {
    const same = t.dataset.tab === B.dataset.tab && !B.classList.contains('min');
    B.classList.toggle('min', same); B.dataset.tab = t.dataset.tab; applyTab();
  });
  B.dataset.tab = 'hoja'; applyTab();
})();
