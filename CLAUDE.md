# ThreatDex — Claude Code Agent Instructions

This file is the single source of truth for any Claude Code agent working on this
repository. Read it completely before touching any code. Every task handed to you
will reference a phase and issue number from the task list at the bottom.

-----

## 1. Project overview

ThreatDex is a web app that aggregates cyber threat actor intelligence from public
CTI feeds (MITRE ATT&CK, ETDA, AlienVault OTX, MISP, OpenCTI) and renders each
actor as an interactive “trading card” — flippable front/back with stats, TTPs,
campaigns, tools, and references.

**Tagline:** Know your adversaries, card by card.

-----

## 2. Monorepo structure

```
threatdex/
├── apps/
│   ├── web/                  # Next.js 14 (App Router), TypeScript, Tailwind
│   └── api/                  # FastAPI, Python 3.11+, SQLAlchemy, Pydantic v2
├── packages/
│   ├── schema/               # Shared Zod schemas + TypeScript interfaces
│   └── ui/                   # Shared React card components
├── workers/
│   ├── mitre-sync/           # TAXII 2.1 ingestion worker
│   ├── etda-sync/            # ETDA scraper worker
│   └── image-gen/            # AI hero image generation queue
├── infra/
│   ├── docker-compose.yml    # Local full-stack environment
│   └── terraform/            # Cloud infra (optional, later phase)
├── docs/
│   ├── API.md
│   ├── DATA_SOURCES.md
│   └── ARCHITECTURE.md
├── .github/
│   └── workflows/
│       ├── ci.yml            # Test + lint on push/PR
│       └── sync.yml          # Nightly data sync cron
├── .env.example
├── CLAUDE.md                 ← this file
├── CONTRIBUTING.md
├── SECURITY.md
└── README.md
```

-----

## 3. Tech stack

|Layer           |Technology                                                 |
|----------------|-----------------------------------------------------------|
|Frontend        |Next.js 14 (App Router), TypeScript, Tailwind CSS          |
|Backend         |FastAPI, Python 3.11, SQLAlchemy 2, Alembic, Pydantic v2   |
|Database        |PostgreSQL 15                                              |
|Cache / Queue   |Redis 7, Celery                                            |
|Package manager |pnpm (workspaces) for JS, pip + requirements.txt for Python|
|Testing (web)   |Vitest, Playwright                                         |
|Testing (api)   |pytest, httpx                                              |
|Linting         |ESLint + Prettier (JS/TS), Ruff (Python)                   |
|CI              |GitHub Actions                                             |
|Containerisation|Docker + Docker Compose                                    |

-----

## 4. Brand + design system

Apply these values consistently across all frontend work.

```
--color-wiz-blue:       #0254EC   /* primary CTAs, nav */
--color-purplish-pink:  #FFBFFF   /* accents, highlights */
--color-cloudy-white:   #FFFFFF   /* backgrounds, card surfaces */
--color-serious-blue:   #00123F   /* page background, card borders */
--color-blue-shadow:    #173AAA   /* secondary nav, card frames */
--color-sky-blue:       #6197FF   /* links, tags */
--color-light-sky-blue: #978BFF   /* subtle accents */
--color-pink-shadow:    #C64BA4   /* hover states */
--color-vibrant-pink:   #FF0BBE   /* rarity badges, "Dex" logotype */
--color-frosting-pink:  #FFBFD6   /* soft backgrounds */
--color-surprising-yellow: #FFFF00 /* MYTHIC tier glow, warnings */
```

Typography: monospace for all data/stat fields, a clean sans-serif for body copy.
Overall feel: dark navy base, vivid blue/pink accents — Wiz-style, optimistic security.

-----

## 5. Data model (canonical)

All ingestion workers and API endpoints must conform to this schema.
The authoritative TypeScript definition lives in `packages/schema/src/index.ts`.

