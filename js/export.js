/* Imprimir, PDF y PNG (todas las páginas con imágenes) */
(() => {
  const App = window.App, $ = App.$, S = App.S;
  const filled = () => { App.save(); const p = S.pages.filter(x => x.items.length); return p; };

  function toCanvas(items, dpi) {
    const k = dpi / 25.4, c = document.createElement('canvas');
    c.width = Math.round(S.W * k); c.height = Math.round(S.H * k);
    const g = c.getContext('2d'); g.fillStyle = '#fff'; g.fillRect(0, 0, c.width, c.height);
    items.forEach(it => {
      App.clampCrop(it);
      const im = it.img, bw = it.w*k, bh = it.h*k, r = it.rot % 180 !== 0, iw = r ? bh : bw, ih = r ? bw : bh;
      g.save(); g.beginPath(); g.rect(it.x*k, it.y*k, bw, bh); g.clip();
      g.translate((it.x + it.w/2)*k, (it.y + it.h/2)*k); g.translate(it.fx*bw, it.fy*bh); g.rotate(it.rot * Math.PI / 180);
      const sc = (it.fit === 'cover' ? Math.max : Math.min)(iw / im.naturalWidth, ih / im.naturalHeight) * it.z;
      const dw = im.naturalWidth * sc, dh = im.naturalHeight * sc;
      g.drawImage(im, -dw/2, -dh/2, dw, dh); g.restore();
    });
    return c;
  }
  const need = () => { if (filled().length) return true; App.toast('Primero agrega al menos una imagen.'); return false; };

  // Al imprimir se arma una copia de cada página (también con Ctrl+P)
  App.buildPrint = () => {
    const box = $('printArea'); box.textContent = '';
    filled().forEach(p => {
      const pg = document.createElement('div'); pg.className = 'pp';
      p.items.forEach(it => { const d = App.mk(it); pg.append(d); App.place(d, it); });
      box.append(pg);
    });
  };
  addEventListener('beforeprint', App.buildPrint);
  addEventListener('afterprint', () => { $('printArea').textContent = ''; });

  $('bPrint').onclick = () => { if (!need()) return; S.sel = null; App.refreshSel(); print(); };
  $('bPng').onclick = () => {
    if (!need()) return;
    const pages = filled();
    if (pages.length > 1) App.toast('Se descargarán ' + pages.length + ' imágenes, una por página.');
    pages.forEach((p, i) => setTimeout(() => toCanvas(p.items, 200).toBlob(b => {
      const a = document.createElement('a'); a.href = URL.createObjectURL(b);
      a.download = pages.length > 1 ? 'hoja-' + (i + 1) + '.png' : 'hoja.png'; a.click();
    }), i * 400));
  };
  $('bPdf').onclick = () => {
    if (!need()) return;
    if (!window.jspdf) { App.toast('No se pudo cargar la librería de PDF. Revisa tu conexión.'); return; }
    const o = S.W > S.H ? 'l' : 'p', f = [Math.min(S.W, S.H), Math.max(S.W, S.H)];
    const doc = new jspdf.jsPDF({ orientation: o, unit: 'mm', format: f });
    filled().forEach((p, i) => {
      if (i) doc.addPage(f, o);
      doc.addImage(toCanvas(p.items, 200).toDataURL('image/jpeg', .95), 'JPEG', 0, 0, S.W, S.H);
    });
    doc.save('hoja.pdf');
  };
})();
