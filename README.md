# Percy's Library

Lector de cómics moderno, rápido, minimalista. Full-stack: React + TypeScript + Tailwind + Zustand en el frontend, Express + Prisma + PostgreSQL (Supabase) en el backend.

## Características principales

- **Pipeline unificado**: cualquier formato (CBZ, CBR, PDF, carpeta de imágenes) se expone al reader como una secuencia de imágenes.
- **Extractores nativos**: `adm-zip` (CBZ), `node-unrar-js` (CBR sin binario externo), `pdfjs-dist` + `@napi-rs/canvas` (PDF), filesystem (carpetas).
- **Caché inteligente**: LRU en memoria + LRU en disco para portadas, páginas, miniaturas (con poda automática).
- **Reader profesional**: 5 modos (scroll vertical continuo / paginado horizontal / doble página / paginado vertical / webtoon), pantalla completa real, zoom (Ctrl+rueda), pinch-to-zoom táctil, drag-to-pan, fit ancho / alto / original, dirección LTR/RTL, click izquierda/derecha, atajos `← →`, espacio, `F`, `T`, `Esc`, `G`, `?`, `Ctrl+0`.
- **Thumbnail strip** virtualizado con lazy loading (IntersectionObserver) y highlight de página actual.
- **Preload inteligente** de páginas cercanas; liberación automática de páginas lejanas.
- **UI auto-oculta**: aparece al mover el mouse y desaparece tras 2.5 s.
- **Biblioteca**: grid limpio con barra de progreso sutil, búsqueda, filtros (todos / en progreso / leídos / favoritos), favoritos.
- **Estadísticas**: cómics totales/leídos, páginas leídas, racha actual y máxima, gráfico de últimos 30 días.
- **+100 logros** desbloqueables: hitos, páginas, rachas, favoritos, biblioteca, formatos, categorías y secretos.
- **+50 temas** seleccionables: clásicos, vibrantes, neón, tierra, monocromo, pastel, alto contraste y especiales (Nord, Drácula, Solarized, Matrix, Game Boy…).
- **Subida directa**: arrastra archivos `.cbz`, `.cbr`, `.pdf`, `.zip` o `.rar` a la biblioteca para añadirlos sin tocar el sistema de archivos.
- **Configuración persistente** y un saludo personalizado por hora del día.

## Stack

| Capa     | Tecnología |
|----------|------------|
| Frontend | React 18, TypeScript, Vite, TailwindCSS, Zustand, React Router |
| Backend  | Node.js, Express, Prisma, PostgreSQL (Supabase) |
| Procesamiento | sharp, adm-zip, node-unrar-js, pdfjs-dist, @napi-rs/canvas |

## Estructura

```
apps/
  server/        # API Express + Prisma + extractores + caché
  web/           # Frontend React + Vite
```

## Setup

Requiere Node.js >= 18.18 y una base de datos PostgreSQL (recomendado: [Supabase](https://supabase.com), capa gratuita suficiente).

1. Crea un proyecto en Supabase (o levanta un Postgres local).
2. Copia la connection string de tipo URI desde **Project Settings → Database → Connection string** y úsala como `DATABASE_URL`:

   ```bash
   cp apps/server/.env.example apps/server/.env
   # editar DATABASE_URL=postgresql://postgres:<password>@db.<ref>.supabase.co:5432/postgres
   ```

3. Instala dependencias, sincroniza el schema y arranca:

   ```bash
   npm install
   npm run prisma:generate
   npm --workspace apps/server run prisma:push
   npm run dev
   ```

- Backend: <http://localhost:4000>
- Frontend: <http://localhost:5173>

Para añadir cómics:

- **Arrastra y suelta** archivos `.cbz`, `.cbr`, `.pdf`, `.zip` o `.rar` directamente en la biblioteca, o usa el botón **Subir**.
- O coloca archivos / carpetas de imágenes en `apps/server/data/library/` y pulsa **Escanear** (también disponible vía `POST /api/library/scan`).

Configurable vía variables en `apps/server/.env` (ver `.env.example`):

| Variable        | Descripción                                          |
|-----------------|------------------------------------------------------|
| `LIBRARY_PATH`  | Carpeta raíz con tus cómics                          |
| `CACHE_DIR`     | Carpeta donde se guardan caché de portadas/páginas   |
| `DATABASE_URL`  | URL Postgres (`postgresql://...`). Obligatoria.       |
| `PORT`          | Puerto del backend (default `4000`)                  |

## Scripts

```bash
npm run dev          # backend + frontend en paralelo
npm run build        # build de ambos
npm run lint         # ESLint en ambos
npm run typecheck    # TypeScript en ambos
```

## Arquitectura del Reader

```
useImagePreload  ──►  pre-fetch de páginas cercanas
useIdleUI        ──►  auto-oculta UI tras 2.5 s
useFullscreen    ──►  fullscreen real
useKeybinds      ──►  ← → espacio F T Esc
ContinuousView   ──►  scroll vertical infinito + IntersectionObserver
PagedView        ──►  paginado con click-zone, fit, zoom, fade
ThumbnailStrip   ──►  miniaturas virtualizadas con lazy load
QuickSettings    ──►  cambia modo / fit / dirección sin salir
```

## API

| Método | Ruta                                  | Descripción |
|--------|---------------------------------------|-------------|
| `GET`  | `/api/library`                        | Lista cómics |
| `POST` | `/api/library/scan`                   | Re-escanea biblioteca |
| `GET`  | `/api/comics/:id`                     | Metadata |
| `GET`  | `/api/comics/:id/cover`               | Portada (webp, caché) |
| `GET`  | `/api/comics/:id/pages/:n`            | Página rasterizada |
| `GET`  | `/api/comics/:id/thumbs/:n`           | Miniatura (webp) |
| `POST` | `/api/comics/:id/progress`            | Guarda progreso |
| `POST` | `/api/comics/:id/favorite`            | Toggle favorito |
| `POST` | `/api/comics/:id/category`            | Asigna categoría |
| `GET`  | `/api/settings`                       | Lee settings |
| `PUT`  | `/api/settings`                       | Actualiza settings |
| `GET`  | `/api/stats`                          | Estadísticas |
| `GET`  | `/api/achievements`                   | Lista logros |

## Licencia

MIT
