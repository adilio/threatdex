# ThreatDex — Data Sources

ThreatDex aggregates threat actor intelligence from multiple public Cyber Threat
Intelligence (CTI) feeds. This document describes each source, its license, update
frequency, and how ThreatDex uses it.

All data is normalised into the canonical `ThreatActor` schema before storage.
See `app/schema/index.ts` for the full type definition.

---

## Table of Contents

1. [MITRE ATT&CK](#1-mitre-attck)
2. [ETDA APT Groups](#2-etda-apt-groups)
3. [AlienVault OTX](#3-alienvault-otx)
4. [MISP](#4-misp-optional)
5. [OpenCTI](#5-opencti-optional)
6. [Attribution Summary](#attribution-summary)
7. [Adding a New Source](#adding-a-new-source)

---

## 1. MITRE ATT&CK

**Worker:** `workers/mitre-sync.ts`
**Protocol:** STIX 2.1 JSON bundle (GitHub CDN)

### Overview

MITRE ATT&CK is the authoritative knowledge base of adversary tactics, techniques,
and procedures (TTPs) based on real-world observations. The Groups section documents
named threat actor groups.

### Data source

```
https://raw.githubusercontent.com/mitre/cti/master/enterprise-attack/enterprise-attack.json
```

This is the full Enterprise ATT&CK STIX 2.1 bundle. The worker fetches it as a
single JSON file, which is more reliable in CI environments than live TAXII queries.

### STIX object types ingested

- `intrusion-set` — threat actor groups
- `relationship` (type `uses`) — links groups to tools and attack patterns
- `tool`, `malware` — adversary tools
- `attack-pattern` — ATT&CK techniques (TTPs)
- `campaign` — named operations

### What ThreatDex ingests

| STIX field                | ThreatActor field |
|---------------------------|-------------------|
| `name`                    | `canonicalName`   |
| `aliases` / `x_mitre_aliases` | `aliases`     |
| `external_references[id]` | `mitreId`         |
| `description`             | `description`     |
| `first_seen`              | `firstSeen`       |
| `last_seen`               | `lastSeen`        |
| Related `tool`/`malware`  | `tools`           |
| Related `attack-pattern`  | `ttps`            |
| Related `campaign`        | `campaigns`       |

### License

MITRE ATT&CK content is available under the
[ATT&CK Terms of Use](https://attack.mitre.org/resources/terms-of-use/).
It is freely available for public use with attribution.

### Update frequency

MITRE releases new ATT&CK versions 2–3 times per year. ThreatDex syncs nightly
at 02:00 UTC to pick up any interim updates pushed to the STIX bundle.

### Attribution

> Threat actor data sourced from MITRE ATT&CK®.
> © The MITRE Corporation. ATT&CK® is a registered trademark of The MITRE Corporation.
> https://attack.mitre.org

---

## 2. ETDA APT Groups

**Worker:** `workers/etda-sync.ts`
**Protocol:** HTTP scraping (cheerio)

### Overview

The Electronic Transactions Development Agency (ETDA) of Thailand maintains a
comprehensive APT group tracker aggregated from public reporting. It covers groups
not always present in MITRE ATT&CK and is particularly strong on Asia-Pacific actors.

### Endpoints

```
Group listing:  https://apt.etda.or.th/cgi-bin/listgroups.cgi
Group detail:   https://apt.etda.or.th/cgi-bin/showcard.cgi?g={group_name}
```

### What ThreatDex ingests

| ETDA field               | ThreatActor field  |
|--------------------------|--------------------|
| Group name               | `canonicalName`    |
| Also known as            | `aliases`          |
| Country                  | `country`          |
| Motivation               | `motivation`       |
| First seen               | `firstSeen`        |
| Last seen                | `lastSeen`         |
| Target sectors           | `sectors`          |
| Target countries         | `geographies`      |
| Tools                    | `tools`            |
| Techniques (ATT&CK refs) | `ttps`             |
| Description              | `description`      |

### License

ETDA data is freely available for research purposes. The worker respects crawl
delays and does not hammer the server.

### Update frequency

ETDA updates its tracker on an irregular basis as new reports are published.
ThreatDex syncs nightly and checks for changes before writing.

### Attribution

> APT group data sourced from ETDA APT Groups Tracker.
> © Electronic Transactions Development Agency (ETDA), Thailand.
> https://apt.etda.or.th

---

## 3. AlienVault OTX

**Worker:** `workers/otx-sync.ts`
**Protocol:** REST API (requires API key)
**Feature flag:** Disabled if `OTX_API_KEY` is not set

### Overview

AlienVault Open Threat Exchange (OTX) is a community-driven threat intelligence
platform. ThreatDex uses the OTX API to enrich existing actor records with
additional aliases, indicators of compromise (IoCs), and tool references sourced
from community-contributed pulses.

### Setup

1. Create a free account at https://otx.alienvault.com
2. Navigate to your profile settings → API Integration
3. Copy your API key into `.env` as `OTX_API_KEY`

### API endpoints used

```
GET https://otx.alienvault.com/api/v1/pulses/subscribed
GET https://otx.alienvault.com/api/v1/indicators/export
```

### What ThreatDex ingests

| OTX field          | ThreatActor field      |
|--------------------|------------------------|
| Pulse name / tags  | enriches `aliases`     |
| Malware families   | enriches `tools`       |
| ATT&CK tags        | enriches `ttps`        |
| References         | appended to `sources`  |

OTX data supplements but does not override MITRE or ETDA data. Actor records
are matched by alias before enrichment is applied.

### License

OTX content contributed by community members is governed by the
[OTX Terms of Service](https://otx.alienvault.com/api). Commercial use may
require a separate agreement with AT&T Cybersecurity.

### Update frequency

Nightly at 02:00 UTC when `OTX_API_KEY` is present.

### Attribution

> Threat intelligence enriched with data from AlienVault Open Threat Exchange (OTX).
> https://otx.alienvault.com

---

## 4. MISP (Optional)

**Worker:** Not yet implemented — planned for a future release
**Protocol:** MISP REST API
**Feature flag:** Disabled if `MISP_URL` or `MISP_API_KEY` is not set

### Overview

MISP (Malware Information Sharing Platform) is an open-source threat intelligence
platform used widely within CERTs, ISACs, and security teams. ThreatDex can connect
to a self-hosted MISP instance to ingest actor-related galaxy clusters and events.

### Setup

1. Stand up a MISP instance (https://www.misp-project.org/download/)
2. Generate an API key in MISP (Administration → API keys)
3. Set `MISP_URL` and `MISP_API_KEY` in `.env`

### API endpoints used

```
GET {MISP_URL}/galaxies/index
GET {MISP_URL}/galaxies/view/{galaxy_id}
GET {MISP_URL}/events/index   (actor-tagged events)
```

### What ThreatDex ingests

| MISP field          | ThreatActor field |
|---------------------|-------------------|
| Galaxy cluster name | `canonicalName`   |
| Synonyms            | `aliases`         |
| Cluster description | `description`     |
| Country meta        | `country`         |
| Related events      | `campaigns`       |

### License

MISP and its default galaxy content are distributed under
[GNU Affero GPL v3](https://www.gnu.org/licenses/agpl-3.0.html). Private events
from your own MISP instance remain your organisation's data.

### Update frequency

Run manually: `pnpm workers:mitre` or add to the nightly cron by updating
`.github/workflows/sync.yml`.

---

## 5. OpenCTI (Optional)

**Worker:** Not yet implemented — planned for a future release
**Protocol:** OpenCTI GraphQL API
**Feature flag:** Disabled if `OPENCTI_URL` or `OPENCTI_API_KEY` is not set

### Overview

OpenCTI is an open-source threat intelligence platform that structures data using
STIX 2.1. ThreatDex can connect to a self-hosted OpenCTI instance to pull threat
actor objects and their relationships.

### Setup

1. Stand up an OpenCTI instance (https://docs.opencti.io/latest/deployment/installation/)
2. Create an API token in OpenCTI (Settings → Users → your user → API access)
3. Set `OPENCTI_URL` and `OPENCTI_API_KEY` in `.env`

### API endpoints used

```
POST {OPENCTI_URL}/graphql
  query: ThreatActors, Intrusion Sets, Malware, Tools
```

### What ThreatDex ingests

| OpenCTI field           | ThreatActor field |
|-------------------------|-------------------|
| `name`                  | `canonicalName`   |
| `aliases`               | `aliases`         |
| `description`           | `description`     |
| `country` (relation)    | `country`         |
| `uses` (malware)        | `tools`           |
| `uses` (attack-pattern) | `ttps`            |
| `objectMarking`         | `tlp`             |

### License

OpenCTI is open source (Apache 2.0). Data within your instance is governed by
the TLP markings applied to each object.

### Update frequency

Run manually or by adding to the nightly cron in `.github/workflows/sync.yml`.

---

## Attribution Summary

| Source         | Required               | License             | Attribution required    |
|----------------|------------------------|---------------------|-------------------------|
| MITRE ATT&CK   | No (strongly recommended) | ATT&CK Terms of Use | Yes                  |
| ETDA           | No                     | Public research     | Yes                     |
| AlienVault OTX | No (API key required)  | OTX ToS             | Yes                     |
| MISP           | No (self-hosted)       | AGPL v3             | Yes (for galaxy data)   |
| OpenCTI        | No (self-hosted)       | Apache 2.0          | Yes (for bundled data)  |

ThreatDex stores a `SourceAttribution` record alongside every actor it ingests.
The `sync_log` table in Supabase tracks the last sync time and record count for
each source run.

---

## Adding a New Source

To add a new TypeScript CTI source worker:

### 1. Create a new worker file

```
workers/
└── my-source.ts      ← main ingestion script
```

Add the run command to `package.json`:

```json
"workers:mysource": "tsx workers/my-source.ts"
```

### 2. Implement the worker

```typescript
/**
 * My Source connector for ThreatDex.
 *
 * Ingests threat actor data from My Source and normalises it into the
 * canonical ThreatActor schema.
 *
 * Required env vars:
 *   MY_SOURCE_API_KEY  — obtain from https://my-source.example.com/api
 *
 * Feature-flagged: if MY_SOURCE_API_KEY is not set, the worker exits cleanly.
 *
 * Usage:
 *   npx tsx workers/my-source.ts
 */

import { supabase, logSyncStart, logSyncComplete, logSyncError } from "./shared/supabase.js"
import { findMatchingActor, mergeActors } from "./shared/dedup.js"
import { computeThreatLevel, computeRarity } from "./shared/rarity.js"
import { toDbRecord } from "./shared/models.js"
import type { ThreatActorData, SourceAttribution } from "./shared/models.js"

const SOURCE_NAME = "manual" // use the closest registered source type
const BASE_URL = "https://api.my-source.example.com/v1"

function isEnabled(): boolean {
  const key = process.env.MY_SOURCE_API_KEY
  if (!key) {
    console.warn("MY_SOURCE_API_KEY is not set — My Source connector is disabled.")
    return false
  }
  return true
}

async function fetchRaw(): Promise<Record<string, unknown>[]> {
  const apiKey = process.env.MY_SOURCE_API_KEY!
  const response = await fetch(`${BASE_URL}/actors`, {
    headers: { Authorization: `Bearer ${apiKey}` },
  })
  if (!response.ok) throw new Error(`HTTP ${response.status}`)
  const json = (await response.json()) as { data: Record<string, unknown>[] }
  return json.data
}

function normalise(raw: Record<string, unknown>): ThreatActorData {
  const now = new Date().toISOString()
  const name = String(raw["name"] ?? "Unknown")

  const sources: SourceAttribution[] = [{
    source: SOURCE_NAME,
    sourceId: String(raw["id"]),
    fetchedAt: now,
    url: `https://my-source.example.com/actors/${raw["slug"]}`,
  }]

  const threatLevel = computeThreatLevel({ sophistication: "Medium", ttpsCount: 0, campaignsCount: 0 })
  const rarity = computeRarity({ threatLevel, sophistication: "Medium", sourcesCount: 1 })

  return {
    id: String(raw["slug"]),
    canonicalName: name,
    aliases: (raw["aliases"] as string[]) ?? [],
    description: String(raw["description"] ?? ""),
    motivation: ["espionage"],
    threatLevel,
    sophistication: "Medium",
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

  const logId = await logSyncStart(SOURCE_NAME)
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

### 3. Add a test

```typescript
// tests/workers/my-source.test.ts
import { describe, it, expect, vi } from "vitest"

vi.mock("../../workers/shared/supabase.js", () => ({
  supabase: { from: vi.fn().mockReturnValue({ upsert: vi.fn().mockResolvedValue({ error: null }) }) },
  logSyncStart: vi.fn().mockResolvedValue("log-id"),
  logSyncComplete: vi.fn().mockResolvedValue(undefined),
  logSyncError: vi.fn().mockResolvedValue(undefined),
}))

describe("my-source worker", () => {
  it("skips when API key is not set", async () => {
    delete process.env.MY_SOURCE_API_KEY
    // worker should exit without error
  })
})
```

### 4. Register in the nightly cron

Add to `.github/workflows/sync.yml`:

```yaml
- name: Sync My Source
  run: pnpm workers:mysource
  env:
    SUPABASE_URL: ${{ secrets.SUPABASE_URL }}
    SUPABASE_SERVICE_KEY: ${{ secrets.SUPABASE_SERVICE_KEY }}
    MY_SOURCE_API_KEY: ${{ secrets.MY_SOURCE_API_KEY }}
```

### 5. Document the source in this file

Add a new section following the template above.

See `CONTRIBUTING.md` for the full code style guide.
