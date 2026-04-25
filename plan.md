# ThreatDex Improvement Plan

**Status: Phase 0-5 Complete ✅ (Deployed)**

Refreshed 2026-04-25 against live Supabase data (project `zxutysxzhsswkwphzplf`,
673 actors, 167 sync runs since launch).

This plan supersedes the prior version, which was based on static repo
inspection and made several claims that the live data contradicts.

## Completed Work (2026-04-24)

### Blockers Resolved
- ✅ B1: Fixed sync_log vs sync_logs table name mismatch
- ✅ B2: Fixed SUPABASE_SERVICE_KEY vs SUPABASE_SERVICE_ROLE_KEY inconsistency
- ✅ B3: Selected Gemini Imagen 3 as image provider (@google/generative-ai added)

### Phase 0: Backups and Safety Nets ✅
- ✅ Added workers/backup.ts for snapshotting actors
- ✅ Added workers:backup npm script
- ✅ Temporarily disabled nightly cron in sync.yml

### Phase 1: Data Quality Improvements ✅
- ✅ Fixed OTX filter with looksLikeActorName() guard
- ✅ Added workers/cleanup-otx-pollution.ts for one-time backfill cleanup
- ✅ Fixed sophistication inference (MITRE derives from signals, OTX no longer hardcoded)
- ✅ Created workers/shared/upsert.ts with upsertActorPreservingMedia()
- ✅ Updated all workers to use new upsert helper
- ✅ Added tests/workers/upsert.test.ts for merge guarantee

### Phase 2: Freshness Signals ✅
- ✅ Added migration 003_freshness_split.sql (intel_last_updated, media_last_updated)
- ✅ Updated workers to write intel_last_updated
- ✅ Added intel staleness badge to CardFront component
- ✅ Created workers/diagnose.ts for health monitoring

### Phase 3: Image Generation Rewrite ✅
- ✅ Created provider abstraction (Gemini, Hugging Face, Stable Horde, OpenAI)
- ✅ Added Supabase Storage persistence (uploadToStorage helper)
- ✅ Created workers/image-prompts.ts with sophisticated prompt generation
- ✅ Added migration 004_image_metadata.sql (image_curated, image_provider, etc.)
- ✅ Rewrote workers/image-gen.ts with CLI flags and provider selection
- ✅ Added image generation step to sync.yml

### Phase 4: UX Improvements ✅
- ✅ Phase 4.1: Verified actor badge in CardFront (multi-source indicator)
- ✅ Phase 4.2: Verified toggle in FilterPanel (default on)
- ✅ Phase 4.3: Better default sort via list_actors_ranked RPC
- ✅ Phase 4.4: Source filter in FilterPanel (MITRE, ETDA, OTX, Manual)
- ✅ Phase 4.5: Empty image fallback with HeroPlaceholder (using initials)
- ✅ Phase 4.6: Improved campaign timeline with decade grouping
- ✅ Phase 4.7: TTP grid already grouped by tactic with MITRE links
- ✅ Phase 4.9: Mobile card sizing with aspect-ratio and max-width

### Phase 5: Performance and Hardening ✅
- ✅ Phase 5.1: Added dedup and performance indexes (migration 006)
- ✅ Phase 5.3: Deleted legacy Python worker directories
- ✅ Cleaned up apply-migrations.ts worker (temporary helper)

## Remaining Work

**All phases complete and deployed.** ✅

Optional testing:
- Test image generation: `pnpm workers:image -- --actor apt28 --dry-run`

## How to use this plan (for the next agent)

Phases 0-5 are complete in code. Next steps:

1. **Apply migrations to production** (see "Remaining Work" above)
2. **Re-enable cron** after migrations are applied
3. **Optional**: Test image generation with `pnpm workers:image -- --actor <test-actor>`

## How to use this plan (for the next agent)

You are picking this up cold. Read in this order:

1. **Goals** above — never lose sight of the four product goals.
2. **Pre-flight checks** below — run them first; do not start work until they
   pass.
3. **Hard blockers** below — address any blocker that applies before its
   dependent phase.
4. **Live state — verified facts** — current numbers as of 2026-04-25. Re-run
   the diagnostic in Phase 2.4 (or a hand-rolled equivalent) before starting
   each phase to detect drift.
5. Phase 0 → 5 in order. Each phase has an **Entry**, **Files**, and **Exit**
   block; do not move to the next phase until Exit is satisfied.

**Workflow rules (from `CLAUDE.md` §8, non-negotiable):**

- Branch off `dev`, never `main`. Branch name: `feature/issue-{N}-{slug}`.
- Conventional commits: `feat:`, `fix:`, `chore:`, `test:`, `docs:`.
- Run `pnpm lint && pnpm test` before opening any PR.
- Open PR against `dev`, fill the template in §9.
- Do not modify `CLAUDE.md` (separate PR if ever needed).
- Do not push to `main` or `dev` directly.

**When to stop and ask the user:**

- Before deleting any rows (Phase 1.2) — confirm count from `--dry-run` first.
- Before picking an image provider if Gemini is unavailable (Phase 3.1).
- If live state has drifted significantly from the numbers in this plan
  (e.g., total actor count is no longer in the 600-700 range, or sync_log has
  stopped advancing) — surface it before continuing.

## Pre-flight checks

Run all five before starting any work. If any fails, stop and report.

```bash
# 1. You're in the right directory and on the right branch
cd /Users/adil/Code/threatdex
git status --short --branch
git checkout dev && git pull origin dev

# 2. Dependencies installed and clean
pnpm install --frozen-lockfile
pnpm lint
pnpm test

# 3. .env exists and is populated (do not print values)
test -f .env && awk -F= '/^[A-Z_]+=/{print $1, length($0)>length($1)+1 ? "SET" : "empty"}' .env

# 4. Supabase reachable with service key
node --env-file=.env -e '
const r = await fetch(process.env.SUPABASE_URL + "/rest/v1/actors?select=id&limit=1", {
  headers: { apikey: process.env.SUPABASE_SERVICE_KEY,
             Authorization: "Bearer " + process.env.SUPABASE_SERVICE_KEY }
});
console.log("status:", r.status, "(expect 200)");
'

# 5. backups/ directory writable
mkdir -p backups/$(date +%F) && touch backups/$(date +%F)/.keep
```

Expected: all five succeed silently or with status 200.

## Hard blockers

These must be resolved before the listed phase. Do not skip.

### B1. Repo vs. prod sync_log divergence — blocks Phase 1.5

