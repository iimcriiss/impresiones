/* Selectores .seg que se deslizan (Color / Blanco y negro, Vertical / Horizontal, etc.).
   Solo LEE cuál botón tiene la clase .on (el estado lo manejan ui.js, borde.js, marks-ui.js…) y publica
   --x y --w (posición y ancho de ese botón) en el .seg; el CSS (blur.css, sección 2) mueve la pastilla y la barrita.
   Se recalcula: al cambiar .on, al mostrarse un panel que estaba oculto (ancho 0), al redimensionar y al cargar la fuente. */
(() => {
  const SEG = '.seg';

  // anim = true solo cuando el cambio viene de elegir otra opción; al mostrar, redimensionar o cargar no se anima
  const place = (seg, anim) => {
    const b = seg.querySelector(':scope > button.on');
    if (!b || !b.offsetWidth) { seg.classList.remove('seg-ok'); seg._placed = false; return; }
    if (!anim && seg._placed && seg._x === b.offsetLeft && seg._w === b.offsetWidth) return;   // nada cambió: no interrumpe una animación en curso
    const still = !anim || !seg._placed;
    if (still) seg.classList.add('seg-still');
    seg._x = b.offsetLeft; seg._w = b.offsetWidth;
    seg.style.setProperty('--x', b.offsetLeft + 'px');
    seg.style.setProperty('--w', b.offsetWidth + 'px');
    seg.classList.add('seg-ok');
    seg._placed = true;
    if (still) requestAnimationFrame(() => requestAnimationFrame(() => seg.classList.remove('seg-still')));
  };

  const ro = new ResizeObserver(entries => {
    const done = new Set();
    entries.forEach(e => { const s = e.target.closest(SEG); if (s && !done.has(s)) { done.add(s); place(s, false); } });
  });

  const init = root => root.querySelectorAll(SEG).forEach(s => {
    ro.observe(s);
    s.querySelectorAll(':scope > button').forEach(b => ro.observe(b));
    if (!s._seg) { s._seg = true; place(s, false); }
  });

  new MutationObserver(list => {
    let rescan = false; const touched = new Set();
    list.forEach(m => {
      if (m.type === 'childList') { rescan = true; return; }
      const t = m.target, p = t.parentElement;
      if (t.tagName === 'BUTTON' && p && p.classList.contains('seg')) touched.add(p);     // cambió .on
    });
    if (rescan) init(document);
    touched.forEach(s => place(s, true));
  }).observe(document.documentElement, { subtree: true, childList: true, attributes: true, attributeFilter: ['class'] });

  init(document);
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => document.querySelectorAll(SEG).forEach(s => place(s, false)));
})();
