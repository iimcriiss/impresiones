# Hoja de impresión

Herramienta estática para acomodar varias imágenes en una hoja, ver la vista previa e imprimir o descargar (PDF/PNG). Todo corre en el navegador; las imágenes no se suben a ningún servidor.

## Estructura
```
hoja-impresion/
├─ index.html          Página y controles
├─ css/
│  ├─ tokens.css       Paleta y variables
│  ├─ base.css         Layout general y fondo
│  ├─ components.css   Botones, chips, barra flotante, avisos
│  └─ print.css        Reglas de impresión
├─ js/
│  ├─ state.js         Estado y medidas del papel
│  ├─ layout.js        Acomodo en cuadrícula
│  ├─ render.js        Dibujo de la hoja y zoom
│  ├─ pages.js         Páginas y miniaturas
│  ├─ interactions.js  Mover, redimensionar, teclado, intercambiar orden arrastrando
│  ├─ ui.js            Panel, carga de archivos, avisos
│  ├─ scan.js          Recortar (ventana con ángulo libre) y modo escáner (Original, Mejorado, Grises, Documento)
│  ├─ export.js        Imprimir, PDF y PNG
│  └─ main.js          Arranque
├─ fonts/              Tipografía LT Saeada (LyonsType, licencia SIL OFL 1.1: OFL-Saeada.txt)
├─ heic/               Conversor HEIC aislado (decoder.html y decoder.js)
├─ _headers            Cabeceras de seguridad de Cloudflare Pages
└─ assets/             Íconos y logo
```

## Orden en la cuadrícula
- Arrastra una imagen sobre otra para intercambiarlas (mientras la hoja esté en acomodo automático).
- Posición → Organizar → «Orden en la cuadrícula»: Antes / Después.
- Al cambiar columnas, filas o pulsar «Acomodar de nuevo» se respeta el orden que ves en la hoja.

## Editar una imagen
- Triángulo de la esquina: cambia el tamaño conservando la proporción; con Shift deforma; doble clic vuelve a la proporción original.
- Recortar: tiradores redondos (esquinas) y barras (lados); botón de girar debajo de la imagen (-180° a 180°, imán a 0°/45°/90°, Shift de 15° en 15°, Alt sin imán, doble clic 0°).
- Tamaño de la imagen: 20% a 500%; doble clic para moverla dentro del marco; rueda del mouse para acercar y alejar.
- En acomodo automático el marco toma la proporción de la imagen (sin banda blanca).

## Paleta (sin degradados)
#E7F5DC · #CFE1B9 · #B6C99B · #98A77C · #88976C · #728156 + #2B3320 solo para texto (css/tokens.css)

## Cloudflare Pages
Workers & Pages → Create → Pages → Direct Upload → sube esta carpeta (o el .zip).
Sin comando de build. Las librerías (PDF y HEIC) van dentro del proyecto en `js/vendor/`, así que no necesita internet para generar el PDF.

## Seguridad
- **Cabeceras (`_headers`)**: Cloudflare Pages las aplica solo. Política de contenido (CSP) estricta en la página principal (solo scripts del propio sitio, sin `eval`, sin scripts externos ni en línea), `nosniff`, no se puede incrustar en otros sitios (`frame-ancestors 'self'`), sin referrer, sin permisos de cámara/micrófono/ubicación, aislamiento de origen y HTTPS forzado (HSTS).
- **Sin CDN**: las librerías (jsPDF, libheif-js, heic2any) están dentro del proyecto en `js/vendor/` con la versión en el nombre. No se carga código de terceros al abrir la página y el PDF y el HEIC funcionan también sin internet. Para actualizar una, descarga la versión nueva de npm, cámbiale el nombre con la versión y actualiza la ruta en `index.html` o `heic/decoder.js`.
- **Conversor HEIC aislado (`heic/`)**: las librerías HEIC necesitan `unsafe-eval`. Ese permiso solo existe en `heic/decoder.html` (marco oculto con su propia política); la página principal no lo tiene. Solo se comunica con la página por mensajes del mismo sitio.
- **Límites al subir imágenes**: máximo 60 MB por archivo y 150 millones de píxeles por imagen (evita archivos que congelan o agotan la memoria del navegador).
- **Privacidad**: las imágenes nunca salen del navegador; no hay servidor, cuentas ni cookies.
- Si algún día incrustas la herramienta en otra página tuya (iframe), cambia `frame-ancestors` y `X-Frame-Options` en `_headers`.
