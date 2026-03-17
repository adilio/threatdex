# ThreatDex — Simplification Review

> Architecture review focused on reducing dependencies while preserving full functionality.
> Preferences: Vite-based framework, Netlify hosting, minimal dependencies.

---

## What's Actually There

The app is **~95% complete**. The only missing piece is `apps/web/src/lib/api.ts` (the
client-side fetch functions). Everything else — UI components, API endpoints, workers,
DB schema — is fully implemented.

---

## Recommendations

### 1. Frontend: Next.js → React Router v7

React Router v7 (the new Remix) is the right Vite-native swap:

- **Vite under the hood** — satisfies the Vite preference
- **SSR support preserved** — important for SEO on shareable actor pages (APT28, Lazarus
  Group, etc. are all indexable)
- **Official Netlify adapter** — `@react-router/serve` deploys to Netlify edge natively
- **File-based routing** — same mental model as Next.js App Router
- Migration is mechanical: `app/routes/` instead of `app/`, loaders instead of Server
  Components

> A pure Vite SPA loses SSR, which matters here — every actor page deserves a proper
> `<title>` and OpenGraph card for sharing.

---

### 2. Backend: Python/FastAPI + PostgreSQL + Redis + Celery → Supabase

This is the biggest win. The entire Python stack gets replaced by a single package:

- **`@supabase/supabase-js`** — replaces FastAPI, SQLAlchemy, Alembic, Celery, Redis,
  and psycopg2
- Supabase auto-generates REST + realtime APIs directly from your Postgres schema
- The `/api/actors`, `/api/search`, `/api/sources` endpoints become direct Supabase
  queries inside React Router loaders
- Supabase has its own migration system (replaces Alembic)

The existing Python workers (MITRE, ETDA, OTX) **do not need to be rewritten** — they
already run as standalone scripts. Point them at Supabase instead of local Postgres and
run them as **GitHub Actions scheduled jobs** (already wired in `sync.yml`). No
Celery or Redis needed.

The card PNG endpoints (`/api/actors/{id}/card/front`, `/api/actors/{id}/card/back`) can
be dropped entirely — `html2canvas` is already in the frontend for exactly this purpose.

---

### 3. Monorepo → Flat Structure

With no Python backend, there is only one app. The monorepo is dead weight.

| Remove | Replace with |
|--------|-------------|
| `packages/schema/` | `src/schema/` folder |
| `packages/ui/` | `src/components/ui/` folder |
| `turbo.json` + Turborepo | nothing |
| `pnpm-workspace.yaml` | nothing |
| `tsup` (package bundler) | nothing |
| `apps/web/` nesting | root of repo |

Single `package.json`, single `vite.config.ts`, done.

---

### 4. Tailwind v4

Tailwind v4 (released early 2025) ships a Vite plugin that eliminates `postcss.config.js`
and `autoprefixer`. Drop 2 packages and one config file.

---

## Net Dependency Change

### JavaScript — removed (6)

| Package | Reason |
|---------|--------|
| `next` | Replaced by React Router v7 |
| `eslint-config-next` | Next.js-specific, no longer needed |
| `turbo` | Monorepo orchestration, not needed in flat structure |
| `tsup` | Internal package bundler, not needed in flat structure |
| `postcss` | Handled natively by Tailwind v4 Vite plugin |
| `autoprefixer` | Handled natively by Tailwind v4 Vite plugin |

### JavaScript — added (3)

| Package | Purpose |
|---------|---------|
| `react-router` | Vite-native framework replacing Next.js |
| `@react-router/netlify` | Netlify SSR/edge adapter |
| `@supabase/supabase-js` | Replaces entire Python backend |

### Python — entire stack removed

All `requirements.txt` files across `apps/api/` and all `workers/` are eliminated:

`fastapi` · `uvicorn` · `sqlalchemy` · `alembic` · `psycopg2-binary` · `pydantic` ·
`pydantic-settings` · `celery` · `redis` · `httpx` · `aiohttp` · `jinja2` · `pillow` ·
`python-multipart` · `anyio` · `pytest-asyncio` · `pytest-cov` · `ruff` ·
`taxii2-client` · `beautifulsoup4` · `python-slugify` · `openai` ·
`pymisp` · `pycti`

### Infrastructure removed

- `infra/docker-compose.yml` — no local Postgres/Redis needed
- `apps/api/Dockerfile` — no Python service
- `apps/web/Dockerfile` — Netlify handles builds

---

## What Stays Identical

| Area | Notes |
|------|-------|
| All UI components | `CardFront`, `CardBack`, `ThreatActorCard`, etc. — zero changes |
| All Zod schemas | Zero changes |
| Brand / design system | Colors, typography, animations — zero changes |
| GitHub Actions CI | Minor updates to remove Python jobs |
| Data sync workers | Change DB target URL to Supabase, run via GitHub Actions cron |
| `html2canvas` card download | Already in the frontend, replaces PIL card PNG endpoints |
| Vitest unit tests | All still valid |

---

## Before / After Summary

| Area | Before | After |
|------|--------|-------|
| Frontend framework | Next.js 14 | React Router v7 (Vite) |
| Backend | FastAPI + Python | Supabase |
| Database | PostgreSQL + Alembic | Supabase Postgres |
| Queue | Redis + Celery | GitHub Actions cron |
| Local dev | Docker Compose (5 services) | `npm run dev` + Supabase local |
| Repo structure | Turborepo monorepo | Flat single app |
| `package.json` files | 4 | 1 |
| `requirements.txt` files | 7 | 0 |
| JS packages (approx) | 20+ | ~17 |
| Python packages (approx) | 24 | 0 |

---

## Suggested Migration Order

1. Flatten monorepo — move `packages/schema` and `packages/ui` into `src/`, remove
   Turborepo and tsup
2. Swap framework — replace Next.js with React Router v7 + Vite config
3. Wire Supabase — set up schema, migrate data model, replace API calls
4. Retire Python stack — remove `apps/api/`, update workers to target Supabase
5. Update CI — remove Python jobs, add Supabase local in CI if needed
