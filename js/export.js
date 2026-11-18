/* Imprimir, PDF y PNG (todas las páginas con imágenes) */
(() => {
  const App = window.App, $ = App.$, S = App.S;
  const filled = () => { App.save(); const p = S.pages.filter(x => x.items.length); return p; };

  function toCanvas(items, dpi) {
    const k = dpi / 25.4, c = document.createElement('canvas');
    c.width = Math.round(S.W * k); c.height = Math.round(S.H * k);
    const g = c.getContext('2d'); g.fillStyle = '#fff'; g.fillRect(0, 0, c.width, c.height);
    items.forEach(it => App.drawItem(g, it, k));      // mismo dibujo que en pantalla: espejo, borde y esquinas (js/borde.js)
    const mk = App.marksSegs ? App.marksSegs(items, S.marks) : null;      // marcas de corte
    if (mk && mk.segs.length) {
      g.save(); g.strokeStyle = '#000'; g.lineWidth = Math.max(1, .2 * k); g.lineCap = 'butt';
      if (mk.dash) g.setLineDash([2 * k, 1.5 * k]);
      g.beginPath(); mk.segs.forEach(s => { g.moveTo(s[0] * k, s[1] * k); g.lineTo(s[2] * k, s[3] * k); }); g.stroke(); g.restore();
    }
    return c;
  }
  // Calidad de papel: 300 ppp (antes 200). Tope de ~9000 px por lado para no agotar la memoria en hojas muy grandes.
  const DPI = () => Math.min(300, 9000 / (Math.max(S.W, S.H) / 25.4));
  const need = () => { if (filled().length) return true; App.toast('Primero agrega al menos una imagen.'); return false; };

  // Al imprimir se arma una copia de cada página (también con Ctrl+P)
  App.buildPrint = () => {
    const box = $('printArea'); box.textContent = '';
    filled().forEach(p => {
      const pg = document.createElement('div'); pg.className = 'pp';
      p.items.forEach(it => { const d = App.mk(it); pg.append(d); App.place(d, it); });
      const m = App.marksEl && App.marksEl(p.items, { color: '#000', w: .2 }); if (m) pg.append(m);
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
    pages.forEach((p, i) => setTimeout(() => toCanvas(p.items, DPI()).toBlob(b => {
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
      doc.addImage(toCanvas(p.items, DPI()).toDataURL('image/jpeg', .98), 'JPEG', 0, 0, S.W, S.H);
    });
    doc.save('hoja.pdf');
  };
})();
