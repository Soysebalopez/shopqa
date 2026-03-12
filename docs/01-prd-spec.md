# ShopQA — PRD Spec-Driven

## Qué es ShopQA

Plataforma de QA automatizado para equipos que desarrollan tiendas Shopify. El usuario ingresa una URL de Figma y una URL de la página deployada, y ShopQA genera un reporte completo de calidad analizado por IA.

## Problema

El QA entre diseño y desarrollo es manual, inconsistente y lento. Los issues se descubren tarde (o nunca). Cada persona del equipo revisa cosas distintas. No hay un estándar repetible.

## Usuarios

| Rol | Qué necesita | Qué mira del reporte |
|-----|-------------|----------------------|
| Developer Frontend | Discrepancias exactas (px, hex, font-size) + performance + a11y | Design QA, Performance, Accesibilidad |
| Diseñador UI/UX | Verificar fidelidad visual del diseño | Design QA (visual diff + tokens) |
| Project Manager | Vista general de calidad para decidir si se aprueba | Resumen ejecutivo, issues critical/warning |

## Flujos de usuario

### Flujo principal (Figma + Web)

1. Usuario ingresa URL de Figma + URL de la página web
2. Selecciona viewports: desktop (1440px), mobile (390px), o ambos
3. Click en "Generar Reporte"
4. Sistema muestra progreso en tiempo real (etapa por etapa)
5. Reporte completo se presenta con issues agrupados por categoría y severidad
6. Usuario filtra por categoría según su rol
7. Opcionalmente exporta o comparte el reporte

### Flujo solo Web (sin Figma)

1. Usuario ingresa solo la URL web
2. ShopQA ejecuta todos los módulos excepto Design QA
3. Genera reporte parcial (performance, SEO, a11y, contenido, Shopify, cross-browser)

### Flujo de re-check

1. Usuario accede a un reporte anterior
2. Click en "Re-run"
3. Nuevo reporte muestra qué issues se resolvieron y cuáles persisten

---

## Módulos de QA

### 1. Design QA (requiere Figma)

**Input**: Screenshots y tokens de Figma + screenshots y computed styles de la web

**Checks**:

- **Visual diff**: Overlay de screenshots Figma vs web. Claude con vision identifica diferencias contextuales ("el botón CTA se movió 20px a la izquierda", no solo "pixel X,Y cambió")
- **Tokens de diseño vs CSS**: Comparación de colores (fills vs background-color/color), tipografía (fontFamily, fontSize, fontWeight, lineHeight, letterSpacing vs computed equivalents), spacing (padding, margin, gap), border-radius, shadows/effects
- **Estructura**: Verificar que todas las secciones visibles en el diseño Figma existen en la página web y en el mismo orden

**Output por issue**:
```
{
  severity: "critical" | "warning" | "info",
  category: "design-qa",
  subcategory: "visual-diff" | "token-mismatch" | "structure",
  description: "El heading principal usa Inter 24px/32px en Figma pero 22px/28px en la web",
  figma_value: "Inter, 24px, line-height 32px",
  web_value: "Inter, 22px, line-height 28px",
  element: "h1.hero-title",
  screenshot_region: { x, y, width, height }  // opcional, para highlight en el visual diff
}
```

### 2. Performance

**Input**: Lighthouse run + análisis del DOM

**Checks**:

- Core Web Vitals: LCP (target < 2.5s), INP (target < 200ms), CLS (target < 0.1)
- Performance score de Lighthouse
- Imágenes sin optimizar: formato (PNG donde debería ser WebP/AVIF), peso excesivo (> 200KB), dimensiones mayores a las renderizadas, falta de lazy loading
- Scripts de terceros: cantidad, peso total, impacto en carga. Identificar qué app de Shopify inyecta cada script
- Tiempo total de carga (DOMContentLoaded, Load, fully interactive)
- Total transfer size de la página

**Severidad**:
- Critical: LCP > 4s, CLS > 0.25, imágenes > 1MB
- Warning: LCP 2.5-4s, imágenes > 200KB sin lazy loading, > 20 scripts de terceros
- Info: Sugerencias de optimización menores

### 3. SEO

**Input**: HTML de la página parseado

**Checks**:

- Meta title: presente, 30-60 caracteres
- Meta description: presente, 120-160 caracteres
- Open Graph tags: og:title, og:description, og:image, og:url
- Twitter Card tags: twitter:card, twitter:title, twitter:description, twitter:image
- Heading hierarchy: exactamente un H1, H2-H6 en orden lógico sin saltos
- Alt text en imágenes: todas las `<img>` tienen alt, ningún alt vacío o genérico ("image", "photo")
- Schema markup: Product (en páginas de producto), Organization, BreadcrumbList
- Canonical URL: presente y apuntando a la URL correcta
- No `noindex` accidental en pages que deberían indexarse
- Robots.txt accesible
- Sitemap.xml referenciado

**Severidad**:
- Critical: falta meta title, noindex en homepage/producto, falta H1
- Warning: meta description fuera de rango, falta OG image, alt text faltante
- Info: schema markup ausente, Twitter Cards faltantes

### 4. Accesibilidad

**Input**: DOM + computed styles + Lighthouse accessibility audit

**Checks**:

