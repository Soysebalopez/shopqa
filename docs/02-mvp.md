# ShopQA — MVP Definition

## Principio del MVP

Flujo end-to-end funcional lo antes posible. Es mejor tener todos los módulos funcionando con checks básicos que un solo módulo perfecto. El valor está en la vista completa de calidad, no en la profundidad de cada check individual.

---

## Stack técnico

### Frontend + API
- **Next.js 14+** (App Router) en **Vercel**
- UI: **shadcn/ui** + **Tailwind CSS**
- State: React Server Components donde se pueda, client components para interactividad del reporte

### Base de datos + Storage
- **Supabase**
  - PostgreSQL: reportes, issues, historial, configuración
  - Storage: screenshots (Figma exports, web captures, diffs)
  - Auth: Supabase Auth (magic link o Google OAuth) — simple para equipo interno

### Captura web + Browser automation
- **Playwright** corriendo en un servicio separado
- Para MVP: **Browserless.io** (tier gratuito: 1000 sessions/mes, suficiente para arrancar)
- Alternativa si necesitamos más control: container Docker con Playwright en **Railway** o **Fly.io**

### APIs externas
- **Figma REST API** — extracción de diseño, tokens, screenshots
- **Claude API (Sonnet)** — análisis de diferencias, generación de reporte
- **Lighthouse** — vía `lighthouse` npm package corriendo dentro de Playwright/Browserless

### Procesamiento
- Las API routes de Next.js orquestan todo
- Cada módulo de QA es una función independiente
- Los módulos corren en paralelo donde sea posible
- Resultados parciales se van guardando en Supabase mientras se procesan

---

## Arquitectura de alto nivel

```
┌─────────────────────────────────────────────────┐
│                  FRONTEND (Next.js)             │
│  ┌──────────┐  ┌──────────┐  ┌──────────────┐  │
│  │ Input    │  │ Progress │  │ Report View  │  │
│  │ Form     │  │ Screen   │  │ + Filters    │  │
│  └──────────┘  └──────────┘  └──────────────┘  │
└──────────────────────┬──────────────────────────┘
                       │
              ┌────────▼────────┐
              │   API Routes    │
              │  (Orchestrator) │
              └───┬───┬───┬────┘
                  │   │   │
    ┌─────────────┤   │   ├─────────────┐
    │             │   │   │             │
    ▼             ▼   │   ▼             ▼
┌────────┐ ┌─────────┐│ ┌──────┐ ┌──────────┐
│ Figma  │ │Playwright││ │Claude│ │Lighthouse│
│  API   │ │(Browser- ││ │ API  │ │(in Pw)   │
│        │ │ less.io) ││ │      │ │          │
└───┬────┘ └────┬─────┘│ └──┬───┘ └────┬─────┘
    │           │      │    │           │
    └───────────┴──────┼────┴───────────┘
                       │
              ┌────────▼────────┐
              │    Supabase     │
              │  ┌───────────┐  │
              │  │ PostgreSQL│  │
              │  │ (reportes)│  │
              │  ├───────────┤  │
              │  │ Storage   │  │
              │  │(screenshots│  │
              │  └───────────┘  │
              └─────────────────┘
```

---

## Modelo de datos (Supabase)

### Tabla: `reports`
```sql
id              uuid PRIMARY KEY DEFAULT gen_random_uuid()
created_at      timestamptz DEFAULT now()
figma_url       text          -- puede ser null (flujo solo web)
web_url         text NOT NULL
viewports       text[]        -- ['desktop', 'mobile']
status          text          -- 'processing' | 'completed' | 'failed'
overall_score   integer       -- 0-100
summary         jsonb         -- resumen ejecutivo generado por Claude
user_id         uuid REFERENCES auth.users
parent_report_id uuid         -- si es un re-run, referencia al reporte original
```

### Tabla: `issues`
```sql
id              uuid PRIMARY KEY DEFAULT gen_random_uuid()
report_id       uuid REFERENCES reports ON DELETE CASCADE
category        text          -- 'design-qa' | 'performance' | 'seo' | 'a11y' | 'content' | 'shopify' | 'cross-browser'
subcategory     text          -- e.g. 'visual-diff', 'token-mismatch', 'core-web-vitals'
severity        text          -- 'critical' | 'warning' | 'info'
title           text          -- título corto del issue
description     text          -- descripción detallada generada por Claude
expected_value  text          -- valor en Figma / valor esperado
actual_value    text          -- valor en la web / valor actual
element         text          -- CSS selector o identificador del elemento
suggestion      text          -- sugerencia de fix generada por Claude
screenshot_key  text          -- key en Supabase Storage para screenshot con highlight
metadata        jsonb         -- datos extras específicos del módulo
resolved        boolean DEFAULT false  -- para comparación con reportes anteriores
```

### Tabla: `screenshots`
```sql
id              uuid PRIMARY KEY DEFAULT gen_random_uuid()
report_id       uuid REFERENCES reports ON DELETE CASCADE
type            text          -- 'figma-desktop' | 'figma-mobile' | 'web-desktop' | 'web-mobile' | 'web-desktop-safari' | 'diff-desktop' | 'diff-mobile'
viewport        text          -- 'desktop' | 'mobile'
storage_path    text          -- path en Supabase Storage
width           integer
height          integer
```

