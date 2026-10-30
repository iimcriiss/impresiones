/* Conversor HEIC/HEIF → JPEG, aislado en su propio marco.
   Las librerías de decodificación necesitan 'unsafe-eval'; así ese permiso vive solo aquí
   (ver _headers) y la página principal queda con la política estricta. */
(() => {
  const MAX_PIXELS = 150e6, libs = {};
  const load = (key, url, glob) => libs[key] || (libs[key] = new Promise((ok, no) => {
    if (window[glob]) return ok(window[glob]);
    const s = document.createElement('script'); s.src = url;
    s.onload = () => window[glob] ? ok(window[glob]) : no(new Error('la librería no cargó'));
    s.onerror = () => { delete libs[key]; no(new Error('no se pudo cargar la librería')); };
    document.head.append(s);
  }));
  const toJpeg = c => new Promise((ok, no) => c.toBlob(b => b ? ok(b) : no(new Error('no se pudo convertir')), 'image/jpeg', .92));
  const viaLibheif = async f => {
    let lh = await load('lh', '../js/vendor/libheif-bundle-1.18.2.js', 'libheif');
    if (typeof lh === 'function') lh = await lh();
    const im = new lh.HeifDecoder().decode(new Uint8Array(await f.arrayBuffer()))[0];
    if (!im) throw new Error('formato HEIC no reconocido');
    const w = im.get_width(), h = im.get_height();
    if (w * h > MAX_PIXELS) throw new Error('imagen demasiado grande');
    const c = document.createElement('canvas'); c.width = w; c.height = h;
    const ctx = c.getContext('2d'), id = ctx.createImageData(w, h);
    await new Promise((ok, no) => im.display(id, r => r ? ok() : no(new Error('no se pudo decodificar'))));
    ctx.putImageData(id, 0, 0); return toJpeg(c);
  };
  const viaHeic2any = async f => {
    const conv = await load('h2a', '../js/vendor/heic2any-0.0.4.min.js', 'heic2any');
    const out = await conv({ blob: f, toType: 'image/jpeg', quality: .92 });
    return Array.isArray(out) ? out[0] : out;
  };
  addEventListener('message', async e => {
    // Solo responde a la página principal del mismo sitio
    if (e.origin !== location.origin || e.source !== parent || !e.data || typeof e.data.id !== 'number' || !(e.data.file instanceof Blob)) return;
    let err;
    for (const fn of [viaLibheif, viaHeic2any]) {
      try { const blob = await fn(e.data.file); parent.postMessage({ id: e.data.id, blob }, location.origin); return; }
      catch (x) { err = x; }
    }
    parent.postMessage({ id: e.data.id, error: (err && err.message) || 'no se pudo convertir' }, location.origin);
  });
  parent.postMessage({ ready: true }, location.origin);
})();