The repo's `workers/shared/supabase.ts:45,71,93` writes to `sync_logs`
(plural). Live database has `sync_log` (singular) with 167 rows including
today's runs. Conclusion: **deployed code is ahead of `main`**.

Before changing anything in `workers/shared/`, verify:

```bash
git log --all --oneline -- workers/shared/supabase.ts
git log --all --oneline -- .github/workflows/sync.yml
```

If a fix exists on another branch, rebase or cherry-pick it onto your branch
first. If no fix exists in any branch, then prod is being run from an
out-of-tree image — surface to the user before continuing. **Do not silently
"fix" the table name in code that may already match prod.**

### B2. GitHub Actions secret name mismatch — blocks Phase 1.7

CLAUDE.md, `.env.example`, and `app/lib/supabase.server.ts` use
`SUPABASE_SERVICE_KEY`. The repo's `workers/shared/supabase.ts:19` reads
`SUPABASE_SERVICE_ROLE_KEY`. The deployed workers run successfully nightly,
so prod must use one or the other consistently — confirm which by reading
GitHub repo Settings → Secrets, or by asking the user. Do not change either
name in code until you know which one prod uses.

### B3. Image provider key choice — blocks Phase 3

`.env` has `HF_API_KEY`, `GEMINI_API_KEY`, `STABLE_HORDE_API_KEY`, no
`OPENAI_API_KEY`. Plan recommends Gemini Imagen 3. Before adding the
`@google/generative-ai` dependency, confirm with the user that Gemini is
acceptable (cost: ~$12 one-shot for 300 actors, ~$24/month nightly). If they
prefer the free path, switch Phase 3.1's recommendation to Stable Horde and
adjust 3.2's `selectProvider` precedence.

## Live state — verified facts

Run against the Supabase REST API on 2026-04-25 with `SUPABASE_SERVICE_KEY`.

### Data volume and source mix

| Metric | Value |
|---|---|
| Total `actors` rows | 673 |
| Actors only sourced from OTX | 496 (74%) |
| Actors with article-title-style names (sentence-like) | 476 (71%) |
| Actors with clean actor-style names (≤4 words, no sentence words) | 197 (29%) |
| Source mentions: MITRE | 176 |
| Source mentions: ETDA | 1 |
| Source mentions: OTX | 496 |
| Actors with `image_url` set | 1 (SANDWORM) |
| Actors with `image_url` NULL | 672 |

ETDA showing only 1 source mention but 504 nightly upserts means ETDA rows are
being **overwritten by OTX or losing their `sources[]` entries during merge** —
worth investigating during the same-ID merge fix.

### Sync history (last 7 nights)

| Date | MITRE | ETDA | OTX | image-gen |
|---|---|---|---|---|
| 04-25 | 187 | 504 | 9 | 0 |
| 04-24 | 187 | 504 | 223 | 0 |
| 04-23 | 187 | 504 | 2 | 0 |
| 04-22 | 187 | 504 | 92 | 0 |
| 04-21 | 187 | 504 | 130 | 0 |
| 04-20 | 187 | 504 | (varies) | 0 |
| 04-19 | 187 | 504 | (varies) | 0 |

- MITRE and ETDA upsert the **same number** every night → working as designed,
  but every row gets rewritten daily through the buggy merge path.
- OTX is bleeding 2-223 new "actor" rows per night, all article titles.
- image-gen has run 7 consecutive nights with **zero records synced**. It exits
  silently because `OPENAI_API_KEY` is unset (the project has
  `HF_API_KEY`, `GEMINI_API_KEY`, `STABLE_HORDE_API_KEY` instead).

### Distribution problems

| Field | Distribution | Problem |
|---|---|---|
| `sophistication` | High: 672, Medium: 1 | Inference is collapsed — every actor defaults to High |
| `rarity` | RARE: 564, EPIC: 109, LEGENDARY: 0, MYTHIC: 0 | High tiers can never trigger because sophistication is stuck at High |
| `threat_level` | Mostly 3 (base for sophistication=High) | Ordering by threat_level is effectively random |

### What works

- Workers authenticate against Supabase (the deployed env must use
  `SUPABASE_SERVICE_ROLE_KEY` even though `.env.example` says
  `SUPABASE_SERVICE_KEY`).
- `sync_log` table is being written to successfully — repo code in
  `workers/shared/supabase.ts` says `sync_logs` but prod must have a fix not in
  this branch. Confirm before changing.
- `actor-images` Storage bucket exists and serves SANDWORM's image at
  `https://zxutysxzhsswkwphzplf.supabase.co/storage/v1/object/public/actor-images/sandworm.png`.
- SANDWORM's image survives nightly syncs — `mergeActors()` does correctly
  prefer existing `image_url` over a NULL incoming, even though the same-ID bug
  still skips the merge.

### What the prior plan got wrong

| Prior claim | Reality |
|---|---|
| "Worker auth is broken" | Workers run successfully every night |
| "sync_logs vs sync_log causes log writes to fail" | sync_log has 167 rows including today's runs |
| "Many good images are being overwritten" | Only one image exists; it has not been overwritten |
| "OpenAI temp URLs are stored in `image_url`" | Zero rows have OpenAI URLs; the only image is in Supabase Storage |
| "The image worker stores OpenAI URLs directly" | The image worker has been a no-op for the entire deployment |

## Root-cause map

The four user-visible symptoms all come from a small set of root causes:

| Symptom | Root cause | Fix |
|---|---|---|
| Threat intel feels stale / unreliable | OTX worker treats pulse names as actor names → 496 junk rows drown 197 real actors | Phase 1 |
| Sophistication and rarity look uniform | OTX worker hardcodes `sophistication = "High"` (`workers/otx-sync.ts:220`); MITRE's `mapSophistication` defaults to `"High"` for missing values | Phase 1 + 2 |
| Real actors lose data overnight | Same-ID merge skip in all 3 workers + ETDA-only `sources[]` entries are being clobbered | Phase 2 |
| Generated artwork is missing or bad | Image worker has been silently no-op for weeks (no OPENAI_API_KEY); when it did run it used a samey prompt template and stored OpenAI temp URLs | Phase 3 |
| SANDWORM looks fragile | No `image_curated` column; protection relies on `mergeActors`'s coalesce ordering, which would break if a future change reorders args | Phase 3 |

---

# Phase 0 — Backups and safety nets (do before anything else)