### Tabla: `report_modules`
```sql
id              uuid PRIMARY KEY DEFAULT gen_random_uuid()
report_id       uuid REFERENCES reports ON DELETE CASCADE
module          text          -- nombre del módulo
status          text          -- 'pending' | 'running' | 'completed' | 'failed'
score           integer       -- 0-100 del módulo
started_at      timestamptz
completed_at    timestamptz
error           text          -- si falló, el motivo
```

---

## Pipeline de procesamiento

Cuando el usuario hace click en "Generar Reporte":

### Paso 1: Creación del reporte (inmediato)
- Crear registro en `reports` con status `processing`
- Crear registros en `report_modules` para cada módulo con status `pending`
- Devolver `report_id` al frontend
- Frontend empieza a pollear status (o usa Supabase Realtime)

### Paso 2: Extracción en paralelo (~30-60s)

**Branch A — Figma** (si hay URL):
1. Parsear URL → extraer fileKey y nodeIds
2. `GET /v1/files/{fileKey}/nodes?ids={nodeIds}` → árbol de nodos con propiedades
3. `GET /v1/images/{fileKey}?ids={nodeIds}&format=png&scale=2` → screenshots desktop
4. Si hay frame mobile en Figma, exportar también
5. Guardar screenshots en Supabase Storage
6. Parsear tokens (colores, fonts, spacing) del JSON de nodos

**Branch B — Web (Chrome)**:
1. Conectar a Browserless.io con Playwright
2. Navegar a la URL en viewport desktop (1440x900)
3. Full page screenshot → Supabase Storage
4. Extraer computed styles del DOM (script inyectado)
5. Extraer HTML structure (headings, sections, links, images, meta tags)
6. Correr Lighthouse (performance + accessibility)
7. Repetir en viewport mobile (390x844)

**Branch C — Web (WebKit/Safari)**:
1. Misma URL en Playwright con browser WebKit
2. Screenshots desktop + mobile
3. Guardar en Storage

### Paso 3: Análisis por módulo (en paralelo, ~30-60s)

Cada módulo recibe los datos que necesita y genera sus issues:

| Módulo | Input | Proceso |
|--------|-------|---------|
| Design QA | Screenshots Figma + Web + Tokens + Computed Styles | Claude Vision compara screenshots. Algoritmo compara tokens vs CSS. Claude genera descripciones. |
| Performance | Lighthouse JSON | Parsear métricas, clasificar por thresholds, Claude genera contexto Shopify-específico |
| SEO | HTML parseado | Checks algorítmicos (meta tags, headings, schema). Claude valida coherencia del contenido |
| Accesibilidad | Lighthouse a11y + DOM | Checks algorítmicos (contraste, labels, ARIA). Lighthouse score como base |
| Contenido | DOM text + HTTP responses | Link checker algorítmico. Claude detecta placeholders, inconsistencias, ortografía |
| Shopify | DOM + HTTP | Checks algorítmicos (add to cart, prices, policies). Claude identifica apps problemáticas |
| Cross-browser | Screenshots Chrome vs WebKit | Claude Vision compara screenshots |

### Paso 4: Generación del reporte (~15-30s)

1. Todos los issues se guardan en la tabla `issues`
2. Claude recibe un resumen de todos los issues y genera:
   - Score general (0-100) con ponderación por categoría
   - Resumen ejecutivo en lenguaje natural
   - Top 5 issues más críticos
3. Se actualiza `reports.status` a `completed`
4. Frontend muestra el reporte completo

---

## Decisiones técnicas para el MVP

### Qué hacemos simple (MVP) vs qué queda para después

| Aspecto | MVP (ahora) | Futuro |
|---------|-------------|--------|
| Auth | Supabase magic link, sin roles | Roles (admin, viewer), teams |
| Figma parsing | URL manual, parsear fileKey | OAuth flow con Figma, file picker |
| Viewports | 1440px desktop, 390px mobile fijos | Custom viewports, tablet |
| Cross-browser | Chrome + WebKit (Playwright) | BrowserStack para Safari real + Firefox |
| Reporte | Web view con filtros | Export a PDF, share link público |
| Re-run comparison | Diff básico (resolved/new/persistent) | Trend charts, regression alerts |
| Concurrencia | 1 reporte a la vez por usuario | Queue con Bull/Redis, múltiples concurrentes |
| Notifications | Nada — el usuario espera | Email/Slack cuando el reporte está listo |
| Variant testing | Solo verificar presencia en DOM | Click testing con Playwright |

### Prompts de Claude — Estrategia

El prompt engineering es clave para la calidad del reporte. La estrategia:

