# ThreatDex — Data Access Reference

ThreatDex stores all threat actor data in Supabase (PostgreSQL). There is no
separate REST API server — data is accessed via:

1. **React Router loaders** — server-side Supabase queries for the web UI
2. **Supabase auto-REST API** — for external integrations and programmatic access
3. **Supabase JS SDK** — for any TypeScript consumers

---

## Table of Contents

1. [Supabase REST API](#supabase-rest-api)
2. [Authentication](#authentication)
3. [Error Responses](#error-responses)
4. [Pagination](#pagination)
5. [Actors Table](#actors-table)
   - [List actors](#list-actors)
   - [Get a single actor](#get-a-single-actor)
   - [Search actors](#search-actors)
6. [Sources Table](#sources-table)
7. [Triggering Manual Syncs](#triggering-manual-syncs)

---

## Supabase REST API

Supabase exposes a PostgREST-compatible REST API automatically from your schema.

Base URL: `https://<your-project>.supabase.co/rest/v1`

All requests require the `apikey` header set to your `SUPABASE_ANON_KEY`.

---

## Authentication

Public endpoints (all actor reads) require only the anon key:

```
apikey: your-supabase-anon-key
Authorization: Bearer your-supabase-anon-key
```

Row-level security (RLS) is configured so that TLP:WHITE actor records are
readable without authentication. No user login is required for read access.

---

## Error Responses

Supabase PostgREST errors follow this format:

```json
{
  "code": "PGRST116",
  "details": null,
  "hint": null,
  "message": "The result contains 0 rows"
}
```

| HTTP Status | Meaning                                           |
|-------------|---------------------------------------------------|
| 400         | Bad request — invalid filter or malformed request |
| 401         | Unauthorized — missing or invalid API key         |
| 404         | Resource not found                                |
| 406         | Not acceptable — RLS blocked the query            |

---

## Pagination

All list queries support `limit` and `offset` via query parameters or the JS SDK:

```
GET /rest/v1/actors?limit=20&offset=0
```

The `Content-Range` response header indicates total row count:

```
Content-Range: 0-19/312
```

---

## Actors Table

The `actors` table stores all `ThreatActor` records. JSON columns store
`ttps`, `campaigns`, `sources`, `aliases`, `tools`, `sectors`, `geographies`,
and `motivation`.

### List actors

**via Supabase REST:**

```
GET /rest/v1/actors?order=threat_level.desc&limit=20&offset=0
```

**Filter by country:**

```
GET /rest/v1/actors?country_code=eq.RU&limit=20
```

**Filter by motivation (array contains):**

```
GET /rest/v1/actors?motivation=cs.{"espionage"}&limit=20
```

**via Supabase JS SDK:**

```typescript
const { data, error } = await supabase
  .from("actors")
  .select("*")
  .eq("country_code", "RU")
  .contains("motivation", ["espionage"])
  .order("threat_level", { ascending: false })
  .range(0, 19)
```

**Example response item:**

```json
{
  "id": "apt28",
  "canonical_name": "APT28",
  "aliases": ["Fancy Bear", "Sofacy", "Pawn Storm", "STRONTIUM"],
  "mitre_id": "G0007",
  "country": "Russia",
  "country_code": "RU",
  "motivation": ["espionage", "sabotage"],
  "threat_level": 9,
  "sophistication": "Nation-State Elite",
  "first_seen": "2004",
  "last_seen": "2024",
  "sectors": ["Government", "Military", "Defense", "Media"],
  "geographies": ["Europe", "United States", "Ukraine"],
  "tools": ["Mimikatz", "X-Agent", "Sofacy", "Zebrocy"],
  "ttps": [
    {
      "techniqueId": "T1566",
      "techniqueName": "Phishing",
      "tactic": "Initial Access"
    }
  ],
  "campaigns": [
    {
      "name": "Operation Pawn Storm",
      "year": "2014",
      "description": "Targeted military, government, and media organizations."
    }
  ],
  "description": "APT28 is a threat group attributed to Russia's GRU...",
  "tagline": "Russia's cyber spearhead",
  "rarity": "MYTHIC",
  "image_url": "https://<project>.supabase.co/storage/v1/object/public/images/apt28.png",
  "sources": [
    {
      "source": "mitre",
      "sourceId": "G0007",
      "fetchedAt": "2024-01-15T02:00:00Z",
      "url": "https://attack.mitre.org/groups/G0007/"
    }
  ],
  "tlp": "WHITE",
  "last_updated": "2024-01-15T02:00:00Z"
}
```

---

### Get a single actor

**via Supabase REST:**

```
GET /rest/v1/actors?id=eq.apt28&limit=1
```

**via Supabase JS SDK:**

```typescript
const { data, error } = await supabase
  .from("actors")
  .select("*")
  .eq("id", "apt28")
  .single()
```

---

### Search actors

Full-text search uses PostgreSQL `tsvector`. The `actors` table has a generated
`search_vector` column indexed for fast full-text queries.

**via Supabase REST:**

```
GET /rest/v1/actors?search_vector=fts.fancy+bear&limit=20
```

**via Supabase JS SDK:**

```typescript
const { data, error } = await supabase
  .from("actors")
  .select("*")
  .textSearch("search_vector", "fancy bear")
  .limit(20)
```

---

## Sources Table

The `sync_log` table tracks each worker run and its outcome.

**via Supabase JS SDK:**

```typescript
const { data, error } = await supabase
  .from("sync_log")
  .select("source, started_at, completed_at, records_synced, status, error_message")
  .order("started_at", { ascending: false })
  .limit(50)
```

**Example response item:**

```json
{
  "source": "mitre",
  "started_at": "2024-01-15T02:00:00Z",
  "completed_at": "2024-01-15T02:03:47Z",
  "records_synced": 143,
  "status": "ok",
  "error_message": null
}
```

---

## Triggering Manual Syncs

Data syncs are triggered by running the TypeScript worker scripts directly. There
is no HTTP endpoint for this — syncs are operational tasks run from CI or a
developer's machine.

```bash
# Sync from MITRE ATT&CK
pnpm workers:mitre

# Sync from ETDA
pnpm workers:etda

# Sync from AlienVault OTX (requires OTX_API_KEY)
pnpm workers:otx

# Generate hero images (requires OPENAI_API_KEY)
pnpm workers:image

# Run all sources in sequence
pnpm workers:all
```

Workers require `SUPABASE_URL` and `SUPABASE_SERVICE_KEY` in the environment.
See `.env.example` for the full list.

The nightly cron in `.github/workflows/sync.yml` runs `pnpm workers:all`
automatically at 02:00 UTC.