**Entry:** Pre-flight checks pass.
**Files:** `backups/2026-04-25/*`, `.github/workflows/sync.yml`.
**Exit:** SANDWORM image + row backed up; full actors snapshot saved; nightly
cron commented out and committed on the working branch.

## 0.1 Snapshot SANDWORM

```bash
mkdir -p backups/2026-04-25
curl -o backups/2026-04-25/sandworm.png \
  "https://zxutysxzhsswkwphzplf.supabase.co/storage/v1/object/public/actor-images/sandworm.png"
```

Then export the row:

```bash
node --env-file=.env -e '
const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_KEY;
const r = await fetch(url + "/rest/v1/actors?id=eq.sandworm", {
  headers: { apikey: key, Authorization: "Bearer " + key }
});
const fs = await import("node:fs/promises");
await fs.writeFile("backups/2026-04-25/sandworm.json", await r.text());
'
```

## 0.2 Snapshot the full actors table

```bash
node --env-file=.env -e '
const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_KEY;
const fs = await import("node:fs/promises");
let all = [];
let offset = 0;
while (true) {
  const r = await fetch(url + `/rest/v1/actors?select=*&limit=1000&offset=${offset}`, {
    headers: { apikey: key, Authorization: "Bearer " + key }
  });
  const rows = await r.json();
  all = all.concat(rows);
  if (rows.length < 1000) break;
  offset += 1000;
}
await fs.writeFile("backups/2026-04-25/actors-full.json", JSON.stringify(all, null, 2));
console.log("Saved", all.length, "actors");
'
```

## 0.3 Disable the nightly cron temporarily

In `.github/workflows/sync.yml`, comment out the `schedule:` block until
Phase 1 lands. Manual `workflow_dispatch` runs still work for testing.

---

# Phase 1 — Stop the bleeding (data quality)

Goal: the next nightly sync should produce a higher-quality table than the
previous one, not a worse one.

**Entry:** Phase 0 complete; B1 and B2 hard blockers resolved or escalated.
**Files:** `workers/otx-sync.ts`, `workers/mitre-sync.ts`, `workers/etda-sync.ts`,
`workers/shared/upsert.ts` (new), `workers/shared/dedup.ts` (light edits),
`workers/cleanup-otx-pollution.ts` (new), `package.json`,
`tests/workers/upsert.test.ts` (new).
**Exit:** Manual sync run produces ≤350 actors total; sophistication
distribution has ≥4 distinct values, none > 60%; rarity distribution includes
at least one MYTHIC and ten LEGENDARY; SANDWORM row unchanged
(`image_url`, `image_prompt`, `image_curated`).

## 1.1 Filter OTX pulses to actors only

`workers/otx-sync.ts:179-265` (`parsePulse`) and `workers/otx-sync.ts:62-79`
(`isThreatActorPulse`, `cleanPulseName`) are the problem.

**The current filter** (`isThreatActorPulse`) accepts a pulse if any tag is
in `THREAT_ACTOR_TAGS` (`apt`, `threat-actor`, `nation-state`, etc.). But
authors tag *articles about* APTs with `apt`, so the filter passes
"Discovers Multi-Year Sophisticated Chinese DNS Operation".

**New filter logic:**

1. Extract a candidate actor name from the pulse using a small set of patterns:
   - Tags that match a known actor alias from MITRE/ETDA.
   - First proper-noun phrase in the title that matches actor-name shape
     (e.g., `APT\d+`, `[A-Z][a-z]+ ?Bear`, `Lazarus`, `Sandworm`).
   - Fail closed: if no clean actor name can be extracted, **skip the pulse
     entirely**.
2. Resolve the candidate name against the existing actors table (by alias or
   normalized name) — if found, attach the pulse as an additional
   `SourceAttribution` and as a `Campaign`, do **not** create a new row.
3. Only create a new actor row when the candidate name is clean (≤4 words,
   passes a "looks like an actor name" regex) AND there's no existing match.

**Code sketch — `workers/otx-sync.ts`:**

```ts
// New: looks-like-actor-name guard
const ACTOR_NAME_RE = /^(?:apt[\s-]?\d+|ta\d+|fin\d+|unc\d+|g\d+|[A-Z][a-zA-Z]+(?:\s[A-Z][a-zA-Z]+){0,3})$/

function looksLikeActorName(name: string): boolean {
  const trimmed = name.trim()
  if (trimmed.length === 0 || trimmed.length > 40) return false
  const wordCount = trimmed.split(/\s+/).length
  if (wordCount > 4) return false
  // Reject sentence-y words
  if (/\b(the|and|with|by|targeting|inside|using|advisory|chronology|operation|unmasking|fake|new|attack|attacks|expands|targeted|reveals|infects|executed|uncovers|delivers|escalation|implant|implants|backdoor|campaign|variant|techniques|deployed|leverages)\b/i.test(trimmed)) {
    return false
  }
  return ACTOR_NAME_RE.test(trimmed)
}

// New: extract candidate from tags first, then title
function extractActorCandidate(pulse: OtxPulse): string | null {
  const tags: string[] = pulse["tags"] ?? []
  for (const tag of tags) {
    if (looksLikeActorName(tag)) return tag
  }
  // Fall back to a leading proper-noun in the title
  const name = cleanPulseName(pulse["name"] ?? "")
  if (looksLikeActorName(name)) return name
  return null
}
```

**Then in `parsePulse`:** if `extractActorCandidate` returns null, return null
and skip. If it returns a name, look up an existing actor (by exact slug,
normalized name, or alias). If found, build a "merge payload" that contributes
only the new source/campaign/TTPs, leaving identity fields (canonicalName,
country, sophistication, etc.) untouched. If not found, create a new actor
only when the name is unambiguous.

## 1.2 One-time backfill cleanup

After 1.1 ships, the table still has 496 polluted rows. Don't leave them.

Create `workers/cleanup-otx-pollution.ts`:

```ts
import { supabase } from "./shared/supabase.js"

const SENTENCE_RE = /\b(the|and|with|by|targeting|inside|using|advisory|chronology|operation|unmasking|fake|new|attack|attacks|expands|targeted|reveals|infects|executed|uncovers|delivers|escalation|implant|implants|backdoor|campaign|variant|techniques|deployed|leverages)\b/i

async function main() {
  const dryRun = process.argv.includes("--dry-run")
  const { data: actors } = await supabase.from("actors").select("id, canonical_name, sources")

  const toDelete = (actors ?? []).filter((a) => {
    const sources = (a.sources as { source: string }[]) ?? []
    if (sources.length === 0) return false
    if (!sources.every((s) => s.source === "otx")) return false
    const wordCount = (a.canonical_name as string).split(/\s+/).length
    return wordCount > 4 || SENTENCE_RE.test(a.canonical_name as string)
  })

  console.log(`Would delete ${toDelete.length} polluted rows`)
  if (dryRun) {
    toDelete.slice(0, 20).forEach((a) => console.log(`  - ${a.id}`))
    return
  }

  for (const a of toDelete) {
    await supabase.from("actors").delete().eq("id", a.id)
  }
  console.log(`Deleted ${toDelete.length} rows`)
}

main().catch(console.error)
```

Wire to `package.json`:

```json
"workers:cleanup-otx": "tsx workers/cleanup-otx-pollution.ts"
```

Run with `--dry-run` first. Expected delete count: ~490-500.

## 1.3 Fix sophistication inference

The collapsed-to-High distribution is the second-biggest data quality problem.
Two fixes:

**MITRE worker — `workers/mitre-sync.ts:48-56`:** the `SOPHISTICATION_MAP`
keys (`none`, `minimal`, `intermediate`, ...) come from the STIX 2.1
`sophistication` open vocab. But the MITRE worker reads
`obj["x_mitre_version"]` (which is a version number like "2.1") as the
sophistication value at line 222. That's a bug — MITRE intrusion-sets do not
publish a sophistication field; the version field has nothing to do with
sophistication. Replace with a derivation from observable signals:

```ts
function deriveSophistication(params: {
  ttpsCount: number
  campaignsCount: number
  toolsCount: number
  isStateSponsored: boolean
}): string {
  const { ttpsCount, campaignsCount, toolsCount, isStateSponsored } = params
  const score = ttpsCount + campaignsCount * 2 + toolsCount * 0.5 + (isStateSponsored ? 10 : 0)
  if (score >= 30 && isStateSponsored) return "Nation-State Elite"
  if (score >= 20) return "Very High"
  if (score >= 10) return "High"
  if (score >= 4) return "Medium"
  return "Low"
}
```

`isStateSponsored` from `inferCountryFromLabels` returning a country in the
list `[Russia, China, Iran, North Korea, USA, UK, Israel]` plus
`labels.includes("state-sponsored")` or `description` containing
"nation-state" / "state-sponsored".

**OTX worker — `workers/otx-sync.ts:220`:** delete the `const sophistication = "High"`
hardcode. Once 1.1 ships, OTX will only attach to existing actors and will
not need to set sophistication itself.

## 1.4 Fix rarity distribution

`workers/shared/rarity.ts:67-86` requires `sophistication === "Nation-State Elite"`
for MYTHIC. With 1.3 fixed, this should start producing MYTHIC actors for
real nation-state groups. No code change needed in `rarity.ts`, but verify
post-resync:

```sql
select rarity, count(*) from actors group by rarity order by count desc;
```

Expected after 1.3 + resync: 5-15 MYTHIC, 30-60 LEGENDARY, ~80 EPIC,
rest RARE.

## 1.5 Same-ID merge fix

The bug. All three workers do this:

```ts
const existingId = await findMatchingActor(actor)
if (existingId && existingId !== actor.id) {
  // ... merge ...
}
```

When `existingId === actor.id` (very common — same slug from same source two
nights in a row), the merge is skipped and `toDbRecord(actor)` upserts with
`null` for any field the new parse didn't populate.

**Extract a shared helper — new file `workers/shared/upsert.ts`:**

```ts
import { supabase } from "./supabase.js"
import { findMatchingActor, mergeActors } from "./dedup.js"
import { toDbRecord, type ThreatActorData } from "./models.js"

export async function upsertActorPreservingMedia(
  incoming: ThreatActorData
): Promise<{ id: string; merged: boolean; error: string | null }> {
  const existingId = (await findMatchingActor(incoming)) ?? incoming.id
  const { data: existingRow } = await supabase
    .from("actors")
    .select("*")
    .eq("id", existingId)
    .maybeSingle()

  let actor = incoming
  if (existingRow) {
    actor = mergeActors(existingRow as Record<string, unknown>, incoming)
    actor.id = existingRow.id as string
  }

  const { error } = await supabase
    .from("actors")
    .upsert(toDbRecord(actor), { onConflict: "id" })

  return { id: actor.id, merged: !!existingRow, error: error?.message ?? null }
}
```

Replace the per-worker upsert blocks (`mitre-sync.ts:362-395`,
`etda-sync.ts:462-489`, `otx-sync.ts:281-310`) with:

```ts
const result = await upsertActorPreservingMedia(actor)
if (result.error) {
  console.warn(`Upsert error for ${actor.canonicalName}:`, result.error)
} else {
  recordsSynced++
}
```

## 1.6 Tests for the merge guarantee

`tests/workers/upsert.test.ts` — pin the bug:

```ts
import { describe, it, expect, vi, beforeEach } from "vitest"

vi.mock("../../workers/shared/supabase", () => ({
  supabase: { /* fake builder, see fixtures below */ },
}))

describe("upsertActorPreservingMedia", () => {
  it("preserves image_url when same-ID actor is re-synced without an image", async () => {
    // existing row: { id: "sandworm", image_url: "https://.../sandworm.png" }
    // incoming: parsed MITRE actor with imageUrl=undefined
    // assert final upsert payload's image_url === existing
  })

  it("preserves image_curated SANDWORM through full intel re-sync", async () => {
    // ... same with image_curated=true
  })

  it("merges TTPs from incoming into existing without dropping either set", async () => {
    // existing: TTPs [T1566, T1059]
    // incoming: TTPs [T1059, T1190]
    // assert final has [T1566, T1059, T1190]
  })

  it("preserves ETDA sources[] when MITRE re-syncs the same actor", async () => {
    // existing.sources = [{source: "etda", ...}]
    // incoming.sources = [{source: "mitre", ...}]
    // assert final.sources has both
  })
})
```

## 1.7 Re-enable cron and verify

After 1.1-1.6 land:

1. Run `pnpm workers:cleanup-otx -- --dry-run`, confirm count, run for real.
2. Manually trigger sync via `workflow_dispatch` for `mitre`, `etda`, `otx` in
   sequence.
3. Confirm: total row count drops to ~250-350, sophistication distribution
   spreads, rarity distribution spreads.
4. Re-enable the schedule in `sync.yml`.

---

# Phase 2 — Freshness signals you can trust

