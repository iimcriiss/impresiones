# Hoja de impresión

Herramienta estática para acomodar varias imágenes en una hoja, medir sobre la hoja e imprimir o descargar (PDF/PNG). Todo corre en el navegador; las imágenes no se suben a ningún servidor.

## Estructura
```
hoja-impresion/
├─ index.html          Página y controles
├─ css/
│  ├─ tokens.css       Variables base (colores, sombras, curvas)
│  ├─ base.css         Layout general y fondo
│  ├─ components.css   Botones, chips, campos, barra flotante, avisos
│  ├─ blur.css         Estilo Neo-Tactile (cristal esmerilado), temas claro/oscuro,
│  │                   pestaña Carnet, barras flotantes de zoom y páginas,
│  │                   ventana de foto carnet. Redefine la paleta final.
│  └─ print.css        Reglas de impresión
├─ js/
│  ├─ state.js         Estado y medidas del papel
│  ├─ layout.js        Acomodo en cuadrícula
│  ├─ render.js        Dibujo de la hoja, zoom y ajuste al espacio disponible
│  ├─ pages.js         Páginas: selección múltiple (Ctrl/Shift), copiar/pegar/duplicar/eliminar, mover arrastrando y menú «···»
│  ├─ interactions.js  Mover, redimensionar, teclado, intercambiar orden arrastrando
│  ├─ position.js      Panel «Posición»: orden, alinear, medidas y capas
│  ├─ history.js       Deshacer / rehacer (Ctrl+Z, Ctrl+Y) y botones junto a «1 de 1»
│  ├─ ruler.js         Dibujo de reglas en cm (lo usa el botón «Regla»)
│  ├─ ui.js            Panel, carga de archivos, avisos
│  ├─ export.js        Imprimir, PDF y PNG (usa App.drawItem de borde.js)
│  ├─ refs-art.js      Objetos de referencia para Medidas (moneda, tarjeta, lápiz…)
│  ├─ medir.js         Barra de abajo sobre la hoja: datos, regla y medidas
│  ├─ carnet.js        Foto tipo carnet: encuadre, tamaño, copias a la hoja y descarga
│  ├─ scan.js          Recortar (ventana con ángulo libre) y modo escáner
│  │                   (Original, Mejorado, Grises, Documento)
│  ├─ borde.js         Espejo y bordes (redondeado y trazo blanco): panel, dibujo en pantalla y al exportar
│  ├─ theme.js         Tema claro/oscuro y atajos de la barra (carga en <head>)
│  ├─ main.js          Arranque
│  └─ vendor/          jsPDF, libheif-js y heic2any (con la versión en el nombre)
├─ fonts/              Tipografía LT Saeada (LyonsType, licencia SIL OFL 1.1: OFL-Saeada.txt) y Comfortaa
├─ heic/               Conversor HEIC aislado (decoder.html y decoder.js)
├─ _headers            Cabeceras de seguridad de Cloudflare Pages
└─ assets/             Iconos (favicon-64, apple-touch-icon, icono-saphix) y refs/ con las imágenes de las referencias
```

## Estilo y tema
- Estilo Neo-Tactile: paneles de cristal con esquinas muy redondeadas, botones en píldora con relieve y botón activo azul.
- Acento azul `#1F7FD8`. Oscuro: fondo azul marino casi negro con resplandor cian en los bordes. Claro: celeste con un círculo azul difuminado.
- La paleta final vive en `css/blur.css` (`html.blur`); `css/tokens.css` solo trae los valores base.
- El tema se guarda en el navegador (`localStorage`, clave `saphix.ui`).
- En pantallas anchas, las barras de zoom y de páginas flotan sobre el lienzo con desenfoque; la hoja se ajusta para caber entera sin barra de desplazamiento.

