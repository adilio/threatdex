# ThreatDex — Data Sources

ThreatDex aggregates threat actor intelligence from multiple public Cyber Threat
Intelligence (CTI) feeds. This document describes each source, its license, update
frequency, and how ThreatDex uses it.

All data is normalised into the canonical `ThreatActor` schema before storage.
See `packages/schema/src/index.ts` for the full type definition.

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

**Worker:** `workers/mitre-sync`
**Protocol:** TAXII 2.1

### Overview

MITRE ATT&CK is the authoritative knowledge base of adversary tactics, techniques,
and procedures (TTPs) based on real-world observations. The Groups section documents
named threat actor groups.

### Endpoint

```
https://attack-taxii.mitre.org/taxii2/
Collection: Enterprise ATT&CK
STIX object types: intrusion-set, relationship, tool, attack-pattern
```

### What ThreatDex Ingests

| ATT&CK field              | ThreatActor field       |
|---------------------------|-------------------------|
| `name`                    | `canonicalName`         |
| `aliases`                 | `aliases`               |
| `external_references[id]` | `mitreId`               |
| `description`             | `description`           |
| `first_seen`              | `firstSeen`             |
| `last_seen`               | `lastSeen`              |
| `x_mitre_contributors`    | `sources`               |
| Related `tool` objects    | `tools`                 |
| Related `attack-pattern`  | `ttps`                  |

### License