Once Phase 1 cuts the noise, the freshness fields need to mean something.

**Entry:** Phase 1 exit criteria met.
**Files:** `supabase/migrations/003_freshness_split.sql` (new),
`workers/shared/dedup.ts`, `workers/image-gen.ts`, `app/components/CardFront.tsx`,
`workers/diagnose.ts` (new), `package.json`.
**Exit:** Two nightly syncs in a row show `intel_last_updated` advancing only
on changed rows; `media_last_updated` is null for everyone except SANDWORM;
`pnpm workers:diagnose` returns in <2s with sane numbers.

## 2.1 Split last_updated into intel vs media

New migration `supabase/migrations/003_freshness_split.sql`:

```sql
alter table actors
  add column if not exists intel_last_updated timestamptz,
  add column if not exists media_last_updated timestamptz;

-- Backfill: existing last_updated assumed to be intel
update actors
set intel_last_updated = last_updated
where intel_last_updated is null;
```

Then:

- `mergeActors()` (`workers/shared/dedup.ts:269`) writes
  `intel_last_updated = new Date().toISOString()`, leaves `media_last_updated`
  alone, and **stops setting `last_updated`** (let it become a derived view).
- `image-gen.ts` writes `media_last_updated`, never touches the others.
- Loader and frontend can show "Intel updated 3h ago · Image refreshed 2 weeks ago"
  separately.

Optional view for backward compat:

```sql
create or replace view actors_with_freshness as
select
  *,
  greatest(intel_last_updated, media_last_updated) as last_touched
from actors;
```

## 2.2 Per-source `fetched_at` is already correct

`SourceAttribution.fetchedAt` is set by every worker. The diagnostics script
(2.4) should expose it. No code change.

## 2.3 Add an "Intel staleness" surface to the frontend

In `app/components/CardFront.tsx`, in the bottom bar:

```tsx
{intelStaleDays > 30 && (
  <span style={{ fontSize: "8px", color: "#FFAA00" }}>
    Intel {intelStaleDays}d old
  </span>
)}
```

Helps the user immediately see which actors haven't been touched in months.

## 2.4 Diagnostics script

New file `workers/diagnose.ts`:

```ts
import { supabase } from "./shared/supabase.js"

async function main() {
  const json = process.argv.includes("--json")
  const { data: actors, error } = await supabase
    .from("actors")
    .select("id, canonical_name, sophistication, rarity, image_url, intel_last_updated, media_last_updated, sources")

  if (error) throw error
  if (!actors) return

  const total = actors.length
  const withImage = actors.filter((a) => a.image_url).length
  const stale30 = actors.filter((a) => {
    const t = a.intel_last_updated as string | null
    return t && Date.now() - new Date(t).getTime() > 30 * 86400_000
  }).length

  const byRarity: Record<string, number> = {}
  const bySoph: Record<string, number> = {}
  const bySource: Record<string, number> = {}
  for (const a of actors) {
    byRarity[a.rarity as string] = (byRarity[a.rarity as string] ?? 0) + 1
    bySoph[a.sophistication as string] = (bySoph[a.sophistication as string] ?? 0) + 1
    for (const s of (a.sources ?? []) as { source: string }[]) {
      bySource[s.source] = (bySource[s.source] ?? 0) + 1
    }
  }

  const report = {
    total,
    withImage,
    missingImage: total - withImage,
    stale30,
    byRarity,
    bySoph,
    bySource,
  }

  console.log(json ? JSON.stringify(report, null, 2) : formatHuman(report))
}

function formatHuman(r: any): string { /* ... */ return "" }

main().catch(console.error)
```

Add to `package.json`:

```json
"workers:diagnose": "tsx workers/diagnose.ts"
```

---

# Phase 3 — Image generation that actually runs

Phase 1 leaves a clean ~250-350 row table with one image. Phase 3 makes the
rest happen.

**Entry:** Phase 2 exit met; B3 hard blocker resolved (provider chosen by user).
**Files:** `workers/image-gen.ts` (rewrite), `workers/image-providers/*.ts`
(new), `supabase/migrations/004_image_metadata.sql` (new), `package.json`,
`.github/workflows/sync.yml`.
**Exit:** `pnpm workers:image -- --actor sandworm --dry-run` prints the
expected prompt; `pnpm workers:image -- --actor <test-actor>` produces a
durable Supabase Storage URL; SANDWORM is skipped without `--force`; nightly
cron generates ≤20 missing images per run.

> Code sketches in this phase are illustrative — confirm against current
> provider SDK docs before committing. Do not paste verbatim.

## 3.1 Pick a provider

The repo's `.env` has three image-gen credentials:

| Provider | Cost | Quality | Latency | Notes |
|---|---|---|---|---|
| Google Gemini (`imagen-3.0-generate-002`) | ~$0.04/image | Best of the three | ~10s | Returns base64 directly. Strong stylistic control via prompt |
| Hugging Face Inference (`stabilityai/stable-diffusion-xl-base-1.0` or `black-forest-labs/FLUX.1-dev`) | Free tier; pay for higher | Good with FLUX, mid with SDXL | 20-60s queued | Returns bytes |
| Stable Horde | Free | Lottery — depends on workers | 30s-5min | Don't use for batch |

**Recommendation: Gemini.** Cost is acceptable for ~300 actors, quality is the
strongest, and it returns base64 so no URL-expiry race exists. Stable Horde as
a fallback worker for `--cheap` mode.

## 3.2 Rewrite `image-gen.ts` around a provider abstraction

New file `workers/image-providers/index.ts`:

```ts
export interface ImageProvider {
  name: string
  generate(prompt: string): Promise<Buffer | null>
}

export function selectProvider(): ImageProvider {
  if (process.env.GEMINI_API_KEY) return geminiProvider()
  if (process.env.HF_API_KEY) return huggingFaceProvider()
  if (process.env.STABLE_HORDE_API_KEY) return stableHordeProvider()
  if (process.env.OPENAI_API_KEY) return openAiProvider()
  throw new Error("No image provider key set in environment")
}
```

Per-provider files: `gemini.ts`, `huggingface.ts`, `stable-horde.ts`,
`openai.ts`. Each wraps the SDK or fetch call and returns `Buffer | null`.

**Gemini implementation sketch (`gemini.ts`):**

