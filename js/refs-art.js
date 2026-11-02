/* Dibujos de referencia con medida real (manos y objetos), para la vista previa.
   Cada uno: id, n (nombre), cm (medida por defecto), vb (tamaño del dibujo), span (parte del ancho del dibujo que mide "cm"; si no se indica, todo el ancho),
   mb (zona medida: x, y, ancho, alto; el marco punteado se dibuja solo ahí y el resto del dibujo sobresale).
   Los objetos están dibujados a escala (1 unidad = 1 mm). Las manos son aproximadas: la mano de cada persona varía. */
(() => {
  const App = window.App;
  const SK = '#F6D6A8', ST = '#5B6FA8', BR = '#2F6FB0';
  const hs = 'stroke="' + ST + '" stroke-width="2.4" stroke-linejoin="round" stroke-linecap="round"';
  const rect = (x, y, w, h, r) => '<rect x="' + x + '" y="' + y + '" width="' + w + '" height="' + h + '" rx="' + r + '" fill="' + SK + '" ' + hs + '/>';
  // Dedo vertical con punta redonda; el borde de abajo queda abierto para unirlo a la palma
  const fing = (x, y, w, h) => {
    const r = w / 2, d = 'M' + x + ' ' + (y + h) + ' V' + (y + r) + ' A' + r + ' ' + r + ' 0 0 1 ' + (x + w) + ' ' + (y + r) + ' V' + (y + h);
    return '<path d="' + d + ' Z" fill="' + SK + '"/><path d="' + d + '" fill="none" ' + hs + '/>';
  };
  const line = d => '<path d="' + d + '" fill="none" ' + hs + '/>';
  const br = (x1, x2, y) => '<path d="M' + x1 + ' ' + (y - 7) + ' v14 M' + x2 + ' ' + (y - 7) + ' v14 M' + x1 + ' ' + y + ' H' + x2 + '" fill="none" stroke="' + BR + '" stroke-width="3" stroke-linecap="round"/>';
  const arm = (x1, x2, y1, y2) => '<path d="M' + x1 + ' ' + y1 + ' L' + (x1 - 3) + ' ' + y2 + ' H' + (x2 + 3) + ' L' + x2 + ' ' + y1 + ' Z" fill="' + SK + '" ' + hs + '/>';

  // n dedos juntos (palma al frente, pulgar doblado)
  const dedos = n => {
    const f = (196 - 5 * (n - 1)) / n, off = [10, 0, 6, 14];
    let s = arm(52, 148, 240, 282);
    s += '<rect x="3" y="158" width="194" height="96" rx="34" fill="' + SK + '"/>' + line('M2 170 V222 Q2 254 36 254 H164 Q198 254 198 222 V170');
    for (let i = 0; i < n; i++) s += fing(2 + i * (f + 5), 40 + off[n === 3 ? i + 0 : i], f, 150);
    s += rect(16, 200, 90, 38, 19) + (n === 3 ? rect(146, 210, 42, 30, 15) : '');
    return s + br(2, 198, 20);
  };

  const ART = [
    // ---------- Manos ----------
    { id: 'shaka', g: 'm', n: 'Mano abierta', cm: 20, vb: [700, 684], span: 700.0,
      svg: '<image href="assets/refs/mano-shaka.webp" width="700" height="684"/>' },
    { id: 'cuernos', g: 'm', n: 'Cuernos', cm: 15, vb: [349, 700], span: 340.2,
      svg: '<image href="assets/refs/mano-cuernos.webp" width="349" height="700"/>' },
    { id: 'puno', g: 'm', n: 'Puño', cm: 10, vb: [381, 700], span: 377.7,
      svg: '<image href="assets/refs/mano-puno.webp" width="381" height="700"/>' },
    { id: 'dedos2', g: 'm', n: '2 dedos', cm: 4, vb: [278, 700], span: 116.4, mb: [68, 0, 116.4, 170],
      svg: '<image href="assets/refs/mano-dedos2.webp" width="278" height="700"/>' },
    { id: 'dedos3', g: 'm', n: '3 dedos', cm: 5, vb: [269, 700], span: 145.9, mb: [74, 0, 145.9, 170],
      svg: '<image href="assets/refs/mano-dedos3.webp" width="269" height="700"/>' },
    { id: 'dedos4', g: 'm', n: '4 dedos', cm: 7, vb: [269, 700], span: 214.5, mb: [37, 0, 214.5, 180],
      svg: '<image href="assets/refs/mano-dedos4.webp" width="269" height="700"/>' },
    { id: 'pulgar', g: 'm', n: 'Pulgar', cm: 2, vb: [506, 700], span: 71.8, mb: [283, 0, 71.8, 100],
      svg: '<image href="assets/refs/mano-pulgar.webp" width="506" height="700"/>' },
    { id: 'indice', g: 'm', n: 'Dedo índice', cm: 1.8, vb: [350, 700], span: 67.0, mb: [80, 0, 67.0, 100],
      svg: '<image href="assets/refs/mano-indice.webp" width="350" height="700"/>' },

    // ---------- Objetos (1 unidad = 1 mm) ----------
    { id: 'lapiz', g: 'o', n: 'Lápiz', cm: 17.5, vb: [175.0, 9.92],
      svg: '<image href="assets/refs/lapiz.webp" width="175.0" height="9.92"/>' },
    { id: 'boli', g: 'o', n: 'Bolígrafo', cm: 14, vb: [140, 11],
      svg: '<path d="M0 5.5 L12 2 V9 Z" fill="#333"/><rect x="12" y="1.5" width="14" height="8" fill="#2B2B2B"/><rect x="26" y="1" width="100" height="9" rx="1.5" fill="#1F63C6"/>' +
        '<rect x="126" y="1" width="14" height="9" rx="3" fill="#174C9C"/><rect x="92" y="0" width="38" height="1.8" rx=".9" fill="#7E8791"/><rect x="40" y="3" width="30" height="1" fill="#fff" opacity=".35"/>' },
    { id: 'goma', g: 'o', n: 'Goma de borrar', cm: 5.5, vb: [55.0, 17.23],
      svg: '<image href="assets/refs/goma.webp" width="55.0" height="17.23"/>' },
    { id: 'clip', g: 'o', n: 'Clip', cm: 3.3, vb: [33, 10],
      svg: '<path d="M6 8 H26 A3.2 3.2 0 0 0 26 1.8 H8 A2.3 2.3 0 0 0 8 6.4 H23" fill="none" stroke="#9AA5B1" stroke-width=".9" stroke-linecap="round"/>' },
    { id: 'llave', g: 'o', n: 'Llave', cm: 6, vb: [60, 25.07],
      svg: '<image href="assets/refs/llave.webp" width="60" height="25.07"/>' },
    { id: 'peine', g: 'o', n: 'Peine', cm: 19, vb: [190, 39.69],
      svg: '<image href="assets/refs/peine.webp" width="190" height="39.69"/>' },
    { id: 'pincel', g: 'o', n: 'Pincel', cm: 18, vb: [180, 6.0],
      svg: '<image href="assets/refs/pincel.webp" width="180" height="6.0"/>' },
    { id: 'tenedor', g: 'o', n: 'Tenedor', cm: 19, vb: [190, 25.54],
      svg: '<image href="assets/refs/tenedor.webp" width="190" height="25.54"/>' },
    { id: 'labial', g: 'o', n: 'Pintalabios', cm: 7, vb: [70, 13.3],
      svg: '<image href="assets/refs/labial.webp" width="70" height="13.3"/>' },
    { id: 'gafas', g: 'o', n: 'Gafas', cm: 14, vb: [140, 41.07],
      svg: '<image href="assets/refs/gafas.webp" width="140" height="41.07"/>' },
    { id: 'moneda', g: 'o', n: 'Moneda', cm: 2.4, vb: [24.0, 24.38],
      svg: '<image href="assets/refs/moneda.webp" width="24.0" height="24.38"/>' },
    { id: 'tarjeta', g: 'o', n: 'Tarjeta', cm: 8.56, vb: [85.6, 60.3],
      svg: '<image href="assets/refs/tarjeta.webp" width="85.6" height="60.3"/>' },
  ];
  App.REF_ART = ART;
  App.refSvg = (a, attrs) => '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ' + a.vb[0] + ' ' + a.vb[1] + '" ' + (attrs || 'width="100%" height="100%"') + ' aria-hidden="true">' + a.svg + '</svg>';
})();
