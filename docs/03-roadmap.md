# ShopQA — Roadmap

## Fase 0: Setup y Spike Técnico (3-4 días)

**Objetivo**: Validar que las piezas técnicas más riesgosas funcionan antes de construir la app.

### Día 1: Figma API spike
- Crear script que recibe una URL de Figma y extrae:
  - El JSON del archivo (nodos, propiedades)
  - Screenshots de los frames principales
  - Tokens: colores, fonts, spacing de los nodos
- **Entregable**: Script CLI que printea tokens y guarda screenshots en disco
- **Riesgo a validar**: ¿La API devuelve suficiente detalle de tokens? ¿Los screenshots tienen buena resolución? ¿Cuántas requests necesitamos para un archivo típico?

### Día 2: Playwright + Browserless spike
- Conectar Playwright a Browserless.io
- Capturar una tienda Shopify real:
  - Full page screenshot (desktop + mobile)
  - Extraer computed styles de los primeros 50 elementos visibles
  - Extraer estructura HTML (headings, sections, meta tags)
  - Correr Lighthouse y capturar el JSON de resultados
- **Entregable**: Script CLI que genera screenshots + JSON de styles + Lighthouse report
- **Riesgo a validar**: ¿Browserless.io tiene latencia aceptable? ¿Playwright puede extraer computed styles de forma confiable? ¿Lighthouse funciona dentro de Browserless?

### Día 3: Claude Vision spike
- Tomar un screenshot de Figma y uno de la web (del mismo sitio)
- Mandar ambos a Claude Sonnet con un prompt de comparación visual
- Evaluar la calidad del análisis
- Probar con tokens: mandar JSON de Figma tokens vs computed CSS y pedir análisis
- **Entregable**: Prompt funcional + ejemplo de output de Claude que sea accionable
- **Riesgo a validar**: ¿Claude detecta diferencias visuales relevantes? ¿El output es parseable como JSON? ¿El costo por comparación es aceptable?

### Día 4: Setup del proyecto
- Crear repo en GitHub (Whitebay org)
- Init Next.js con App Router + Tailwind + shadcn/ui
- Crear proyecto en Supabase con tablas base (reports, issues, screenshots, report_modules)
- Configurar env vars en Vercel (Figma token, Browserless key, Claude key, Supabase keys)
- Deploy inicial a Vercel
- **Entregable**: App en Vercel con landing page placeholder y Supabase conectado

---

## Fase 1: Pipeline Core (5-6 días)

**Objetivo**: Flujo end-to-end funcionando — ingresar URLs, procesar, ver reporte básico.

### Día 5: Input form + orchestrator skeleton
- Página `/new` con form: URL Figma (opcional), URL Web, viewport selection
- API route `/api/reports` que crea el registro en Supabase
- Orchestrator skeleton que ejecuta los pasos en secuencia (todavía sin módulos reales)
- **Entregable**: El form crea un reporte en Supabase con status "processing"

### Día 6: Integración Figma (producción)
- `lib/figma/client.ts`: Wrapper tipado de la API
- `lib/figma/parser.ts`: Parsear URL → fileKey + nodeIds. Extraer tokens del JSON de nodos.
- Integrar en el orchestrator: extraer datos + guardar screenshots en Supabase Storage
- Actualizar `report_modules` con status del módulo Figma
- **Entregable**: Orchestrator extrae Figma data y la persiste

### Día 7: Integración Playwright (producción)
- `lib/playwright/capture.ts`: Conexión a Browserless, captura multi-viewport
- Script de extracción de computed styles (inyectado en la página via Playwright)
- Guardar screenshots + styles + HTML structure en Supabase
- **Entregable**: Orchestrator captura la web y la persiste

### Día 8: Primer módulo — SEO (algorítmico)
- `lib/modules/seo.ts`: Checks puramente algorítmicos (meta tags, headings, OG, schema, etc.)
- Genera issues en formato estándar con severidad
- Integrar con orchestrator
- **Entregable**: Primer set de issues reales generados y persistidos en Supabase

### Día 9: Claude integration + módulo Design QA
- `lib/claude/client.ts`: Wrapper de la API con retry logic
- `lib/claude/prompts/design-qa.ts`: Prompt para comparación visual
- `lib/modules/design-qa.ts`: Manda screenshots + tokens a Claude, parsea response como issues
- **Entregable**: Issues de Design QA generados por Claude y persistidos

### Día 10: Reporte básico
- Página `/report/[id]` que muestra:
  - Status de procesamiento (polling a Supabase)
  - Lista de issues agrupados por categoría
  - Screenshots side-by-side (Figma vs Web)
- UI básica pero funcional con shadcn/ui
- **Entregable**: Primer reporte visible end-to-end

---

## Fase 2: Todos los Módulos (6-7 días)

**Objetivo**: Completar los 7 módulos de QA. Un módulo por día aproximadamente.

### Día 11: Módulo Performance
- Integrar Lighthouse JSON parsing
- Checks: CWV, imágenes, scripts de terceros, transfer size
- Claude contextualiza resultados para Shopify (e.g., "este script de 450KB viene de la app de reviews Judge.me")
- **Entregable**: Issues de performance con contexto Shopify

### Día 12: Módulo Accesibilidad
- Lighthouse accessibility audit como base
- Checks adicionales: contraste (usando computed styles), labels, ARIA, focus visible
- Claude genera descripciones accionables
- **Entregable**: Issues de accesibilidad