- **Un prompt por módulo**: Cada módulo tiene su system prompt especializado. Esto permite iterar independientemente.
- **Structured output**: Cada prompt le pide a Claude que responda en JSON con schema definido. Esto permite parsear los issues programáticamente.
- **Vision para visual diff y cross-browser**: Mandamos los screenshots como imágenes en el prompt. Claude analiza y describe diferencias en lenguaje natural.
- **Contexto Shopify**: Los prompts incluyen contexto sobre patrones comunes de Shopify (liquid templates, apps de terceros, temas populares) para que el análisis sea más relevante.

### Cómo optimizamos el costo de Claude

- Usar **Sonnet** (no Opus) para todos los módulos — es significativamente más barato y suficientemente bueno para este caso
- **Comprimir screenshots** antes de enviar: resize a max 1500px de ancho, quality 80%, formato WebP si la API lo soporta
- **Batching**: En vez de una llamada por issue, mandar toda la data de un módulo en una sola llamada y pedir todos los issues de vuelta
- **Checks algorítmicos primero**: Todo lo que se pueda verificar sin IA (meta tags, link checker, contraste, Lighthouse) se hace algorítmicamente. Claude solo interviene para contextualizar y generar descripciones humanas
- **Target**: < $0.30 por reporte en el MVP

---

## Páginas del frontend

### 1. Dashboard (`/`)
- Lista de reportes generados (tabla con: URL, fecha, score, status)
- Botón "Nuevo Reporte"

### 2. Nuevo reporte (`/new`)
- Input: URL de Figma (opcional)
- Input: URL de la página web
- Checkboxes: viewports (desktop, mobile)
- Botón "Generar Reporte"

### 3. Progreso (`/report/[id]` con status processing)
- Barra de progreso con etapas:
  - ⏳ Extrayendo datos de Figma...
  - ⏳ Capturando página web...
  - ⏳ Analizando Design QA...
  - ⏳ Analizando Performance...
  - etc.
- Cada etapa pasa a ✅ cuando completa
- Usa Supabase Realtime para updates en vivo

### 4. Reporte (`/report/[id]` con status completed)
- Header: score general, badges por módulo, URLs, fecha
- Filtros: categoría (tabs), severidad (toggles)
- Lista de issues: cards con severidad, descripción, valores, sugerencia
- Sección de screenshots con visual diff (slider before/after o overlay)
- Si hay reporte anterior: indicadores de resolved/new/persistent

### 5. Historial (`/history`)
- Lista de todos los reportes ordenados por fecha
- Filtro por URL
- Posibilidad de agrupar reportes de la misma URL para ver evolución

---

## Qué necesitamos para arrancar

### Cuentas y API keys
- [ ] Figma API token (Personal Access Token del equipo)
- [ ] Cuenta en Browserless.io (tier free: 1000 sessions/mes)
- [ ] API key de Anthropic (Claude Sonnet)
- [ ] Proyecto en Supabase (ya tenés experiencia con esto)
- [ ] Proyecto en Vercel (igual)

### Repositorio
- Repo en GitHub bajo Whitebay org
- Next.js con App Router
- Estructura de carpetas orientada a módulos:

```
shopqa/
├── app/
│   ├── page.tsx              # Dashboard
│   ├── new/page.tsx          # Nuevo reporte
│   ├── report/[id]/page.tsx  # Reporte + progreso
│   └── history/page.tsx      # Historial
├── lib/
│   ├── figma/
│   │   ├── client.ts         # Figma API wrapper
│   │   ├── parser.ts         # Parsear URL, extraer tokens del JSON
│   │   └── types.ts
│   ├── playwright/
│   │   ├── capture.ts        # Captura web (screenshots, DOM, styles)
│   │   ├── lighthouse.ts     # Correr Lighthouse
│   │   └── types.ts
│   ├── modules/
│   │   ├── design-qa.ts      # Módulo Design QA
│   │   ├── performance.ts    # Módulo Performance
│   │   ├── seo.ts            # Módulo SEO
│   │   ├── accessibility.ts  # Módulo Accesibilidad
│   │   ├── content.ts        # Módulo Contenido
│   │   ├── shopify.ts        # Módulo Shopify
│   │   ├── cross-browser.ts  # Módulo Cross-browser
│   │   └── types.ts          # Tipos compartidos (Issue, Severity, etc.)
│   ├── claude/
│   │   ├── client.ts         # Claude API wrapper
│   │   ├── prompts/          # System prompts por módulo
│   │   │   ├── design-qa.ts
│   │   │   ├── performance.ts
│   │   │   ├── seo.ts
│   │   │   ├── accessibility.ts
│   │   │   ├── content.ts
│   │   │   ├── shopify.ts
│   │   │   ├── cross-browser.ts
│   │   │   └── summary.ts    # Prompt para resumen ejecutivo
│   │   └── types.ts
│   ├── supabase/
│   │   ├── client.ts
│   │   ├── queries.ts        # Queries tipadas
│   │   └── storage.ts        # Upload/download de screenshots
│   └── orchestrator.ts       # Pipeline principal que coordina todo
├── components/
│   ├── report/               # Componentes del reporte
│   ├── ui/                   # shadcn/ui components
│   └── ...
└── supabase/
    └── migrations/           # SQL migrations
```