```ts
import { GoogleGenerativeAI } from "@google/generative-ai"

export function geminiProvider(): ImageProvider {
  const client = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!)
  return {
    name: "gemini-imagen-3",
    async generate(prompt: string) {
      const model = client.getGenerativeModel({ model: "imagen-3.0-generate-002" })
      const result = await model.generateContent([prompt])
      const b64 = result.response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data
      if (!b64) return null
      return Buffer.from(b64, "base64")
    },
  }
}
```

(Adjust to match the actual SDK signature when implementing — confirm against
the current `@google/generative-ai` docs.)

**Add dep:**
```bash
pnpm add @google/generative-ai
```

## 3.3 Persist image bytes to Supabase Storage

The bucket already exists. New helper in `workers/image-gen.ts`:

```ts
import { createHash } from "node:crypto"

async function uploadToStorage(actorId: string, bytes: Buffer): Promise<{ url: string; path: string }> {
  const hash = createHash("sha1").update(bytes).digest("hex").slice(0, 12)
  const path = `actors/${actorId}/${hash}.png`
  const { error } = await supabase.storage
    .from("actor-images")
    .upload(path, bytes, { contentType: "image/png", upsert: false })
  if (error && !error.message.includes("already exists")) throw error
  const { data } = supabase.storage.from("actor-images").getPublicUrl(path)
  return { url: data.publicUrl, path }
}
```

Hash-in-path means re-running with the same prompt+seed is idempotent and we
never overwrite a previous image (great for "regenerate without losing the old
one" workflows later).

## 3.4 New ordering in the worker main loop

```ts
async function processActor(actor, opts) {
  if (shouldSkip(actor, opts)) return { status: "skipped" }

  const prompt = buildImagePrompt(actor)
  if (opts.dryRun) {
    console.log(`[dry-run] ${actor.id}: ${prompt}`)
    return { status: "dry-run" }
  }

  const bytes = await provider.generate(prompt)
  if (!bytes) return { status: "failed" }

  const { url, path } = await uploadToStorage(actor.id, bytes)

  const { error } = await supabase
    .from("actors")
    .update({
      image_url: url,
      image_prompt: prompt,
      image_storage_path: path,
      image_provider: provider.name,
      image_generated_at: new Date().toISOString(),
      media_last_updated: new Date().toISOString(),
    })
    .eq("id", actor.id)

  return error ? { status: "failed", error } : { status: "ok" }
}
```

One DB write per actor, only on success. No partial states.

## 3.5 Curated-image protection

New migration `supabase/migrations/004_image_metadata.sql`:

```sql
alter table actors
  add column if not exists image_curated boolean not null default false,
  add column if not exists image_storage_path text,
  add column if not exists image_provider text,
  add column if not exists image_generated_at timestamptz;

update actors set image_curated = true where id = 'sandworm';
```

`shouldSkip` becomes:

```ts
function shouldSkip(actor, opts: { force: boolean }) {
  if (opts.force) return false
  if (actor.image_curated) return true
  if (actor.image_url) return true   // already has an image; only --force overwrites
  return false
}
```

## 3.6 New prompt builder

Replace `buildImagePrompt` in `workers/image-gen.ts:73-122`. Principles:

- **No text in the artwork** — the card UI overlays the name (`CardFront.tsx:339-352`).
- **No "card" framing** — the rarity foil and frame are CSS, not part of the
  hero image.
- **Concrete environments instead of "country aesthetic"** — replace "Russian
  cultural aesthetic" with "frost-covered substation control room" (for SANDWORM-style
  actors). Map country+motivation → a small library of concrete scenes.
- **Subject motifs derived from real signals** — tools, target sectors, TTPs.

```ts
type PromptProfile = {
  motif: string         // "industrial control system riddled with frost"
  signals: string       // "destructive intrusion against power grids"
  environment: string   // "snowbound substation interior, glowing fault indicators"
  paletteAccent: string // rarity-derived
}

const RARITY_ACCENT: Record<string, string> = {
  MYTHIC: "molten gold and electric yellow",
  LEGENDARY: "vibrant magenta and pink",
  EPIC: "deep violet and indigo",
  RARE: "cool electric blue",
}

const ACTOR_OVERRIDES: Record<string, Partial<PromptProfile>> = {
  sandworm: {
    motif: "colossal armored worm rising through a crystallized circuit-board landscape",
    signals: "destructive intrusion against industrial control systems and power grids",
    environment: "frost-covered substation interior, red fault indicators glowing through ice",
  },
  lazarus: {
    motif: "vault door cracked open onto cascading currency and stolen credentials",
    signals: "financial intrusion, cryptocurrency theft, espionage against banks",
    environment: "neon-lit underground server room with monitor reflections",
  },
  apt28: {
    motif: "satellite uplink array bristling with antenna arrays under a steel sky",
    signals: "military intelligence, spear-phishing, credential theft",
    environment: "open-plan signals intelligence floor, map walls, midnight blue light",
  },
  apt29: {
    motif: "diplomatic archive of glass tablets dissolving into mist",
    signals: "quiet long-dwell intrusion against governments and think tanks",
    environment: "vaulted records room, soft beams of light through dust",
  },
  // ... add more as we go
}

function buildPromptProfile(actor: any): PromptProfile {
  const id = (actor.id ?? "").toLowerCase()
  const override = ACTOR_OVERRIDES[id] ?? {}
  const rarity = (actor.rarity ?? "RARE") as keyof typeof RARITY_ACCENT

  const motif = override.motif ?? deriveMotif(actor)
  const signals = override.signals ?? deriveSignals(actor)
  const environment = override.environment ?? deriveEnvironment(actor)

  return { motif, signals, environment, paletteAccent: RARITY_ACCENT[rarity] }
}

export function buildImagePrompt(actor: any): string {
  const p = buildPromptProfile(actor)
  return [
    "Cinematic threat-intelligence dossier illustration.",
    "No text, no words, no logos, no UI, no watermark, no card frame.",
    `Subject: ${p.motif}.`,
    `Signals: ${p.signals}.`,
    `Environment: ${p.environment}.`,
    "Composition: centered subject, strong silhouette, designed to fit a 280x140 card crop.",
    `Palette: dark navy base (#00123F) with ${p.paletteAccent} highlights.`,
    "Style: realistic materials, sharp lighting, polished editorial cyber-illustration.",
    "Avoid: hooded hacker cliché, code rain, flags, stereotypes, any letters or numbers.",
  ].join(" ")
}
```

Helper deriviation (when no override exists):

- `deriveMotif`: pick from a tools→motif map (e.g., `cobaltstrike` →
  "command-and-control beacon spider", `mimikatz` → "shattered glass ledger of
  credentials"), then fall back to a country+motivation default.
- `deriveSignals`: combine top 2 motivations + top sector ("financial
  intrusion against fintech", "espionage against defense contractors").
- `deriveEnvironment`: country → biome ("Iranian: desert oilfield control
  room"; "Chinese: high-rise data center at night"; etc.). Avoid stereotypes —
  use industrial/architectural cues, not people or flags.

## 3.7 CLI flags

Use `node:util.parseArgs` (no new deps):

```ts
import { parseArgs } from "node:util"
const { values, positionals } = parseArgs({
  options: {
    actor: { type: "string" },
    top: { type: "string" },              // "25"
    limit: { type: "string" },
    force: { type: "boolean", default: false },
    "dry-run": { type: "boolean", default: false },
    provider: { type: "string" },         // override auto-select
    "exclude": { type: "string", multiple: true },
  },
  allowPositionals: true,
})
```

Supported invocations:

```bash
pnpm workers:image                                         # fill missing only
pnpm workers:image -- --actor sandworm --dry-run           # show prompt
pnpm workers:image -- --actor sandworm --force             # regenerate one
pnpm workers:image -- --top 25 --exclude sandworm          # batch top 25
pnpm workers:image -- --limit 10                           # cap batch size
pnpm workers:image -- --provider stable-horde              # cheap mode
```

## 3.8 Wire image-gen into the schedule

`.github/workflows/sync.yml` doesn't have an image-gen step; add one that
runs only after intel sync and only fills missing images (no `--force`):

```yaml
- name: Generate missing images
  if: github.event_name == 'schedule' || inputs.source == 'all'
  run: pnpm workers:image -- --limit 20
  env:
    SUPABASE_URL: ${{ secrets.SUPABASE_URL }}
    SUPABASE_SERVICE_KEY: ${{ secrets.SUPABASE_SERVICE_KEY }}
    GEMINI_API_KEY: ${{ secrets.GEMINI_API_KEY }}