### Día 13: Módulo Contenido
- Link checker: fetch todos los hrefs, reportar 4xx/5xx
- Detección de placeholders (regex + Claude para los ambiguos)
- Consistencia de CTAs (Claude compara textos de botones)
- Ortografía básica (Claude)
- **Entregable**: Issues de contenido

### Día 14: Módulo Shopify-específico
- Detección de patterns Shopify en el DOM (add to cart, price, variants, cart icon)
- Detección de apps de terceros (scripts conocidos, UI inyectada)
- Verificar policies links
- Claude analiza coherencia general del storefront
- **Entregable**: Issues Shopify-específicos

### Día 15: Módulo Cross-browser
- Captura con WebKit en Playwright (ya implementado en Fase 1)
- Claude Vision compara Chrome vs WebKit screenshots
- **Entregable**: Issues de cross-browser

### Día 16: Resumen ejecutivo + score
- `lib/claude/prompts/summary.ts`: Prompt que recibe todos los issues y genera resumen ejecutivo
- Cálculo de score por módulo y general
- Prompt final genera: score, resumen narrativo, top 5 issues críticos
- **Entregable**: Reporte completo con resumen ejecutivo

### Día 17: Buffer / catch-up
- Día para completar lo que haya quedado pendiente de la semana
- Testing con 3-5 tiendas Shopify reales
- Fix de bugs encontrados

---

## Fase 3: UI del Reporte + UX (4-5 días)

**Objetivo**: Hacer que el reporte sea profesional y útil para los tres perfiles de usuario.

### Día 18: Filtros y navegación del reporte
- Tabs por categoría (Design, Performance, SEO, A11y, Content, Shopify, Cross-browser)
- Toggles de severidad (Critical, Warning, Info)
- Contadores en cada tab/toggle
- Búsqueda dentro del reporte
- **Entregable**: Reporte filtrable y navegable

### Día 19: Visual diff interactivo
- Componente de comparación de screenshots: slider before/after (Figma vs Web)
- Highlight de regiones con diferencias
- Zoom en screenshots
- Carousel de screenshots (desktop/mobile, Chrome/WebKit)
- **Entregable**: Visual diff usable

### Día 20: Dashboard y historial
- Dashboard (`/`): lista de reportes con score, fecha, status
- Historial (`/history`): agrupa reportes por URL
- Re-run: botón para regenerar reporte con las mismas URLs
- **Entregable**: Navegación completa de la app

### Día 21: Progreso en tiempo real
- Supabase Realtime para updates de `report_modules`
- Pantalla de progreso con las 7 etapas mostrando status en vivo
- Transición automática a reporte cuando status = completed
- **Entregable**: Experiencia de espera informativa

### Día 22: Comparación entre reportes
- Si un reporte es re-run de otro, mostrar:
  - Issues resueltos (no aparecen en el nuevo)
  - Issues nuevos (no estaban antes)
  - Issues persistentes (siguen presentes)
- Badges: "3 resolved, 1 new, 12 persistent"
- **Entregable**: Diff entre reportes funcional

---

## Fase 4: Polish y Launch Interno (3-4 días)

### Día 23: Testing intensivo
- Correr ShopQA contra 10+ tiendas Shopify reales de distintos rubros y complejidad
- Documentar falsos positivos y falsos negativos
- Ajustar prompts de Claude basado en resultados
- Ajustar thresholds de severidad

### Día 24: Optimización
- Optimizar tiempo de procesamiento (paralelismo real entre módulos)
- Comprimir screenshots antes de enviar a Claude
- Cachear extracción de Figma para re-runs
- Medir costo real por reporte y optimizar si excede $0.30

### Día 25: Onboarding del equipo
- Documentación mínima: cómo usar, qué significa cada módulo, qué hacer con cada tipo de issue
- Sesión con el equipo para demo + feedback
- Ajustes basados en feedback inmediato

### Día 26: Buffer final
- Fixes de última hora
- Deploy de versión estable
- **🚀 Launch interno**

---

## Estimación total MVP: ~26 días de desarrollo

Asumiendo trabajo dedicado. Si es part-time (50%), multiplicar por 2 → ~3 meses calendario.

---

## Post-MVP: Ideas en backlog (sin priorizar)

Estas son cosas que no van en el MVP pero que tienen sentido como evolución:

### Mejoras al core
- Export de reporte a PDF
- Share link público (sin auth) para compartir reporte con clientes
- Soporte para viewports custom
- Comparación frame-por-frame (mapear secciones de Figma a secciones del DOM)
- Testing funcional de cart/checkout con Playwright
- Firefox como tercer browser en cross-browser
- BrowserStack/Sauce Labs para Safari real

### Integrations
- Slack: notificación cuando el reporte está listo
- GitHub: crear issues automáticamente desde el reporte
- Figma plugin: correr ShopQA directo desde Figma
- Shopify Admin API: detectar apps instaladas y correlacionar con scripts encontrados

### Escalar a SaaS
- Multi-tenancy con equipos y roles
- Billing (per-report o subscription)
- API pública para integrar en CI/CD
- Scheduled reports (correr QA automático cada semana)
- Alertas de regresión (si un score baja entre runs)

### AI upgrades
- Sugerencias de fix más específicas (con código CSS/HTML concreto)
- Auto-categorización de issues por esfuerzo estimado de fix
- Natural language querying del reporte ("¿qué issues de accesibilidad hay en mobile?")
- Comparación con benchmarks de industria ("tu LCP está en el percentil 30 de tiendas Shopify similares")
