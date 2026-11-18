/* Espejo y bordes: voltear la imagen (papel de transferencia) y redondear las esquinas / poner un trazo blanco (stickers).
   Aquí viven los botones del panel «Imagen elegida» y el dibujo (pantalla, impresión y exportación). Los estilos están en css/components.css. Se carga después de scan.js. */
(() => {
  const App = window.App, S = App.S, $ = App.$;
  const ic = d => '<svg viewBox="0 0 24 24">' + d + '</svg>';

  // Panel «Imagen elegida»: Espejo y Bordes van con Girar / Recortar / Duplicar / Quitar.
  // «Bordes» es un botón desplegable: siempre está activo, solo se ajusta cuánto redondea y qué tan grueso es el trazo.
  const mir = document.createElement('button');
  mir.className = 'act'; mir.id = 'bMir'; mir.type = 'button'; mir.setAttribute('aria-pressed', 'false');
  mir.title = 'Voltea la imagen para papel de transferencia (camisetas, tazas)';
  mir.innerHTML = ic('<path d="M12 3v18" stroke-dasharray="2 3"/><path d="M8 7L3 17h5z"/><path d="M16 7l5 10h-5z"/>') + 'Espejo';
  const tog = document.createElement('button');
  tog.className = 'act'; tog.id = 'bBord'; tog.type = 'button'; tog.setAttribute('aria-expanded', 'false'); tog.setAttribute('aria-controls', 'styleTools');
  tog.title = 'Redondea las esquinas y agrega un trazo blanco (stickers)';
  tog.innerHTML = ic('<path d="M4 20V11a7 7 0 0 1 7-7h9"/>') + 'Bordes' + ic('<path d="M6 9l6 6 6-6"/>').replace('<svg', '<svg class="chev"');
  const box = document.createElement('div'); box.id = 'styleTools'; box.hidden = true;
  box.innerHTML =
    '<span class="lbl">Redondeado de esquinas · mm</span>' +
    '<div class="bdrow"><input id="br" type="range" min="0" max="30" step="1" value="0" aria-label="Redondeado de esquinas"><input id="brN" type="number" min="0" max="30" step="1" value="0" inputmode="decimal" aria-label="Redondeado de esquinas en milímetros"></div>' +
    '<span class="lbl">Grosor del trazo · mm</span>' +
    '<div class="bdrow"><input id="bt" type="range" min="0" max="10" step="0.5" value="0" aria-label="Grosor del trazo"><input id="btN" type="number" min="0" max="10" step="0.5" value="0" inputmode="decimal" aria-label="Grosor del trazo en milímetros"></div>' +
    '<span class="lbl">Color del trazo</span>' +
    '<div class="bdrow bdcol" id="bdCols"></div>' +
    '<p class="note">En 0 no cambia nada. El trazo queda dentro del marco: la imagen se acomoda en lo que sobra.</p>';
  const body = document.querySelector('.sel-body'), anchor = $('bCrop') || $('bRot');
  if (!body || !anchor) { console.warn('Espejo y bordes: no se encontró el panel «Imagen elegida».'); return; }
  // Color / Blanco y negro por imagen (solo para ver: no cambia lo que se imprime ni se exporta). it.bn = true: se ve en grises.
  const seg = document.createElement('div'); seg.className = 'seg bnseg'; seg.setAttribute('role', 'group'); seg.setAttribute('aria-label', 'Color de la imagen (solo para ver)');
  seg.innerHTML = '<button type="button" data-bn="0" class="on" aria-pressed="true"><svg viewBox="0 0 24 24" aria-hidden="true"><defs><linearGradient id="bnPal" gradientUnits="userSpaceOnUse" x1="3" y1="3" x2="21" y2="21"><stop offset="0" stop-color="#ef4444"/><stop offset=".35" stop-color="#f59e0b"/><stop offset=".65" stop-color="#22c55e"/><stop offset="1" stop-color="#1f7fd8"/></linearGradient></defs><path fill="url(#bnPal)" fill-opacity=".22" stroke="url(#bnPal)" d="M12 3a9 9 0 1 0 0 18c1.1 0 1.8-.8 1.8-1.7 0-.5-.2-.8-.5-1.2-.3-.4-.5-.7-.5-1.2 0-1 .8-1.7 1.8-1.7H17a4 4 0 0 0 4-4c0-4.4-4-8.2-9-8.2z"/><circle cx="7.5" cy="11" r="1.3" fill="#ef4444" stroke="none"/><circle cx="10" cy="7" r="1.3" fill="#facc15" stroke="none"/><circle cx="14.5" cy="7" r="1.3" fill="#1f7fd8" stroke="none"/></svg>Color</button><button type="button" data-bn="1" aria-pressed="false" title="Solo para ver: no cambia lo que se imprime"><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 3a9 9 0 0 1 0 18z" fill="currentColor"/></svg>Blanco y negro</button>';
  anchor.after(mir); mir.after(tog); tog.after(box);
  ($('bUndeform') || $('bDel') || box).after(seg);      // Color / Blanco y negro va al final, después de «Quitar»
  // Paleta de colores del trazo + un círculo de arcoíris que abre el selector del navegador (otro color)
  const COLS = [['#ffffff', 'Blanco'], ['#000000', 'Negro'], ['#9ca3af', 'Gris'], ['#ef4444', 'Rojo'], ['#f59e0b', 'Naranja'], ['#facc15', 'Amarillo'], ['#22c55e', 'Verde'], ['#1f7fd8', 'Azul'], ['#8b5cf6', 'Morado'], ['#ec4899', 'Rosado']];
  const cols = box.querySelector('#bdCols');
  COLS.forEach(([c, n]) => { const b = document.createElement('button'); b.className = 'sw'; b.type = 'button'; b.dataset.c = c; b.title = n; b.setAttribute('aria-label', n); cols.append(b); });
  const cust = document.createElement('label'); cust.className = 'swc'; cust.title = 'Otro color';
  cust.innerHTML = '<input id="bc" type="color" value="#ffffff" aria-label="Otro color del trazo">'; cols.append(cust);
  box.querySelectorAll('.sw').forEach(b => { b.style.background = b.dataset.c; });      // el color se pone desde JS (la política de contenido no deja estilos en el HTML)

  // Espejo y bordes. it.mir: espejo · it.bt: grosor del trazo (mm) · it.br: redondeado de esquinas (mm) · it.bc: color del trazo (blanco por defecto). Con 0 y 0 la imagen queda tal cual.
  App.bdInfo = it => {
    const m = Math.min(it.w, it.h) / 2;
    return { t: Math.max(0, Math.min(+it.bt || 0, m - .5)), rad: Math.max(0, Math.min(+it.br || 0, m)), c: /^#[0-9a-f]{6}$/i.test(it.bc) ? it.bc : '#ffffff' };
  };
  App.rrect = (g, x, y, w, h, r) => {
    r = Math.max(0, Math.min(r, w / 2, h / 2));
    g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath();
  };

  // Escala de la foto dentro del área de adentro del trazo.
  // Si el marco tenía la forma de la foto (±6 %), la foto rellena el interior: así el trazo queda parejo por los 4 lados
  // (sin esto, al quitar el trazo de ancho y alto, la foto queda más chica que el interior y sobra espacio arriba y abajo).
  // Si el marco es de otra forma (la foto va «completa» con espacio a propósito), no se recorta nada.
  const fitScale = (it, nw, nh, iw, ih) => {
    if (App.bdInfo(it).t > 0 && !it.df) {
      const R = it.rot % 180 ? nh / nw : nw / nh;
      if (Math.abs(R / (it.w / it.h) - 1) < .06) { const k = Math.max(iw / nw, ih / nh); return [k, k]; }
    }
    return App.imgScale(it, nw, nh, iw, ih);
  };

  // Encuadre limitado al área de adentro del borde
  App.clampCrop = it => {
    it.z = it.z || 1; it.fx = it.fx || 0; it.fy = it.fy || 0;
    const im = it.img; if (!im || !im.naturalWidth) return;
    const t = App.bdInfo(it).t, ew = it.w - 2 * t, eh = it.h - 2 * t;
    const r = it.rot % 180 !== 0, iw = r ? eh : ew, ih = r ? ew : eh;
    const [sx, sy] = fitScale(it, im.naturalWidth, im.naturalHeight, iw, ih);
    const dw = im.naturalWidth * sx * it.z, dh = im.naturalHeight * sy * it.z;
    const fw = r ? dh : dw, fh = r ? dw : dh;
    const bx = Math.abs(fw - ew) / 2 / it.w, by = Math.abs(fh - eh) / 2 / it.h;
    it.fx = Math.max(-bx, Math.min(bx, it.fx)); it.fy = Math.max(-by, Math.min(by, it.fy));
  };

  // En pantalla (y al imprimir): se completa lo que dibuja App.place
  const place0 = App.place;
  App.place = (d, it) => {
    place0(d, it);
    d.classList.toggle('bn', !!it.bn);                                    // blanco y negro solo para ver (css/components.css)
    const { t, rad, c } = App.bdInfo(it), ew = it.w - 2 * t, eh = it.h - 2 * t;
    let bd = d.querySelector('.bd');
    if (!bd) { bd = document.createElement('b'); bd.className = 'bd'; const rz = d.querySelector('.rz'); rz ? d.insertBefore(bd, rz) : d.append(bd); }
    d.style.borderRadius = rad ? rad / it.w * 100 + '% / ' + rad / it.h * 100 + '%' : '';
    bd.style.display = t ? 'block' : 'none'; bd.style.outlineColor = c;
    d.style.backgroundColor = t ? c : '';                                 // si la foto no llena el interior, el sobrante lleva el color del trazo (igual que en el PDF)
    if (t) {
      bd.style.left = bd.style.right = t / it.w * 100 + '%'; bd.style.top = bd.style.bottom = t / it.h * 100 + '%';
      const ri = Math.max(0, rad - t); bd.style.borderRadius = ri ? ri / ew * 100 + '% / ' + ri / eh * 100 + '%' : '0';
    }
    const o = rad * .3;                                                   // con esquinas redondeadas, las escuadras se meten para que no las recorte la curva
    d.querySelectorAll('.rz').forEach(z => { const c = z.dataset.c || ''; z.style[c.includes('e') ? 'right' : 'left'] = o / it.w * 100 + '%'; z.style[c.includes('s') ? 'bottom' : 'top'] = o / it.h * 100 + '%'; });
    const im = d.firstChild, nw = it.img && it.img.naturalWidth, nh = it.img && it.img.naturalHeight;
    if (nw && (t || it.mir)) {
      const r = it.rot % 180 !== 0, [sx, sy] = fitScale(it, nw, nh, r ? eh : ew, r ? ew : eh), dw = nw * sx, dh = nh * sy;
      im.style.width = dw / it.w * 100 + '%'; im.style.height = dh / it.h * 100 + '%';
      im.style.transform = `translate(-50%,-50%) translate(${it.fx * it.w / dw * 100}%,${it.fy * it.h / dh * 100}%) ${it.mir ? 'scaleX(-1) ' : ''}rotate(${it.rot}deg) scale(${it.z})`;
    }
  };

  // Dibuja una imagen de la hoja en un lienzo (k = píxeles por mm). Lo usan exportar (PNG/PDF) y la vista previa.
  App.drawItem = (g, it, k) => {
    const im = it.img; if (!im || !im.naturalWidth) return;
    App.clampCrop(it);
    const { t, rad, c } = App.bdInfo(it), x = it.x * k, y = it.y * k, bw = it.w * k, bh = it.h * k, r = it.rot % 180 !== 0;
    const ew = bw - 2 * t * k, eh = bh - 2 * t * k, iw = r ? eh : ew, ih = r ? ew : eh;
    g.save(); g.imageSmoothingEnabled = true; g.imageSmoothingQuality = 'high';      // reducción de buena calidad (menos borroso/dentado al exportar)
    if (t) { g.beginPath(); App.rrect(g, x, y, bw, bh, rad * k); g.fillStyle = c; g.fill(); }
    g.beginPath(); App.rrect(g, x + t * k, y + t * k, ew, eh, Math.max(0, rad - t) * k); g.clip();
    g.translate(x + bw / 2, y + bh / 2); g.translate(it.fx * bw, it.fy * bh); if (it.mir) g.scale(-1, 1); g.rotate(it.rot * Math.PI / 180);
    const [sx, sy] = fitScale(it, im.naturalWidth, im.naturalHeight, iw, ih);
    const dw = im.naturalWidth * sx * it.z, dh = im.naturalHeight * sy * it.z;
    g.drawImage(im, -dw / 2, -dh / 2, dw, dh); g.restore();
  };

  // ---- Controles ----
  const pages = () => { if (App.renderPages) App.renderPages(); };
  const apply = (fn, keepPages) => {                                     // a todas las imágenes elegidas (no cuenta como mover algo a mano)
    const its = App.sels().map(id => App.byId(id)).filter(Boolean); if (!its.length) return;
    its.forEach(it => { fn(it); const d = document.querySelector('#sheet .it[data-id="' + it.id + '"]'); if (d) App.place(d, it); });
    if (!keepPages) pages();                                             // las miniaturas se redibujan al soltar, no en cada paso
    sync();
  };
  const fmt = v => String(Math.round(v * 10) / 10);
  function sync(skip) {
    const it = App.byId(S.sel), t = it && +it.bt || 0, r = it && +it.br || 0;
    seg.querySelectorAll('button').forEach(b => { const on = (b.dataset.bn === '1') === !!(it && it.bn); b.classList.toggle('on', on); b.setAttribute('aria-pressed', on); });
    $('bMir').classList.toggle('on', !!(it && it.mir)); $('bMir').setAttribute('aria-pressed', !!(it && it.mir));
    $('bBord').classList.toggle('on', t > 0 || r > 0);                   // azul cuando la imagen tiene redondeado o trazo
    if (skip !== 'br') { $('br').value = r; $('brN').value = fmt(r); }
    if (skip !== 'bt') { $('bt').value = t; $('btN').value = fmt(t); }
    const c = it ? App.bdInfo(it).c : '#ffffff';
    if (skip !== 'bc') $('bc').value = c;
    box.querySelectorAll('.sw').forEach(b => b.classList.toggle('on', b.dataset.c === c.toLowerCase()));
    const own = !COLS.some(x => x[0] === c.toLowerCase());                  // color propio: el círculo muestra ese color por dentro
    cust.classList.toggle('on', own); cust.style.setProperty('--cc', own ? c : 'transparent');
  }
  $('bMir').onclick = () => {
    const p = App.byId(S.sel); if (!p) return; const on = !p.mir;
    apply(it => { if (!!it.mir !== on) { it.mir = on; it.fx = -(it.fx || 0); } });   // el encuadre también se voltea: lo que ves es el espejo exacto
  };
  seg.querySelectorAll('button').forEach(b => b.onclick = () => apply(it => { it.bn = b.dataset.bn === '1'; }));      // a la imagen elegida o a todas las elegidas
  tog.onclick = () => { const open = box.hidden; box.hidden = !open; tog.setAttribute('aria-expanded', open); };
  // Deslizador y casilla numérica van juntos (como en Canva). Los valores se limitan al rango.
  const bind = (key, rng, num) => {
    const lim = v => Math.max(+rng.min, Math.min(+rng.max, v));
    rng.oninput = () => apply(it => { it[key] = lim(+rng.value); }, true);
    num.oninput = () => { if (num.value === '' || isNaN(+num.value)) return; apply(it => { it[key] = lim(+num.value); }, true); };
    num.onchange = () => { if (num.value === '' || isNaN(+num.value)) sync(); pages(); };
    rng.onchange = pages;
    // El deslizador sigue al mouse aunque salga del panel y no inicia un arrastre nativo (el ícono rojo 🚫)
    rng.draggable = false;
    rng.addEventListener('dragstart', e => e.preventDefault());
    rng.addEventListener('pointerdown', e => { if (e.button === 0) { try { rng.setPointerCapture(e.pointerId); } catch (_) {} } });
  };
  bind('br', $('br'), $('brN')); bind('bt', $('bt'), $('btN'));
  // Color del trazo: si todavía no había trazo (0 mm), se pone uno de 3 mm para que se vea el cambio
  const setColor = (c, keepPages) => apply(it => { it.bc = c; if (!(+it.bt > 0)) it.bt = 3; }, keepPages);
  box.querySelectorAll('.sw').forEach(b => b.onclick = () => setColor(b.dataset.c));
  $('bc').oninput = e => { setColor(e.target.value, true); sync('bc'); };
  $('bc').onchange = pages;
  const rs = App.refreshSel; App.refreshSel = () => { rs(); sync(); };
})();