```typescript
interface ThreatActor {
  id: string                    // slug, e.g. "apt28"
  canonicalName: string
  aliases: string[]
  mitreId?: string              // e.g. "G0007"
  country?: string
  countryCode?: string          // ISO 3166-1 alpha-2
  motivation: Motivation[]      // "espionage" | "financial" | "sabotage" | "hacktivism"
  threatLevel: number           // 1–10
  sophistication: Sophistication
  firstSeen?: string            // YYYY
  lastSeen?: string             // YYYY
  sectors: string[]
  geographies: string[]
  tools: string[]
  ttps: TTPUsage[]
  campaigns: Campaign[]
  description: string
  tagline?: string
  rarity: Rarity                // "MYTHIC" | "LEGENDARY" | "EPIC" | "RARE"
  imageUrl?: string
  imagePrompt?: string
  sources: SourceAttribution[]
  tlp: "WHITE" | "GREEN"
  lastUpdated: string           // ISO 8601
}

interface TTPUsage {
  techniqueId: string           // e.g. "T1566"
  techniqueName: string
  tactic: string
}

interface Campaign {
  name: string
  year?: string
  description: string
}

interface SourceAttribution {
  source: "mitre" | "etda" | "otx" | "misp" | "opencti" | "manual"
  sourceId?: string
  fetchedAt: string
  url?: string
}

type Motivation = "espionage" | "financial" | "sabotage" | "hacktivism" | "military"
type Sophistication = "Low" | "Medium" | "High" | "Very High" | "Nation-State Elite"
type Rarity = "MYTHIC" | "LEGENDARY" | "EPIC" | "RARE"
```

-----

## 6. Environment variables

Never commit secrets. Always read from environment. The full list lives in `.env.example`.

```bash
# Infrastructure (required)
DATABASE_URL=postgresql://user:password@localhost:5432/threatdex
REDIS_URL=redis://localhost:6379

# CTI sources (optional — feature-flag gracefully if missing)
OTX_API_KEY=
SOCRADAR_API_KEY=
OPENAI_API_KEY=
MISP_URL=
MISP_API_KEY=
OPENCTI_URL=
OPENCTI_API_KEY=
```

If an optional key is missing, the relevant connector should log a warning and skip
gracefully — never crash the application.

-----

## 7. API contract

The FastAPI backend exposes these endpoints. Frontend calls must match exactly.

```
GET  /api/actors                    # list, supports ?country=&motivation=&search=&limit=&offset=
GET  /api/actors/{id}               # single actor detail
GET  /api/actors/{id}/card/front    # rendered card front (PNG)
GET  /api/actors/{id}/card/back     # rendered card back (PNG)
GET  /api/search?q=                 # search names, aliases, tools, techniques
GET  /api/sources                   # list sources + last sync timestamps
POST /api/admin/sync/{source}       # trigger manual sync (requires ADMIN_SECRET header)
```

All list responses are paginated:

```json
{ "items": [...], "total": 312, "limit": 20, "offset": 0 }
```

-----

## 8. Git workflow — CRITICAL, follow exactly

Every task in this project follows this exact workflow. Do not deviate.

```
main          ← protected, production-ready at all times
└── dev       ← integration branch, PRs merge here first
    └── feature/issue-{N}-{short-slug}   ← your working branch
```

### Step-by-step for every task

```bash
# 1. Always start from a fresh dev branch
git checkout dev
git pull origin dev

# 2. Create your feature branch using the issue number
git checkout -b feature/issue-{N}-{short-slug}

# 3. Do the work. Commit often with conventional commits:
#    feat: add MITRE TAXII ingestion worker
#    fix: correct alias deduplication logic
#    chore: add docker-compose postgres service
#    test: add pytest coverage for actor endpoint
#    docs: update API.md with search endpoint

# 4. Before opening PR, always run:
pnpm lint && pnpm test          # for frontend/packages
ruff check . && pytest          # for backend/workers

# 5. Push and open PR against dev (not main)
git push origin feature/issue-{N}-{short-slug}
# Open PR: feature/issue-{N}-{short-slug} → dev
# Title format: [Issue #{N}] Brief description
# Body: fill the PR template (see Section 9)
```

**Never push directly to `main` or `dev`.**
**Every PR must have passing CI before merge.**

-----

## 9. PR template

