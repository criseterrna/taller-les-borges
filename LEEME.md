# Taller Les Borges del Camp — app del taller

App autónoma para el móvil: no depende de Claude ni de ningún servidor. Los datos se guardan en el propio teléfono.

## Qué hay en esta carpeta

| Archivo | Para qué sirve |
|---|---|
| `index.html` | La app completa (se abre en el navegador del móvil) |
| `app.js` | El código de la app (se genera con `build.sh` a partir de `src/`) |
| `app.html` | La misma página sin cabecera, para la vista previa |
| `src/` | Código fuente por partes |
| `manifest.webmanifest`, `sw.js` | Lo que hace que se pueda instalar en Android y funcione sin conexión |
| `icons/` | Logo y los iconos de la app |
| `vendor/` | PDF (jsPDF) y lector de facturas (Tesseract, con el idioma español) |

## Probarla en un Android (instalación sencilla)

1. Sube la carpeta a un alojamiento con HTTPS (por ejemplo GitHub Pages o Netlify; los dos son gratuitos).
2. Abre la dirección en Chrome del móvil.
3. Menú ⋮ → **Instalar app** (o el botón «Instalar la app» en la sección Más).
4. Queda un icono en la pantalla de inicio y funciona sin conexión.

## Generar el APK (último paso)

Cuando el diseño esté cerrado: PWABuilder o Bubblewrap convierten esta misma app en un APK firmado para instalar directamente o publicar en Google Play. Con Capacitor se añaden después las notificaciones de los plazos de Hacienda y la consulta de matrícula sin limitaciones del navegador.

## Importante

- **Copia de seguridad**: los datos están solo en el móvil. Más → Copia de seguridad, una vez por semana.
- **Verifactu**: las facturas valen hasta el 30/06/2027. Antes de esa fecha hay que adaptar la app (registro, huella, QR y envío a la AEAT) o conectarla a un programa homologado.
- **Datos por matrícula**: la DGT no tiene una consulta pública gratuita. La app admite un servicio de pago por consulta (RegCheck); el bastidor se lee sin coste.

## Modificar el código

Edita los archivos de `src/` y ejecuta `./build.sh` para regenerar `app.js` e `index.html`.