- Contraste de colores: todos los textos cumplen WCAG AA (4.5:1 normal, 3:1 large text)
- Labels en formularios: todo `<input>` tiene `<label>` asociado o `aria-label`
- Navegación por teclado: elementos interactivos son focuseables, tab order lógico
- ARIA attributes: botones, links y controles custom tienen roles y labels apropiados
- Focus visible: `:focus` o `:focus-visible` tienen estilo visible en todos los elementos interactivos
- Alt text en imágenes (cruce con SEO)
- Skip navigation link presente
- Landmark roles correctos (`<main>`, `<nav>`, `<header>`, `<footer>`)

**Severidad**:
- Critical: contraste < 3:1, formularios sin labels, botones sin texto accesible
- Warning: contraste entre 3:1 y 4.5:1, falta skip nav, landmarks incompletos
- Info: mejoras sugeridas de ARIA

### 5. Contenido

**Input**: DOM text content + HTTP requests

**Checks**:

- Links rotos: todos los `<a href>` internos y externos responden 200 (o redirect válido)
- Imágenes rotas: todos los `<img src>` cargan correctamente
- Texto placeholder: detección de "Lorem ipsum", "placeholder", "TBD", "TODO", "[texto]", "asdf", etc.
- Consistencia de CTAs: detectar variaciones en botones que deberían ser iguales ("Comprar", "Comprar ahora", "Agregar al carrito", "Buy now" en una tienda en español)
- Ortografía básica: detección de errores evidentes (Claude puede hacer esto bien)
- Contenido mixto: HTTP resources en página HTTPS

**Severidad**:
- Critical: links rotos en nav/CTAs, imágenes rotas visibles, lorem ipsum
- Warning: links rotos en footer, inconsistencia de CTAs, contenido mixto
- Info: sugerencias de ortografía

### 6. Shopify-específico

**Input**: DOM + HTTP requests + detección de Shopify patterns

**Checks**:

- Botón Add to Cart: presente, visible, clickeable en páginas de producto
- Precios: se muestran correctamente (formato de moneda consistente, decimales, compare-at price si aplica)
- Variant selectors: presentes y funcionales (color, size, etc.)
- Apps de terceros: detección de scripts/UI inyectados por apps de Shopify. Identificar apps que inyectan banners, popups o widgets visibles. Detectar si alguna app rompe el layout
- Favicon: presente y cargando correctamente
- Políticas legales: links a Privacy Policy y Terms of Service presentes (requerido por Shopify Payments)
- Cart functionality: el ícono/link del cart existe y es accesible
- Currency formatting: consistente en toda la página
- Product images: presentes, cargando, con zoom o gallery funcional

**Severidad**:
- Critical: falta Add to Cart, precios no visibles, policies faltantes
- Warning: variant selector roto, favicon faltante, app inyectando UI rota
- Info: sugerencias de mejora de UX en producto

### 7. Cross-browser

**Input**: Screenshots de Chrome vs WebKit (Safari approximation via Playwright)

**Checks**:

- Visual diff entre Chrome y WebKit screenshots (desktop y mobile)
- Claude analiza diferencias contextuales de rendering
- Focus en: tipografía (rendering differences), flexbox/grid gaps, border-radius, shadows, backdrop-filter, scroll behavior

**Severidad**:
- Critical: layout roto en uno de los browsers, elementos no visibles
- Warning: diferencias visuales notorias pero no funcionales
- Info: diferencias menores de rendering

---

## Estructura del reporte

### Resumen ejecutivo (arriba de todo)

- Score general (0-100) calculado como promedio ponderado de los módulos
- Cantidad de issues por severidad: X critical, Y warning, Z info
- Badges por módulo: ✅ Pass / ⚠️ Needs attention / ❌ Failed
- Timestamp y URLs analizadas

### Body del reporte

- Toggles/tabs para filtrar por categoría (Design, Performance, SEO, A11y, Contenido, Shopify, Cross-browser)
- Toggle para filtrar por severidad (Critical, Warning, Info)
- Cada issue es una card con: severidad, categoría, descripción generada por IA, valores esperado vs actual (cuando aplica), sugerencia de fix
- Screenshots con highlights donde aplica (visual diff, cross-browser)

### Comparación con reporte anterior (si existe)

- Issues resueltos (verde)
- Issues nuevos (amarillo)
- Issues persistentes (rojo)

---

## Constraints técnicos que necesitamos resolver

1. **Playwright no corre en Vercel serverless**: Necesitamos un servicio separado. Opciones: Browserless.io (SaaS), container propio en Railway/Fly.io, o Vercel Functions con runtime custom. Hay que decidir.

2. **Costo de Claude API con screenshots**: Un full-page screenshot de una tienda Shopify puede pesar 2-5MB. Mandar 4 screenshots (desktop Figma, desktop web, mobile Figma, mobile web) + el análisis de tokens puede costar $0.10-0.30 por request. Multiplicado por 7 módulos, podemos llegar a $0.50-1.50 por reporte. Hay que optimizar.

3. **Rate limits de Figma API**: En plan gratuito, ~30 requests/min. Para un archivo grande con muchos nodos, podemos necesitar múltiples requests. Necesitamos caching.

4. **Safari real vs WebKit de Playwright**: WebKit de Playwright no es Safari idéntico. Para MVP es aceptable, pero hay que comunicarlo en el reporte.

5. **Análisis de variants/cart en Shopify**: Verificar que variants funcionan requiere interacción (click, select). Playwright puede hacerlo pero agrega complejidad. Para MVP podemos limitarnos a verificar presencia en el DOM.