## Orden en la cuadrícula
- Arrastra una imagen sobre otra para intercambiarlas (mientras la hoja esté en acomodo automático).
- Posición → Organizar → «Orden en la cuadrícula»: Antes / Después.
- Al cambiar columnas, filas o pulsar «Acomodar de nuevo» se respeta el orden que ves en la hoja.

## Elegir imágenes
- Clic en una imagen la elige; Ctrl/Shift + clic suma o quita otra.
- Mantén el clic en un espacio vacío de la hoja y arrastra: aparece un recuadro azul y se eligen todas las imágenes que toca (con Ctrl/Shift se suman a las que ya tenías). No funciona con el dedo en pantallas táctiles, para no estorbar al desplazarte.
- Ctrl + A elige todas.

## Editar una imagen
- Arrastra la imagen para moverla (el cursor se vuelve una mano).
- Escuadras en L de las cuatro esquinas: cambian el tamaño (la esquina contraria queda fija) conservando la proporción; con Shift deforma; doble clic vuelve a la proporción original.
- Recortar: tiradores redondos (esquinas) y barras (lados); botón de girar debajo de la imagen (-180° a 180°, imán a 0°/45°/90°, Shift de 15° en 15°, Alt sin imán, doble clic 0°).
- Encuadre dentro del marco: doble clic sobre la imagen para moverla; con la rueda del mouse la acercas y alejas (20% a 500%). Ya no hay deslizador en el panel.
- En acomodo automático el marco toma la proporción de la imagen (sin banda blanca); en acomodo manual conserva su centro y toma la proporción de lo recortado.

## Espejo y bordes
En el panel «Imagen elegida» (se aplica a todas las imágenes elegidas).
- **Espejo**: voltea la imagen de izquierda a derecha, para papel de transferencia (camisetas, tazas). La vista, la impresión, el PDF y el PNG muestran lo mismo.
- **Bordes** (botón desplegable, siempre activo): **Redondeado de esquinas** (0 a 30 mm) y **Grosor del trazo** (0 a 10 mm, para stickers) y **Color del trazo** (blanco, negro, azul u otro con el selector; si eliges color sin trazo se pone uno de 3 mm). Redondeado y grosor tienen deslizador y casilla para escribir el valor. En 0 la imagen no cambia; el botón se pone azul cuando hay redondeado o trazo.
- El trazo queda dentro del marco: la imagen se acomoda en lo que sobra. Las escuadras de las esquinas se meten un poco cuando hay esquinas redondeadas.
- Estilos en `css/components.css` (sin estilos inyectados desde JS, por la política de contenido).

## Deshacer y rehacer
- Ctrl + Z deshace y Ctrl + Y (o Ctrl + Shift + Z) rehace; también las flechas junto a «1 de 1». Hasta 100 pasos.
- Cubre todo lo de la hoja: mover, tamaño, giro, recorte, encuadre, espejo, bordes, capas, agregar, quitar, duplicar, pegar, páginas y ajustes de papel/márgenes/cuadrícula.
- Arrastrar o deslizar cuenta como **un solo paso** (se guarda al soltar). Si deshaces y haces un cambio nuevo, se borra lo que se podía rehacer.
- No cuentan: cambiar de página, zoom, regla y objetos de referencia. En campos de texto se usa el deshacer del propio campo.

## Copiar y pegar imágenes
- Ctrl + C copia las imágenes elegidas (una o varias, con su tamaño, giro, recorte, bordes y posición relativa); Ctrl + X las corta.
- Ctrl + V pega una copia corrida unos mm (cada pegado se corre más), la deja elegida y se puede pegar varias veces. Funciona entre páginas.
- Copiar no cambia la hoja ni entra al historial; cada pegado sí es un paso (Ctrl + Z lo quita).
- Ctrl + D duplica lo elegido. El panel «Ayuda» de la página explica todo esto con ejemplos y la lista completa de atajos.
- Con el panel de páginas abierto y el último clic en la tira, Ctrl + C/X/V trabajan con páginas completas.