Every PR must include this in the description:

```markdown
## What this PR does
<!-- 1–3 sentences -->

## Issue
Closes #{N}

## Changes
- [ ] List key changes as checkboxes

## Testing
<!-- How did you verify this works? -->
- [ ] Unit tests added/updated
- [ ] Ran locally with docker compose up
- [ ] No regressions in existing tests

## Screenshots (if frontend)
<!-- Before/after if UI changed -->

## Notes for reviewer
<!-- Anything tricky, decisions made, follow-up issues to open -->
```

-----

## 10. Testing requirements

- **API:** Every new endpoint needs at least one happy-path pytest test and one
  error-case test. Coverage must not drop below the current baseline.
- **Workers:** Each sync worker needs a test that mocks the upstream API and
  verifies the normalized output matches the ThreatActor schema.
- **Frontend:** New page routes need a Playwright smoke test. New components need
  a Vitest unit test.
- **Do not merge if tests are red.**

-----

## 11. Task list — phased breakdown

Each task below is a self-contained GitHub Issue. Hand any single item to an agent.
Items within a phase can run in parallel unless marked with ⛔ (blocked by another).

-----

### Phase 1 — Foundation

*Goal: any engineer can clone and run the full stack in under 5 minutes.*

|Issue|Title                                                   |Branch slug     |Notes                           |
|-----|--------------------------------------------------------|----------------|--------------------------------|
|#1   |Init monorepo with pnpm workspaces + Turborepo          |`init-monorepo` |First issue, unblocks everything|
|#2   |Add Docker Compose (postgres, redis, api, web)          |`docker-compose`|⛔ needs #1                      |
|#3   |Create .env.example with all required vars              |`env-example`   |Can run with #1                 |
|#4   |Scaffold FastAPI app with health endpoint               |`api-scaffold`  |⛔ needs #1                      |
|#5   |Scaffold Next.js 14 app with placeholder home page      |`web-scaffold`  |⛔ needs #1                      |
|#6   |Add Postgres schema + Alembic migrations for ThreatActor|`db-schema`     |⛔ needs #4                      |
|#7   |Add GitHub Actions CI workflow (lint + test)            |`ci-workflow`   |⛔ needs #1                      |

-----

### Phase 2 — Data ingestion

*Goal: real threat actor data flowing into the database.*

|Issue|Title                                            |Branch slug     |Notes                                                                   |
|-----|-------------------------------------------------|----------------|------------------------------------------------------------------------|
|#8   |MITRE TAXII 2.1 ingestion worker                 |`mitre-sync`    |⛔ needs #6. Pulls intrusion-set objects from attack-taxii.mitre.org     |
|#9   |ETDA scraper worker                              |`etda-sync`     |⛔ needs #6. Scrapes apt.etda.or.th/cgi-bin/listgroups.cgi + showcard.cgi|
|#10  |AlienVault OTX connector                         |`otx-sync`      |⛔ needs #6. Feature-flags off if OTX_API_KEY missing                    |
|#11  |Alias deduplication + actor merge logic          |`alias-dedup`   |⛔ needs #8 #9. Reconciles same actor across sources                     |
|#12  |Add nightly sync GitHub Actions cron             |`sync-cron`     |⛔ needs #8 #9                                                           |
|#13  |Admin sync endpoint POST /api/admin/sync/{source}|`admin-sync-api`|⛔ needs #8 #9                                                           |

-----

### Phase 3 — API layer

*Goal: frontend can fetch real data from the API.*

|Issue|Title                                                  |Branch slug       |Notes              |
|-----|-------------------------------------------------------|------------------|-------------------|
|#14  |GET /api/actors list endpoint with filters + pagination|`actors-list-api` |⛔ needs #6         |
|#15  |GET /api/actors/{id} detail endpoint                   |`actor-detail-api`|⛔ needs #14        |
|#16  |GET /api/search endpoint                               |`search-api`      |⛔ needs #14        |
|#17  |GET /api/sources endpoint                              |`sources-api`     |⛔ needs #6         |
|#18  |Add OpenAPI docs + export to docs/API.md               |`api-docs`        |⛔ needs #14 #15 #16|

