/* Dibujo de la hoja en pantalla */
(() => {
  const App = window.App, $ = App.$;
  const sheet = $('sheet'), stage = $('stage');

  function mk(it) {
    const d = document.createElement('div'); d.className = 'it'; d.dataset.id = it.id;
    const im = new Image(); im.src = it.src; im.alt = ''; d.append(im);
    const h = document.createElement('i'); h.className = 'rz'; h.title = 'Arrastra: cambia el tamaño · Shift: deformar · Doble clic: proporción original'; d.append(h);
    return d;
  }
  App.mk = mk;
  // Escala de la imagen dentro del marco (sin acercamiento). Normal: conserva su proporción.
  // Deformada (it.df): se estira para ocupar todo el marco, como en Paint.
  App.imgScale = (it, nw, nh, iw, ih) => {
    if (it.df) return [iw / nw, ih / nh];
    const s = (it.fit === 'cover' ? Math.max : Math.min)(iw / nw, ih / nh); return [s, s];
  };
  // Proporción natural de la imagen tal como se ve (con el giro)
  App.imgRatio = it => { const im = it.img; if (!im || !im.naturalWidth) return it.w / it.h; return it.rot % 180 ? im.naturalHeight / im.naturalWidth : im.naturalWidth / im.naturalHeight; };
  // Encuadre: it.z = acercamiento (1 = normal); it.fx / it.fy = desplazamiento como fracción del marco.
  // Se limita para que la imagen nunca deje un hueco ni se pierda fuera del marco.
  App.clampCrop = it => {
    it.z = it.z || 1; it.fx = it.fx || 0; it.fy = it.fy || 0;
    const im = it.img; if (!im || !im.naturalWidth) return;
    const r = it.rot % 180 !== 0, iw = r ? it.h : it.w, ih = r ? it.w : it.h;
    const [sx, sy] = App.imgScale(it, im.naturalWidth, im.naturalHeight, iw, ih);
    const dw = im.naturalWidth * sx * it.z, dh = im.naturalHeight * sy * it.z;
    const fw = r ? dh : dw, fh = r ? dw : dh;
    const bx = Math.abs(fw - it.w) / 2 / it.w, by = Math.abs(fh - it.h) / 2 / it.h;
    it.fx = Math.max(-bx, Math.min(bx, it.fx)); it.fy = Math.max(-by, Math.min(by, it.fy));
  };
  // Capas: it.l es el orden (mayor = más arriba). Es independiente del orden de la cuadrícula.
  App.nextLayer = () => Math.max(0, ...App.S.items.map(i => i.l || 0)) + 1;
  App.place = (d, it) => {
    const { W, H } = App.S;
    d.style.zIndex = it.l || 0;
    d.style.left = it.x/W*100 + '%'; d.style.top = it.y/H*100 + '%';
    d.style.width = it.w/W*100 + '%'; d.style.height = it.h/H*100 + '%';
    const im = d.firstChild, r = it.rot % 180 !== 0, nw = it.img && it.img.naturalWidth, nh = it.img && it.img.naturalHeight;
    App.clampCrop(it);
    let tx, ty;
    if (nw) {
      // La imagen completa con su tamaño real dentro del marco (llenar o completa); el marco recorta lo que sobra
      const iw = r ? it.h : it.w, ih = r ? it.w : it.h;
      const [sx, sy] = App.imgScale(it, nw, nh, iw, ih), dw = nw * sx, dh = nh * sy;
      im.style.width = dw / it.w * 100 + '%'; im.style.height = dh / it.h * 100 + '%'; im.style.objectFit = 'fill';
      tx = it.fx * it.w / dw * 100; ty = it.fy * it.h / dh * 100;
    } else {
      im.style.width = r ? it.h/it.w*100 + '%' : '100%'; im.style.height = r ? it.w/it.h*100 + '%' : '100%'; im.style.objectFit = it.fit;
      tx = it.fx * it.w / (r ? it.h : it.w) * 100; ty = it.fy * it.h / (r ? it.w : it.h) * 100;
    }
    im.style.transform = `translate(-50%,-50%) translate(${tx}%,${ty}%) rotate(${it.rot}deg) scale(${it.z})`;
  };
  App.syncFields = () => {
    const it = App.byId(App.S.sel); if (!it) return;
    const f = v => Math.round(v*10)/10;
    $('fx').value = f(it.x); $('fy').value = f(it.y); $('fw').value = f(it.w); $('fh').value = f(it.h);
  };
  // Imágenes elegidas: S.sel es la principal; S.group guarda todas cuando hay varias (Ctrl/Shift)
  App.sels = () => {
    const S = App.S; if (!S.sel || !App.byId(S.sel)) return [];
    const g = (S.group || []).filter(id => App.byId(id));
    return g.includes(S.sel) ? g : [S.sel];
  };
  App.refreshSel = () => {
    const S = App.S, it = App.byId(S.sel), ids = App.sels(), multi = ids.length > 1;
    if (!it || multi) S.crop = false;
    sheet.querySelectorAll('.it').forEach(d => {
      d.classList.toggle('sel', ids.includes(d.dataset.id));
      d.classList.toggle('crop', !!S.crop && d.dataset.id === S.sel);
    });
    sheet.classList.toggle('multi', multi); $('side').classList.toggle('multi', multi);
    $('selTitle').textContent = multi ? ids.length + ' imágenes elegidas' : 'Imagen elegida';
    $('side').classList.toggle('off', !it);
    document.body.classList.toggle('selmulti', multi);
    $('bUndeform').hidden = !(it && it.df && !multi);
    if (it) { $('cz').value = Math.round((it.z || 1) * 100); $('czVal').textContent = Math.round((it.z || 1) * 100) + '%'; App.syncFields(); }
  };
  const canvas = $('canvas');
  // Tamaño de la hoja: ajustada a la pantalla x zoom
  App.fit = () => {
    const S = App.S, aw = canvas.clientWidth - 32;
    const ah = matchMedia('(min-width:1101px)').matches ? canvas.clientHeight - 32 : 1e9;
    const s = Math.max(.5, Math.min(aw / S.W, ah / S.H)) * S.zoom / 100;
    sheet.style.width = S.W*s + 'px'; sheet.style.height = S.H*s + 'px';
  };
  App.render = () => {
    const S = App.S; App.dims();
    const root = document.documentElement.style;
    root.setProperty('--pw', S.W + 'mm'); root.setProperty('--ph', S.H + 'mm');
    $('page-size').textContent = `@page{size:${S.W}mm ${S.H}mm;margin:0}`;
    App.fit();
    const g = $('guide').style;
    g.left = g.right = S.margin/S.W*100 + '%'; g.top = g.bottom = S.margin/S.H*100 + '%';
    sheet.querySelectorAll('.it').forEach(e => e.remove());
    S.items.forEach(it => { const d = mk(it); sheet.append(d); App.place(d, it); });
    $('drop').hidden = S.items.length > 0;
    App.syncUI(); App.refreshSel(); App.renderPages();
  };
})();