MITRE ATT&CK content is available under the
[ATT&CK Terms of Use](https://attack.mitre.org/resources/terms-of-use/).
It is freely available for public use with attribution.

### Update Frequency

MITRE releases new ATT&CK versions 2–3 times per year. ThreatDex syncs nightly
at 02:00 UTC to pick up any interim updates pushed to the TAXII server.

### Attribution

> Threat actor data sourced from MITRE ATT&CK®.
> © The MITRE Corporation. ATT&CK® is a registered trademark of The MITRE Corporation.
> https://attack.mitre.org

---

## 2. ETDA APT Groups

**Worker:** `workers/etda-sync`
**Protocol:** HTTP scraping

### Overview

The Electronic Transactions Development Agency (ETDA) of Thailand maintains a
comprehensive APT group tracker aggregated from public reporting. It covers groups
not always present in MITRE ATT&CK and is particularly strong on Asia-Pacific actors.

### Endpoints

```
Group listing:  https://apt.etda.or.th/cgi-bin/listgroups.cgi
Group detail:   https://apt.etda.or.th/cgi-bin/showcard.cgi?g={group_name}
```

### What ThreatDex Ingests

| ETDA field        | ThreatActor field   |
|-------------------|---------------------|
| Group name        | `canonicalName`     |
| Also known as     | `aliases`           |
| Country           | `country`           |
| Motivation        | `motivation`        |
| First seen        | `firstSeen`         |
| Last seen         | `lastSeen`          |
| Target sectors    | `sectors`           |
| Target countries  | `geographies`       |
| Tools             | `tools`             |
| Techniques (ATT&CK refs) | `ttps`       |
| Description       | `description`       |

### License

ETDA data is freely available for research purposes. The worker respects crawl
delays and does not hammer the server. No scraping in violation of the site's
terms of service.

### Update Frequency

ETDA updates its tracker on an irregular basis as new reports are published.
ThreatDex syncs nightly and applies an if-modified-since check to avoid redundant
work.

### Attribution

> APT group data sourced from ETDA APT Groups Tracker.
> © Electronic Transactions Development Agency (ETDA), Thailand.
> https://apt.etda.or.th

---

## 3. AlienVault OTX

**Worker:** `workers/otx-sync`
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

### API Endpoints Used

```
GET https://otx.alienvault.com/api/v1/pulses/subscribed
GET https://otx.alienvault.com/api/v1/indicators/export
```

### What ThreatDex Ingests

| OTX field         | ThreatActor field   |
|-------------------|---------------------|
| Pulse name / tags | enriches `aliases`  |
| Malware families  | enriches `tools`    |
| ATT&CK tags       | enriches `ttps`     |
| References        | appended to `sources` |

OTX data supplements but does not override MITRE or ETDA data. Actor records
are matched by alias before enrichment is applied.

### License

OTX content contributed by community members is governed by the
[OTX Terms of Service](https://otx.alienvault.com/api). Commercial use may
require a separate agreement with AT&T Cybersecurity.

### Update Frequency

Nightly at 02:00 UTC when `OTX_API_KEY` is present.

### Attribution

> Threat intelligence enriched with data from AlienVault Open Threat Exchange (OTX).
> https://otx.alienvault.com

---

## 4. MISP (Optional)

**Worker:** `workers/shared` (MISP connector module)
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

### API Endpoints Used

```
GET {MISP_URL}/galaxies/index
GET {MISP_URL}/galaxies/view/{galaxy_id}
GET {MISP_URL}/events/index   (actor-tagged events)
```

### What ThreatDex Ingests

| MISP field            | ThreatActor field   |
|-----------------------|---------------------|
| Galaxy cluster name   | `canonicalName`     |
| Synonyms              | `aliases`           |
| Cluster description   | `description`       |
| Country meta          | `country`           |
| Related events        | `campaigns`         |

### License

MISP and its default galaxy content are distributed under
[GNU Affero GPL v3](https://www.gnu.org/licenses/agpl-3.0.html). Private events
from your own MISP instance remain your organisation's data.

### Update Frequency

Triggered manually via `POST /api/admin/sync/misp` or added to the nightly cron
by updating `.github/workflows/sync.yml`.

---

## 5. OpenCTI (Optional)

**Worker:** `workers/shared` (OpenCTI connector module)
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

### API Endpoints Used

```
POST {OPENCTI_URL}/graphql
  query: ThreatActors, Intrusion Sets, Malware, Tools
```

### What ThreatDex Ingests

| OpenCTI field         | ThreatActor field   |
|-----------------------|---------------------|
| `name`                | `canonicalName`     |
| `aliases`             | `aliases`           |
| `description`         | `description`       |
| `country` (relation)  | `country`           |
| `uses` (malware)      | `tools`             |
| `uses` (attack-pattern) | `ttps`            |
| `objectMarking`       | `tlp`               |

### License

OpenCTI is open source (Apache 2.0). Data within your instance is governed by
the TLP markings applied to each object.

### Update Frequency

Triggered manually via `POST /api/admin/sync/opencti` or by adding to the nightly
cron in `.github/workflows/sync.yml`.

---

## Attribution Summary

| Source       | Required | License            | Attribution required |
|--------------|----------|--------------------|----------------------|
| MITRE ATT&CK | No (but strongly recommended) | ATT&CK Terms of Use | Yes |
| ETDA         | No       | Public research    | Yes                  |
| AlienVault OTX | No (API key required) | OTX ToS   | Yes                  |
| MISP         | No (self-hosted) | AGPL v3      | Yes (for galaxy data)|
| OpenCTI      | No (self-hosted) | Apache 2.0   | Yes (for bundled data)|

ThreatDex stores a `SourceAttribution` record alongside every actor it ingests.
The `GET /api/sources` endpoint returns the last sync time and actor count for
each configured source.

---

## Adding a New Source

To add a new CTI source connector:

1. Create a new module under `workers/` (e.g. `workers/my-source/`)
2. Implement the following interface:

```python
from typing import List
from apps.api.models import ThreatActorCreate

async def fetch_actors() -> List[ThreatActorCreate]:
    """
    Fetch threat actor data from the source and return a list of
    normalised ThreatActorCreate objects conforming to the canonical schema.

    - Must check for required env vars and raise a clear error if missing.
    - Must handle network errors gracefully and log warnings.
    - Must not crash the application if the source is unavailable.
    - Must include a SourceAttribution entry for each record.
    """
    ...
```

3. Register the source in `apps/api/routers/admin.py` under the sync router
4. Add the source to the nightly cron in `.github/workflows/sync.yml`
5. Document the source in this file following the template above
6. Add tests in `apps/api/tests/` that mock the upstream HTTP calls

See `CONTRIBUTING.md` for the full connector template and code style guide.