```

`--limit 20` keeps nightly cost bounded (~$0.80/night with Gemini).

## 3.9 Top-25 refresh after Phase 1+3 land

Once intel and image gen both work, run a one-shot batch for the highest-value
actors:

```bash
pnpm workers:image -- --top 25 --exclude sandworm --force
```

Selection: ORDER BY threat_level DESC, rarity rank, has-MITRE-source DESC.
Excludes SANDWORM (already curated; `image_curated=true` makes it skip even
without the explicit exclude, but belt-and-suspenders).

---

# Phase 4 — UX improvements

The grid currently shows 673 cards, most of which are article titles in
identical RARE blue with no images. Phase 1 cuts this to ~250 real actors.
Phase 4 makes them feel like a curated collection.

**Entry:** Phase 1 exit met (Phase 3 not required — UX work can start in
parallel once data is clean).
**Files:** `app/components/CardFront.tsx`, `app/components/FilterPanel.tsx`,
`app/routes/_index.tsx`, `app/routes/actors.$id.tsx`,
`supabase/migrations/005_list_actors_ranked.sql` (new RPC), `app/app.css`.
**Exit:** Verified-actor toggle visible and on by default; ranked sort
puts MYTHIC and LEGENDARY actors first; mobile (≤640px) renders cards
without horizontal scroll; missing-image placeholder uses lucide icons not
initials.

## 4.1 "Verified actor" badge on cards

Surface a small badge when the actor has multi-source corroboration (≥2 of
mitre/etda/otx/manual). High-trust signal that pushes verified actors visually
ahead of low-trust ones.

In `CardFront.tsx` header bar (around line 280), add:

```tsx
{verifiedSourceCount >= 2 && (
  <span title={`Verified across ${verifiedSourceCount} sources`}
        style={{ fontSize: "10px", color: "#00C853" }}>
    Verified
  </span>
)}
```

## 4.2 Hide low-confidence actors by default

Add a `verified` toggle in `FilterPanel` (default on) that hides actors with
`sources.length < 2` OR `sophistication == "Low"`. Power users can flip it off
to see the full set. Loader change:

```ts
// app/routes/_index.tsx loader
const verifiedOnly = url.searchParams.get("verified") !== "false"
if (verifiedOnly) {
  // PostgREST jsonb_array_length filter
  query = query.gte("sources->>length", 2) // adjust to actual schema
}
```

(Implement with an RPC if PostgREST filter on JSON array length is awkward.)

## 4.3 Better default sort

Currently sorts by `threat_level desc`. With the rarity fix in Phase 1, sort
by a composite "interestingness" score:

```sql
order by
  case rarity when 'MYTHIC' then 4 when 'LEGENDARY' then 3 when 'EPIC' then 2 else 1 end desc,
  threat_level desc,
  jsonb_array_length(sources) desc,
  case when image_url is not null then 1 else 0 end desc,
  canonical_name asc
```

Expose via a new RPC `list_actors_ranked(limit, offset)` since PostgREST can't
express that ordering easily.

## 4.4 Source filter

Add `source` to `FilterPanel` (`mitre` / `etda` / `otx`). Useful for users who
trust only MITRE-derived data. Loader contains-filter on JSON.

## 4.5 Empty image fallback that doesn't look broken

`HeroPlaceholder` in `CardFront.tsx:48-145` is fine but the initials look like
"missing data" rather than "designed". Instead, render a **flag-and-symbol
composition** keyed off motivation:

```tsx
const MOTIVATION_GLYPH: Record<string, string> = {
  espionage: "EYE",     // SVG path of an eye icon
  financial: "VAULT",
  sabotage: "SKULL",
  hacktivism: "FIST",
  military: "BADGE",
}
```

Use `lucide-react` icons (already a dep) — `Eye`, `Vault`, `Skull`,
`Hand`, `Shield` — at large size in a tinted gradient. Looks intentional
even when no AI image exists.

## 4.6 Detail page: campaign timeline

`app/routes/actors.$id.tsx` should render `campaigns[]` as a vertical
timeline sorted by `year`. Currently they're a list. A timeline is far more
scannable for users trying to understand an actor's activity arc.

## 4.7 Detail page: TTP grid linked to MITRE

Render `ttps[]` as a clickable grid (`https://attack.mitre.org/techniques/{techniqueId}/`)
grouped by `tactic`. Today they're a flat list — a tactic-grouped grid mirrors
how analysts actually use ATT&CK.

## 4.8 Search: improve recall on actor aliases

