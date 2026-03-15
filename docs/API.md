# ThreatDex — API Reference

Base URL: `http://localhost:8000` (development) or your deployed API URL.

All endpoints return JSON. All list responses are paginated (see [Pagination](#pagination)).

---

## Table of Contents

1. [Authentication](#authentication)
2. [Error Responses](#error-responses)
3. [Pagination](#pagination)
4. [Endpoints](#endpoints)
   - [GET /api/actors](#get-apiactors)
   - [GET /api/actors/{id}](#get-apiactorsid)
   - [GET /api/actors/{id}/card/front](#get-apiactorsidcardfront)
   - [GET /api/actors/{id}/card/back](#get-apiactorsidcardback)
   - [GET /api/search](#get-apisearch)
   - [GET /api/sources](#get-apisources)
   - [POST /api/admin/sync/{source}](#post-apiadminsyncsource)

---

## Authentication

Most endpoints are public and require no authentication.

The admin endpoint (`POST /api/admin/sync/{source}`) requires the
`X-Admin-Secret` header to match the `ADMIN_SECRET` environment variable.

```
X-Admin-Secret: your-admin-secret-here
```

---

## Error Responses

All errors follow this format:

```json
{
  "detail": "Human-readable error message"
}
```

| HTTP Status | Meaning                                            |
|-------------|----------------------------------------------------|
| 400         | Bad request — invalid query parameters             |
| 401         | Unauthorized — missing or invalid admin secret     |
| 404         | Not found — actor or resource does not exist       |
| 422         | Unprocessable entity — validation error            |
| 500         | Internal server error                              |
| 503         | Service unavailable — upstream CTI source is down  |

---

## Pagination

All list endpoints accept `limit` and `offset` query parameters and return a
paginated envelope:

```json
{
  "items": [ /* array of objects */ ],
  "total": 312,
  "limit": 20,
  "offset": 0
}
```

| Parameter | Type    | Default | Max  | Description                    |
|-----------|---------|---------|------|--------------------------------|
| `limit`   | integer | 20      | 100  | Number of items to return      |
| `offset`  | integer | 0       | —    | Number of items to skip        |

---

## Endpoints

### GET /api/actors

Returns a paginated list of threat actors. Supports filtering and full-text search.

**Query Parameters**

| Parameter    | Type   | Description                                                       |
|--------------|--------|-------------------------------------------------------------------|
| `country`    | string | Filter by country code (ISO 3166-1 alpha-2, e.g. `RU`, `CN`)     |
| `motivation` | string | Filter by motivation: `espionage`, `financial`, `sabotage`, `hacktivism`, `military` |
| `search`     | string | Full-text search across names, aliases, tools, and techniques     |
| `limit`      | integer | Page size (default 20, max 100)                                  |
| `offset`     | integer | Page offset (default 0)                                           |

**Example Request**

```
GET /api/actors?country=RU&motivation=espionage&limit=10&offset=0
```

**Example Response** `200 OK`

```json
{
  "items": [
    {
      "id": "apt28",
      "canonicalName": "APT28",
      "aliases": ["Fancy Bear", "Sofacy", "Pawn Storm", "STRONTIUM"],
      "mitreId": "G0007",
      "country": "Russia",
      "countryCode": "RU",
      "motivation": ["espionage", "sabotage"],
      "threatLevel": 9,
      "sophistication": "Nation-State Elite",
      "firstSeen": "2004",
      "lastSeen": "2024",
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
      "imageUrl": "https://assets.threatdex.io/images/apt28.png",
      "sources": [
        {
          "source": "mitre",
          "sourceId": "G0007",
          "fetchedAt": "2024-01-15T02:00:00Z",
          "url": "https://attack.mitre.org/groups/G0007/"
        }
      ],
      "tlp": "WHITE",
      "lastUpdated": "2024-01-15T02:00:00Z"
    }
  ],
  "total": 47,
  "limit": 10,
  "offset": 0
}
```

---

### GET /api/actors/{id}

Returns full details for a single threat actor.

**Path Parameters**

| Parameter | Type   | Description                                |
|-----------|--------|--------------------------------------------|
| `id`      | string | Actor slug (e.g. `apt28`, `lazarus-group`) |

**Example Request**

```
GET /api/actors/apt28
```

**Example Response** `200 OK`

Same schema as a single item in the list response above, with all fields populated.

**Error Response** `404 Not Found`

```json
{
  "detail": "Actor 'apt28' not found"
}
```

---

### GET /api/actors/{id}/card/front

Returns a PNG image of the card's front face for the specified actor. This is a
rendered image (not JSON) suitable for downloading or embedding.

**Path Parameters**

| Parameter | Type   | Description |
|-----------|--------|-------------|
| `id`      | string | Actor slug  |

**Example Request**

```
GET /api/actors/apt28/card/front
```

**Response**

- Content-Type: `image/png`
- Body: binary PNG data

**Error Response** `404 Not Found`

```json
{
  "detail": "Actor 'apt28' not found"
}
```

---

### GET /api/actors/{id}/card/back

Returns a PNG image of the card's back face for the specified actor.

**Path Parameters**

| Parameter | Type   | Description |
|-----------|--------|-------------|
| `id`      | string | Actor slug  |

**Example Request**

```
GET /api/actors/apt28/card/back
```

**Response**

- Content-Type: `image/png`
- Body: binary PNG data

---

### GET /api/search

Full-text search across actor names, aliases, tools, and techniques. Returns
paginated results ranked by relevance.

**Query Parameters**

| Parameter | Type    | Required | Description                               |
|-----------|---------|----------|-------------------------------------------|
| `q`       | string  | Yes      | Search query (minimum 2 characters)       |
| `limit`   | integer | No       | Page size (default 20, max 100)           |
| `offset`  | integer | No       | Page offset (default 0)                   |

**Example Request**

```
GET /api/search?q=cobalt+strike&limit=5
```

**Example Response** `200 OK`

```json
{
  "items": [
    {
      "id": "fin7",
      "canonicalName": "FIN7",
      "aliases": ["Carbanak", "Navigator Group"],
      "rarity": "LEGENDARY",
      "country": "Unknown",
      "motivation": ["financial"],
      "threatLevel": 8,
      "tagline": "The criminal empire behind Cobalt Strike campaigns"
    }
  ],
  "total": 12,
  "limit": 5,
  "offset": 0
}
```

**Error Response** `400 Bad Request`

```json
{
  "detail": "Query parameter 'q' is required and must be at least 2 characters"
}
```

---

### GET /api/sources

Returns all configured CTI sources and their last synchronisation timestamps.

**Example Request**

```
GET /api/sources
```

**Example Response** `200 OK`

```json
[
  {
    "source": "mitre",
    "displayName": "MITRE ATT&CK",
    "url": "https://attack.mitre.org",
    "lastSync": "2024-01-15T02:03:47Z",
    "actorCount": 143,
    "status": "ok"
  },
  {
    "source": "etda",
    "displayName": "ETDA APT Groups",
    "url": "https://apt.etda.or.th",
    "lastSync": "2024-01-15T02:07:12Z",
    "actorCount": 231,
    "status": "ok"
  },
  {
    "source": "otx",
    "displayName": "AlienVault OTX",
    "url": "https://otx.alienvault.com",
    "lastSync": null,
    "actorCount": 0,
    "status": "disabled",
    "reason": "OTX_API_KEY not configured"
  }
]
```

---

### POST /api/admin/sync/{source}

Triggers a manual synchronisation for the specified CTI source. Enqueues a Celery
task and returns immediately — the sync runs asynchronously.

**Authentication:** Required. Pass the `X-Admin-Secret` header.

**Path Parameters**

| Parameter | Type   | Description                                              |
|-----------|--------|----------------------------------------------------------|
| `source`  | string | One of: `mitre`, `etda`, `otx`, `misp`, `opencti`, `all` |

**Example Request**

```
POST /api/admin/sync/mitre
X-Admin-Secret: your-admin-secret-here
Content-Type: application/json
```

**Example Response** `202 Accepted`

```json
{
  "message": "Sync task enqueued for source: mitre",
  "taskId": "c2a1e3f7-8b4d-4f2e-a9c0-1234567890ab",
  "source": "mitre",
  "enqueuedAt": "2024-01-15T10:30:00Z"
}
```

**Error Response** `401 Unauthorized`

```json
{
  "detail": "Invalid or missing admin secret"
}
```

**Error Response** `400 Bad Request`

```json
{
  "detail": "Unknown source 'unknown'. Valid sources: mitre, etda, otx, misp, opencti, all"
}
```

**Error Response** `503 Service Unavailable`

```json
{
  "detail": "Source 'otx' is disabled — OTX_API_KEY is not configured"
}
```

---

## OpenAPI / Swagger UI

When the API is running, interactive documentation is available at:

- Swagger UI: `http://localhost:8000/docs`
- ReDoc: `http://localhost:8000/redoc`
- OpenAPI JSON: `http://localhost:8000/openapi.json`
