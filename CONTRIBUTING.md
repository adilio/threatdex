# Contributing to ThreatDex

Thank you for your interest in contributing to ThreatDex. This guide covers everything
you need to get a local environment running, understand the codebase, and submit a
high-quality pull request.

---

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Local Setup](#local-setup)
3. [Development Workflow](#development-workflow)
4. [Code Style](#code-style)
5. [Testing](#testing)
6. [Adding a CTI Source Connector](#adding-a-cti-source-connector)
7. [PR Checklist](#pr-checklist)
8. [Reporting Bugs](#reporting-bugs)

---

## Prerequisites

| Tool    | Version | Install                   |
|---------|---------|---------------------------|
| Node.js | >= 20   | https://nodejs.org        |
| pnpm    | >= 9    | `npm install -g pnpm`     |
| Git     | any     | https://git-scm.com       |

You also need a [Supabase](https://supabase.com) project (free tier works) to
run the app locally. No Docker or Python required.

---

## Local Setup

```bash
# 1. Clone the repository
git clone https://github.com/your-org/threatdex.git
cd threatdex

# 2. Install dependencies
pnpm install

# 3. Copy the environment template and fill in your Supabase credentials
cp .env.example .env
# Edit .env — add SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_KEY

# 4. Apply the database schema
#    Option A: Supabase CLI
supabase db push
#    Option B: Paste migrations/001_initial_schema.sql and migrations/002_rls_policies.sql
#              into the Supabase SQL editor in your project dashboard

# 5. Start the dev server
pnpm dev
# → http://localhost:5173
```

### Seed with real data

```bash
# Sync from MITRE ATT&CK (no API key required)
pnpm workers:mitre

# Sync from ETDA
pnpm workers:etda

# Run all sources in sequence
pnpm workers:all
```

---

## Development Workflow

ThreatDex follows the branching strategy defined in `CLAUDE.md` section 8.

```
main   ← protected, production-ready
└── dev   ← integration branch, all PRs target here
    └── feature/issue-{N}-{short-slug}   ← your working branch
```

### Step-by-step

```bash
# 1. Start from a fresh dev branch
git checkout dev
git pull origin dev

# 2. Create your feature branch (use the GitHub issue number)
git checkout -b feature/issue-42-my-feature

# 3. Make changes, commit often with conventional commit messages:
git commit -m "feat: add MISP galaxy cluster ingestion"
git commit -m "fix: deduplicate aliases before upsert"
git commit -m "test: add Vitest coverage for MISP worker"
git commit -m "docs: document MISP setup in DATA_SOURCES.md"

# 4. Before opening a PR, run all checks:
pnpm lint && pnpm test

# 5. Push and open a PR against dev
git push origin feature/issue-42-my-feature
# Open PR on GitHub: feature/issue-42-my-feature → dev
# PR title: [Issue #42] Brief description
```

**Never push directly to `main` or `dev`.**

### Conventional Commit Types

| Prefix      | When to use                                    |
|-------------|------------------------------------------------|
| `feat:`     | New feature or capability                      |
| `fix:`      | Bug fix                                        |
| `chore:`    | Maintenance — deps, config, tooling            |
| `test:`     | Adding or updating tests                       |
| `docs:`     | Documentation changes                          |
| `refactor:` | Code restructuring without behaviour change    |
| `perf:`     | Performance improvement                        |
| `ci:`       | CI/CD workflow changes                         |

---

## Code Style

### TypeScript / JavaScript

- Formatter: **Prettier** (config in root `.prettierrc` if present, otherwise defaults)
- Linter: **ESLint** with `typescript-eslint`
- Run: `pnpm lint` from the repo root

Key rules:
- No `console.log` in committed code (workers may use `console.warn`/`console.error` for operational logging)
- All React components must have explicit TypeScript prop types
- Use `const` by default; `let` only when reassignment is needed
- Prefer named exports in shared modules

---

## Testing

### Unit tests (Vitest)

```bash
pnpm test         # run once
pnpm test:watch   # watch mode
```

Requirements:
- Every new React component needs a Vitest unit test
- Every new worker needs a test that mocks `fetch` (or the Supabase client) and
  verifies that normalised output matches the `ThreatActor` schema
- Tests live in `tests/` (mirroring the source directory structure)

### End-to-end tests (Playwright)

```bash
pnpm test:e2e    # requires the app to be running (pnpm dev in another terminal)
```

Requirements:
- Every new page route needs a Playwright smoke test

---

## Adding a CTI Source Connector

Use this template when implementing a new TypeScript CTI data source worker.

### File structure

```
workers/
└── my-source.ts          ← main ingestion script
tests/workers/
└── my-source.test.ts     ← Vitest tests
```

Add the run command to `package.json` scripts:

```json
"workers:mysource": "tsx workers/my-source.ts"
```

### Worker template

```typescript
/**
 * My Source connector for ThreatDex.
 *
 * Required env vars:
 *   MY_SOURCE_API_KEY  — obtain from https://my-source.example.com/api
 *
 * Feature-flagged: exits cleanly if MY_SOURCE_API_KEY is not set.
 *
 * Usage:
 *   npx tsx workers/my-source.ts
 */

import { supabase, logSyncStart, logSyncComplete, logSyncError } from "./shared/supabase.js"
import { findMatchingActor, mergeActors } from "./shared/dedup.js"
import { computeThreatLevel, computeRarity } from "./shared/rarity.js"
import { toDbRecord } from "./shared/models.js"
import type { ThreatActorData, SourceAttribution } from "./shared/models.js"

const BASE_URL = "https://api.my-source.example.com/v1"

function isEnabled(): boolean {
  if (!process.env.MY_SOURCE_API_KEY) {
    console.warn("MY_SOURCE_API_KEY is not set — My Source connector is disabled.")
    return false
  }
  return true
}

async function fetchRaw(): Promise<Record<string, unknown>[]> {
  const response = await fetch(`${BASE_URL}/actors`, {
    headers: { Authorization: `Bearer ${process.env.MY_SOURCE_API_KEY}` },
  })
  if (!response.ok) throw new Error(`HTTP ${response.status}`)
  const json = (await response.json()) as { data: Record<string, unknown>[] }
  return json.data
}

function normalise(raw: Record<string, unknown>): ThreatActorData {
  const now = new Date().toISOString()
  const name = String(raw["name"] ?? "Unknown")

  const sources: SourceAttribution[] = [{
    source: "manual",
    sourceId: String(raw["id"]),
    fetchedAt: now,
    url: `https://my-source.example.com/actors/${raw["slug"]}`,
  }]

  const sophistication = "Medium"
  const ttpsCount = 0
  const campaignsCount = 0
  const threatLevel = computeThreatLevel({ sophistication, ttpsCount, campaignsCount })
  const rarity = computeRarity({ threatLevel, sophistication, sourcesCount: 1 })

  return {
    id: String(raw["slug"]),
    canonicalName: name,
    aliases: (raw["aliases"] as string[]) ?? [],
    description: String(raw["description"] ?? ""),
    motivation: ["espionage"],
    threatLevel,
    sophistication,
    sectors: [],
    geographies: [],
    tools: [],
    ttps: [],
    campaigns: [],
    rarity,
    sources,
    tlp: "WHITE",
    lastUpdated: now,
  }
}

async function main(): Promise<void> {
  if (!isEnabled()) return

  const logId = await logSyncStart("manual")
  let recordsSynced = 0

  try {
    const rawActors = await fetchRaw()

    for (const raw of rawActors) {
      try {
        let actor = normalise(raw)

        const existingId = await findMatchingActor(actor)
        if (existingId && existingId !== actor.id) {
          const { data: existingRow } = await supabase
            .from("actors").select("*").eq("id", existingId).single()
          if (existingRow) {
            actor = mergeActors(existingRow as Record<string, unknown>, actor)
          }
        }

        const { error } = await supabase
          .from("actors").upsert(toDbRecord(actor), { onConflict: "id" })

        if (error) {
          console.warn(`Upsert error for ${actor.canonicalName}:`, error.message)
        } else {
          recordsSynced++
        }
      } catch (e) {
        console.warn(`Failed to process actor — skipping:`, e)
      }
    }

    await logSyncComplete(logId, recordsSynced)
    console.log(`My Source sync complete — ${recordsSynced} actors upserted`)
  } catch (e) {
    await logSyncError(logId, String(e))
    throw e
  }
}

main().catch(console.error)
```

### Test template

```typescript
// tests/workers/my-source.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest"

const mockUpsert = vi.fn().mockResolvedValue({ error: null })
const mockSelect = vi.fn().mockReturnValue({
  eq: vi.fn().mockReturnValue({ single: vi.fn().mockResolvedValue({ data: null }) }),
})

vi.mock("../../workers/shared/supabase.js", () => ({
  supabase: {
    from: vi.fn().mockReturnValue({ upsert: mockUpsert, select: mockSelect }),
  },
  logSyncStart: vi.fn().mockResolvedValue("log-id"),
  logSyncComplete: vi.fn().mockResolvedValue(undefined),
  logSyncError: vi.fn().mockResolvedValue(undefined),
}))

vi.mock("../../workers/shared/dedup.js", () => ({
  findMatchingActor: vi.fn().mockResolvedValue(null),
  mergeActors: vi.fn((existing, incoming) => incoming),
}))

describe("my-source worker", () => {
  beforeEach(() => vi.clearAllMocks())

  it("skips when API key is not set", async () => {
    delete process.env.MY_SOURCE_API_KEY
    // import and run worker — it should not call supabase
    expect(mockUpsert).not.toHaveBeenCalled()
  })

  it("normalises actor to ThreatActor schema", () => {
    // test your normalise() function directly
    const raw = {
      id: 1,
      slug: "example-apt",
      name: "Example APT",
      aliases: ["APT-Example"],
      description: "A fictional threat actor for testing.",
    }
    // import normalise and call it
    // assert fields match ThreatActor schema
  })
})
```

### Register in the nightly cron

Add a step to `.github/workflows/sync.yml` under the sync job:

```yaml
- name: Sync My Source
  run: pnpm workers:mysource
  env:
    SUPABASE_URL: ${{ secrets.SUPABASE_URL }}
    SUPABASE_SERVICE_KEY: ${{ secrets.SUPABASE_SERVICE_KEY }}
    MY_SOURCE_API_KEY: ${{ secrets.MY_SOURCE_API_KEY }}
```

Then document the source in `docs/DATA_SOURCES.md` following the template there.

---

## PR Checklist

Before requesting review, confirm:

- [ ] Branch is named `feature/issue-{N}-{short-slug}`
- [ ] PR targets `dev`, not `main`
- [ ] PR title follows format: `[Issue #{N}] Brief description`
- [ ] PR description uses the template from `CLAUDE.md` section 9
- [ ] All new code has tests
- [ ] `pnpm lint && pnpm test` passes
- [ ] No `console.log` debug statements
- [ ] No secrets committed — all credentials read from environment
- [ ] `CLAUDE.md` has not been modified (requires separate PR)
- [ ] If UI changed: screenshots included in PR description

---

## Reporting Bugs

Please open a GitHub Issue with:

1. A clear title describing the problem
2. Steps to reproduce
3. Expected behaviour
4. Actual behaviour
5. Environment details (OS, Node.js version)

For security vulnerabilities, do **not** open a public issue. Follow the
responsible disclosure process in [SECURITY.md](SECURITY.md).