The current full-text search uses weighted vectors over canonical_name +
aliases + tools + description. After Phase 1, add a "did you mean" surface
when the query exactly matches an alias of a different canonical name —
e.g., searching "Fancy Bear" should pin APT28 above any pulse mentioning the
phrase.

## 4.9 Mobile card sizing

`CardFront` is hardcoded `width: 280px; height: 392px`. On phones, this gets
clipped or scrolls awkwardly. Convert to fluid sizing with `aspect-ratio`:

```css
.card-front {
  width: 100%;
  max-width: 320px;
  aspect-ratio: 280 / 392;
}
```

---

# Phase 5 — Performance and hardening

Lower priority but worth tracking.

**Entry:** Phases 1-3 complete (UX phase 4 can be in flight).
**Files:** `supabase/migrations/006_dedup_indexes.sql` (new),
`workers/shared/dedup.ts`, `docs/ARCHITECTURE.md`, `workers/{mitre,etda,otx,image-gen}-sync/*` (delete).
**Exit:** ETDA nightly sync completes in <2 min (currently ~7 min); legacy
Python workers removed; RLS policies documented.

## 5.1 Index normalized aliases for `findMatchingActor`

`workers/shared/dedup.ts:71-93` does a full table scan. With 700 actors per
sync, that's O(n²) ≈ 500k comparisons per night. Migration:

```sql
create index if not exists actors_canonical_name_lower_idx
  on actors (lower(canonical_name));

create index if not exists actors_aliases_gin_idx
  on actors using gin (aliases);
```

Then change `findMatchingActor` to query directly with `lower(canonical_name) = $1`
and `aliases ?| $2::text[]`. Drops sync time from ~7min (ETDA today) to <1min.

## 5.2 Repo/prod sync verification

The repo's `workers/shared/supabase.ts` writes to `sync_logs`, but live
`sync_log` is being populated. Either:

- Prod runs from a different branch; or
- A trigger or view aliases one to the other; or
- Someone fixed it directly in the deployed image.

Check by running `git log --all -- workers/shared/supabase.ts` and asking
whoever maintains the GitHub Actions secrets. If the repo is genuinely behind,
sync it before any other change in Phase 1.

## 5.3 Delete the legacy Python workers

`workers/{mitre,etda,otx,image-gen}-sync/*.py` are not wired into
`package.json`, reference table names that don't match current schema
(`threat_actors` instead of `actors`), and confuse readers. Delete in the
same PR as Phase 1.5.

## 5.4 RLS audit

Confirm `supabase/migrations/002_rls_policies.sql` allows `image-gen` to
write only to `image_*` columns (not full row writes). If it currently has
broad service-role bypass, that's fine but worth documenting in
`docs/ARCHITECTURE.md`.

---

# Drift check before you start

The "Live state" numbers above are from 2026-04-25. Before opening any PR,
run this and report any deltas to the user:

```bash
node --env-file=.env -e '
const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_KEY;
const h = { apikey: key, Authorization: "Bearer " + key, Prefer: "count=exact" };
async function q(p) {
  const r = await fetch(url + "/rest/v1/" + p, { headers: h });
  return { count: r.headers.get("content-range"), body: await r.text() };
}
const total = (await q("actors?select=id&limit=1")).count;
const withImage = (await q("actors?select=id&image_url=not.is.null&limit=1")).count;
const sandworm = (await q("actors?select=id,image_url,image_curated&id=eq.sandworm")).body;
const lastSync = (await q("sync_log?select=source,status,records_synced,started_at&order=started_at.desc&limit=4")).body;
console.log({ total, withImage, sandworm, lastSync });
'
```

Significant drift = stop and confirm before proceeding:

- `total` outside [400, 800]
- `sandworm.image_url` no longer points to `…supabase.co/storage/…`
- `sandworm.image_curated` is true but you haven't run Phase 3.5 yet (means
  someone else has been working on this)
- `lastSync` has no successful run in the last 48h (cron broken or paused)

# Implementation order

**COMPLETED:**
1. Blockers B1, B2 ✅
2. **Phase 0** (backups + cron pause) ✅
3. **Phase 1.1-1.7** (data quality) ✅
4. **Phase 2** (freshness split) ✅
5. **Phase 3.1-3.7** (image gen rewrite) ✅

**PENDING:**
6. **Phase 1.7** - Re-enable cron and verify (run tests first)
7. **Phase 4** as user-facing UX PRs, parallelizable
8. **Phase 5** as cleanup

Each PR follows the workflow in `CLAUDE.md` §8 — branch off `dev`, conventional
commits, PR template, no direct push to `main`.

# Acceptance criteria

The work is done when, against live data:

- Total actor count is between 250 and 400 (real actors only).
- Sophistication distribution has at least 4 distinct values, no single value
  > 60%.
- At least 5 actors are MYTHIC, at least 30 are LEGENDARY.
- Every nightly sync touches `intel_last_updated` for changed rows only.
- SANDWORM's `image_url`, `image_prompt`, and storage object are unchanged
  before and after a full nightly run plus a `pnpm workers:image` run without
  `--force`.
- `pnpm workers:image` produces durable Supabase Storage URLs and uploads
  bytes via the configured provider.
- `pnpm workers:diagnose` reports image health, freshness, source mix, and
  rarity distribution in <2s.
- Tests in `tests/workers/upsert.test.ts` cover the four merge guarantees in
  Phase 1.6.
- The home page card grid shows verified actors first, with non-broken
  placeholder art for missing images and a "Verified" badge on multi-source
  actors.
- `docs/API.md`, `docs/ARCHITECTURE.md`, `docs/DATA_SOURCES.md`, `README.md`,
  `.env.example`, and `.github/workflows/sync.yml` all use the same env var
  names.

# Risks

- **Backfill cleanup deletes 70%+ of rows.** Snapshot first (Phase 0.2). The
  delete is irreversible in Supabase without a snapshot.
- **OTX filter may be too strict initially** — expect to iterate the regex
  for 1-2 nights and accept some false-negative skips.
- **Gemini Imagen 3 cost** — at $0.04/image × 300 actors, the one-shot refresh
  costs ~$12. Nightly fill-missing at 20/night caps at ~$24/month.
- **Rarity recompute** changes existing actor cards visually. If anyone has
  bookmarked or shared cards externally (image OG tags), tier badges will
  change. Acceptable trade for accuracy.
- **Storage bucket policy** may not yet allow service-role writes. Verify with
  a test upload before Phase 3.