-----

### Phase 4 — Frontend

*Goal: the card UI is live and pulling from the real API.*

|Issue|Title                                             |Branch slug        |Notes                                   |
|-----|--------------------------------------------------|-------------------|----------------------------------------|
|#19  |Migrate prototype card components into packages/ui|`ui-components`    |⛔ needs #5. Port the React artifact code|
|#20  |Home page — card grid with search + filters       |`home-page`        |⛔ needs #19 #14                         |
|#21  |Actor detail page /actors/[id]                    |`actor-detail-page`|⛔ needs #19 #15                         |
|#22  |Card flip animation + front/back layout           |`card-flip`        |⛔ needs #19                             |
|#23  |Card download — export as PNG via html2canvas     |`card-download`    |⛔ needs #22                             |
|#24  |Add generateMetadata() for actor pages (SEO)      |`actor-seo`        |⛔ needs #21                             |
|#25  |Mobile responsive layout                          |`mobile-layout`    |⛔ needs #20 #21                         |

-----

### Phase 5 — Image generation

*Goal: every actor has a unique AI-generated hero image.*

|Issue|Title                                                |Branch slug           |Notes                                       |
|-----|-----------------------------------------------------|----------------------|--------------------------------------------|
|#26  |Image prompt template builder from ThreatActor fields|`image-prompt-builder`|⛔ needs #6                                  |
|#27  |Celery image generation worker (OpenAI / Stability)  |`image-gen-worker`    |⛔ needs #26. Feature-flags off if no API key|
|#28  |Image storage + retrieval (Cloudflare R2 or local)   |`image-storage`       |⛔ needs #27                                 |
|#29  |Wire generated images into card front hero area      |`card-hero-image`     |⛔ needs #28 #22                             |

-----

### Phase 6 — Polish + launch

*Goal: production-ready, publicly shareable.*

|Issue|Title                                            |Branch slug        |Notes              |
|-----|-------------------------------------------------|-------------------|-------------------|
|#30  |Write CONTRIBUTING.md with connector template    |`contributing-docs`|                   |
|#31  |Write SECURITY.md + responsible disclosure policy|`security-docs`    |                   |
|#32  |Write docs/DATA_SOURCES.md with full attribution |`data-sources-docs`|                   |
|#33  |Add Playwright e2e smoke tests for core flows    |`e2e-tests`        |⛔ needs #20 #21    |
|#34  |Deploy web to Vercel + API to Railway            |`deploy`           |⛔ needs all Phase 4|
|#35  |Add optional MISP connector                      |`misp-connector`   |⛔ needs #11        |
|#36  |Add optional OpenCTI connector                   |`opencti-connector`|⛔ needs #11        |

-----

## 12. How to hand a task to an agent

Copy this block, fill in the issue number and title, and paste it to Claude Code:

```
You are working on the ThreatDex repository.
Read CLAUDE.md fully before writing any code.

Your task: Issue #{N} — {TITLE}

Acceptance criteria:
- {paste the acceptance criteria from the issue}

Workflow:
1. Checkout dev, pull latest
2. Create branch: feature/issue-{N}-{BRANCH-SLUG}
3. Implement the task per the spec in CLAUDE.md
4. Run all relevant tests and linters — fix any failures
5. Open a PR against dev using the PR template in Section 9
6. Do not merge — leave the PR open for review

Stay within the scope of this issue.
If you discover work that belongs in a different issue, open a GitHub Issue
for it and leave a note in your PR — do not do that work in this branch.
```

-----

## 13. Definition of done

A task is done when:

- [ ] Code is on a `feature/issue-{N}-*` branch
- [ ] All new code has tests
- [ ] `pnpm lint && pnpm test` passes (frontend/packages)
- [ ] `ruff check . && pytest` passes (backend/workers)
- [ ] PR is open against `dev` with the PR template filled out
- [ ] No secrets are committed
- [ ] No `console.log` or `print()` debug statements left in
- [ ] CLAUDE.md has not been modified (changes need a separate PR)