## Páginas
- La tira de páginas (botón de páginas en la barra de abajo) permite cambiar de página, duplicarla o eliminarla desde el menú «···».

## Foto tipo carnet
- Pestaña «Carnet»: acomoda la cara en el molde, elige el tamaño (cm) y manda las copias a la hoja.
- Descarga: en Chrome y Edge abre «Guardar como»; en otros navegadores descarga directo (`foto-carnet.png`, `foto-carnet-2.png`, …).

## Barra de abajo: ver y medir en la hoja
Todo ocurre sobre la hoja principal (ya no hay ventana de vista previa ni zoom aparte).
- **Datos**: «A4 · Vertical · 2 imágenes», siempre al día.
- **Zoom, Panel y Páginas**: el deslizador y el 100% ajustan la hoja; Panel oculta la barra lateral y Páginas abre la tira.
- **Color / Blanco y negro** (panel «Imagen elegida»): por imagen o para todas las elegidas; solo para ver cómo se vería, no cambia lo que se imprime ni se exporta.
- **Regla**: reglas de cristal en cm pegadas a los bordes de la hoja. Muestran los márgenes y marcan la(s) imagen(es) elegida(s); al mover una imagen, la marca la sigue. Una línea azul sigue al mouse (se oculta mientras agarras algo). Al activarla o apagarla la hoja se reajusta con una animación. Empieza apagada.
- **Medidas**: abre un panel flotante con referencias a escala real (manos, objetos como moneda, tarjeta o lápiz, y medidas libres en cm). Se arrastran sobre la hoja, se cambian de medida y cada página guarda las suyas. No se imprimen ni se exportan.
- Las medidas que guardas («Guardar mi medida» / «Guardar atajo») quedan en el navegador (`localStorage`, clave `saphix.refs.v1`).

## Cloudflare Pages
Workers & Pages → Create → Pages → Direct Upload → sube esta carpeta (o el .zip).
Sin comando de build. Las librerías (PDF y HEIC) van dentro del proyecto en `js/vendor/`, así que no necesita internet para generar el PDF.

## Seguridad
- **Cabeceras (`_headers`)**: Cloudflare Pages las aplica solo. Política de contenido (CSP) estricta en la página principal (solo scripts del propio sitio, sin `eval`, sin scripts externos ni en línea), `nosniff`, no se puede incrustar en otros sitios (`frame-ancestors 'self'`), sin referrer, sin permisos de cámara/micrófono/ubicación, aislamiento de origen y HTTPS forzado (HSTS).
- **Sin CDN**: las librerías (jsPDF, libheif-js, heic2any) están dentro del proyecto en `js/vendor/` con la versión en el nombre. No se carga código de terceros al abrir la página y el PDF y el HEIC funcionan también sin internet. Para actualizar una, descarga la versión nueva de npm, cámbiale el nombre con la versión y actualiza la ruta en `index.html` o `heic/decoder.js`.
- **Conversor HEIC aislado (`heic/`)**: las librerías HEIC necesitan `unsafe-eval`. Ese permiso solo existe en `heic/decoder.html` (marco oculto con su propia política); la página principal no lo tiene. Solo se comunica con la página por mensajes del mismo sitio.
- **Límites al subir imágenes**: máximo 60 MB por archivo y 150 millones de píxeles por imagen (evita archivos que congelan o agotan la memoria del navegador).
- **Privacidad**: las imágenes nunca salen del navegador; no hay servidor, cuentas ni cookies. Solo se guardan en el navegador la preferencia de tema y tus medidas guardadas.
- **Sin estadísticas**: no hay analytics ni scripts de terceros. Si algún día agregas Cloudflare Web Analytics, añade su script a `index.html` y permite `static.cloudflareinsights.com` (script-src) y `cloudflareinsights.com` (connect-src) en `_headers`.
- Si algún día incrustas la herramienta en otra página tuya (iframe), cambia `frame-ancestors` y `X-Frame-Options` en `_headers`.
