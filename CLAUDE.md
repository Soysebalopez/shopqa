# ShopQA — Project Rules

## Project Overview
ShopQA is an automated QA platform for Shopify stores. Users input a Figma URL + web URL, and the system generates a comprehensive quality report analyzed by AI.

## Tech Stack
- **Framework**: Next.js 14+ (App Router) on Vercel
- **UI**: shadcn/ui + Tailwind CSS
- **Database**: Supabase (PostgreSQL + Storage + Realtime)
- **Browser automation**: Playwright via Browserless.io
- **AI**: Claude Sonnet for analysis
- **Design source**: Figma REST API

## Architecture
- `app/` — Next.js pages and API routes
- `lib/figma/` — Figma API client and token parser
- `lib/playwright/` — Web capture via Browserless.io
- `lib/modules/` — QA modules (seo, performance, a11y, content, shopify, design-qa, cross-browser)
- `lib/claude/` — Claude API client + prompts per module
- `lib/supabase/` — DB client, queries, storage helpers
- `components/` — React components (shadcn/ui based)
- `supabase/migrations/` — SQL migrations

## Commit Rules
- One commit per "day" of roadmap (each day = a logical unit of work)
- Commit message format: `day-XX: brief description`
- Always update this CLAUDE.md in every commit with progress
- Push after each commit

## Code Conventions
- TypeScript strict mode
- Server Components by default, "use client" only when needed
- All API calls go through `lib/` wrappers, never direct fetch in components
- Issue types follow `lib/modules/types.ts` — always use the `Issue` interface
- Prompts for Claude live in `lib/claude/prompts/` — one file per module

## ENV vars status
- [x] `NEXT_PUBLIC_SUPABASE_URL` — https://hptlczpyyajtcoysyrqe.supabase.co (set in .env.local + Vercel)
- [x] `NEXT_PUBLIC_SUPABASE_ANON_KEY` — Set in .env.local + Vercel
- [x] `SUPABASE_SERVICE_ROLE_KEY` — Set in .env.local + Vercel
- [ ] `FIGMA_ACCESS_TOKEN` — **PENDING**: Generate in Figma > Settings > Personal Access Tokens
- [x] `BROWSERLESS_TOKEN` — Set in .env.local + Vercel
- [x] `ANTHROPIC_API_KEY` — Set in .env.local + Vercel

## Supabase project
- Project ID: `hptlczpyyajtcoysyrqe`
- Region: sa-east-1
- Migration `initial_schema` applied (tables: reports, issues, screenshots, report_modules)

## Progress Log

### Day 1 (Setup) — 2026-03-12
- Created Next.js project with App Router + Tailwind + shadcn/ui
- Created full project structure per MVP doc
- Implemented types for all modules (`lib/modules/types.ts`)
- Figma client + URL parser + token extractor (`lib/figma/`)
- Playwright capture scaffold (`lib/playwright/capture.ts`)
- SEO module with algorithmic checks (`lib/modules/seo.ts`)
- Claude API client with retry logic (`lib/claude/client.ts`)
- Claude prompts for Design QA, SEO, and Summary
- Supabase client + typed queries + database types
- SQL migration for initial schema (reports, issues, screenshots, report_modules)
- All 4 frontend pages: Dashboard, New Report, Report View, History
- API route for creating reports (`/api/reports`)
- `.env.example` with all required vars
- GitHub repo created, Vercel project linked

### Day 2 (Pipeline + Real Data) — 2026-03-12
- Built orchestrator (`lib/orchestrator.ts`) — coordinates full pipeline
- Pipeline runs: Figma extraction, web capture, module analysis, summary generation
- SEO module fully integrated (algorithmic + Claude enrichment)
- Other modules have placeholder structure ready for implementation
- API route POST /api/reports now creates real Supabase records and triggers pipeline
- API route GET /api/reports/[id] returns report + issues + modules
- Dashboard and Report pages now fetch real data from API
- Report page polls for updates while status is "processing"
- Added module score calculation (100 - deductions per severity)

### Day 3 (All Modules Implemented) — 2026-03-12
- Performance module: CWV checks (LCP, CLS, TBT, FCP), Lighthouse score analysis
- Accessibility module: contrast checking (WCAG luminance calc), heading structure, alt text, Lighthouse a11y
- Content module: placeholder detection (regex patterns), link checking (HTTP HEAD), broken images, mixed content
- Shopify module: Add to Cart detection, price display, policy links, cart link, currency consistency
- Design QA module: Claude Vision visual diff + algorithmic token comparison (colors, typography)
- Cross-browser module: Chrome vs WebKit screenshot comparison via Claude Vision
- Claude prompts for all modules (performance, accessibility, content, shopify)
- Orchestrator updated to use all real modules with parallel execution
- All 7 QA modules now functional end-to-end

### Roadmap Reference
See `docs/03-roadmap.md` for full day-by-day plan.
- Phase 0 (Setup + Spikes): Days 1-4
- Phase 1 (Pipeline Core): Days 5-10
- Phase 2 (All Modules): Days 11-17
- Phase 3 (UI + UX): Days 18-22
- Phase 4 (Polish + Launch): Days 23-26
