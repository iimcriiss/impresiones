/* Panel «Marcas de corte» (Imprimir): elige Sin marcas, Esquinas o Líneas punteadas. Solo se agrega si tu página aún no lo tiene. */
(() => {
  const App = window.App, S = App.S, KEY = 'hoja.marks';
  const has = [...document.querySelectorAll('h2,h3,h4,label,button,span,b')].some(e => /marcas de corte/i.test(e.textContent));
  const host = document.querySelector('[data-pane="out"]');   // las marcas de corte viven en Imprimir
  if (has || !host) return;
  try { const v = localStorage.getItem(KEY); if (v === 'corners' || v === 'lines') S.marks = v; } catch (_) {}
  // Selector de marcas de corte en el panel Imprimir
  const html = n => '<h3 class="sub">Marcas de corte</h3>' +
    '<div class="seg mkseg" id="mkSeg' + n + '"><button type="button" data-v="none">Ninguna</button><button type="button" data-v="corners">Esquinas</button><button type="button" data-v="lines">Líneas</button></div>' +
    '<p class="note mknote" id="mkNote' + n + '"></p>';
  [[host, '']].forEach(([pane, n]) => {
    if (!pane) return;
    const box = document.createElement('div'); box.innerHTML = html(n); pane.append(...box.childNodes);
  });
  // Cápsula más delgada: cada opción en una sola línea
  const st = document.createElement('style');
  st.textContent = '.mkseg{margin-top:8px;padding:2px}.mkseg button{padding:5px 4px;font-size:13px;line-height:1.2;white-space:nowrap}';
  document.head.append(st);
  const CAP = { none: 'La hoja sale sin marcas.', corners: 'Esquinas: limpio, no tapa la foto.', lines: 'Líneas punteadas: fáciles de seguir con la regla.' };
  const sync = () => {
    document.querySelectorAll('.mkseg button').forEach(b => b.classList.toggle('on', b.dataset.v === S.marks));
    document.querySelectorAll('.mknote').forEach(p => { p.textContent = CAP[S.marks] + ' Salen al imprimir, en el PDF y en el PNG.'; });
  };
  document.querySelectorAll('.mkseg').forEach(seg => { seg.onclick = e => {
    const b = e.target.closest('button'); if (!b) return;
    S.marks = b.dataset.v; try { localStorage.setItem(KEY, S.marks); } catch (_) {}
    sync(); App.drawMarks();
  }; });
  sync(); App.drawMarks();
})();
