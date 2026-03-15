# ThreatDex 🃏

> The threat actor encyclopedia, card by card.

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)
[![Data: TLP:WHITE](https://img.shields.io/badge/Data-TLP%3AWHITE-white.svg)](https://www.cisa.gov/tlp)
[![Sources: MITRE ATT&CK](https://img.shields.io/badge/Source-MITRE%20ATT%26CK-red.svg)](https://attack.mitre.org)
[![Sources: ETDA](https://img.shields.io/badge/Source-ETDA-orange.svg)](https://apt.etda.or.th)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg)](CONTRIBUTING.md)

ThreatDex turns dry APT intelligence into interactive trading cards — making threat actor research faster, more visual, and actually kind of fun. Browse, filter, and collect intelligence on the world’s most dangerous cyber threat actors, sourced nightly from MITRE ATT&CK, ETDA, AlienVault OTX, and more.

![ThreatDex screenshot](docs/screenshot.png)

-----

## ✨ Features

- **Interactive card flip** — quick-read stats on the front, full intel on the back
- **Rarity tiers** — MYTHIC, LEGENDARY, EPIC, RARE based on threat level and sophistication
- **Live filters** — search by name, alias, country, motivation, or target sector
- **Real CTI data** — aggregated and normalized from multiple open-source intel feeds
- **Nightly sync** — automated ingestion keeps cards up to date
- **Downloadable cards** — export any card as PNG or PDF
- **TLP:WHITE only** — all data is publicly available and safely shareable

-----

## 🗂️ Data Sources

|Source                                           |Type         |Entities                         |Update Frequency|
|-------------------------------------------------|-------------|---------------------------------|----------------|
|[MITRE ATT&CK](https://attack.mitre.org)         |TAXII 2.1 API|Groups, TTPs, Software, Campaigns|Nightly         |
|[ETDA Threat Group Cards](https://apt.etda.or.th)|Scraper      |Aliases, Origins, Operations     |Nightly         |
|[AlienVault OTX](https://otx.alienvault.com)     |REST API     |IOCs, Pulses, Campaigns          |Nightly         |
|[MISP](https://www.misp-project.org)             |REST API     |Threat Actors, Attributes        |On demand       |
|[OpenCTI](https://www.opencti.io)                |GraphQL API  |Actors, Relations, TTPs          |On demand       |

All data is **TLP:WHITE**. Attribution is approximate and for educational purposes only.

-----

## 🚀 Quickstart

### Prerequisites

- Node.js 18+
- Python 3.11+
- Docker + Docker Compose

### Run locally

```bash
# Clone the repo
git clone https://github.com/threatdex/threatdex.git
cd threatdex

# Copy environment variables
cp .env.example .env

# Start everything (Postgres, Redis, API, Web)
docker compose up

# Open in browser
open http://localhost:3000
```

That’s it. The database seeds automatically with ~130 threat actors from MITRE ATT&CK on first run.

### Manual setup (without Docker)

```bash
# Install frontend dependencies
cd apps/web && pnpm install && pnpm dev

# Install backend dependencies
cd apps/api && pip install -r requirements.txt && uvicorn main:app --reload

# Run a manual sync from MITRE
cd workers/mitre-sync && python sync.py
```

-----

## 🏗️ Architecture

```
threatdex/
├── apps/
│   ├── web/              # Next.js 14 frontend (App Router)
│   └── api/              # FastAPI backend
├── packages/
│   ├── schema/           # Shared TypeScript types + Zod schemas
│   └── ui/               # Card components (reusable)
├── workers/
│   ├── mitre-sync/       # TAXII 2.1 ingestion from MITRE ATT&CK
│   ├── etda-sync/        # ETDA threat group card scraper
│   └── image-gen/        # AI hero image generation queue
├── infra/                # Docker Compose, Terraform
└── docs/                 # Architecture diagrams, API reference
```

```mermaid
graph TD
    A[MITRE ATT&CK TAXII] --> D[Ingestion Workers]
    B[ETDA Scraper] --> D
    C[OTX / MISP / OpenCTI] --> D
    D --> E[(Postgres)]
    E --> F[FastAPI]
    F --> G[Next.js Frontend]
    F --> H[Public REST API]
    I[Redis] --> D
```

-----

## 🔌 API

ThreatDex exposes a public REST API for integrations.

```bash
# List all actors with filters
GET /api/actors?country=Russia&motivation=Espionage

# Get a single actor
GET /api/actors/apt28

# Search by name, alias, or tool
GET /api/search?q=fancy+bear

# Get card assets
GET /api/actors/apt28/card/front.png
GET /api/actors/apt28/card/back.png
```

Full API reference: <docs/API.md>

-----

## ⚙️ Environment Variables

```bash
# Required
DATABASE_URL=postgresql://user:password@localhost:5432/threatdex
REDIS_URL=redis://localhost:6379

# Optional — enables enrichment from these sources
OTX_API_KEY=              # AlienVault OTX
SOCRADAR_API_KEY=         # SOCRadar XTI
OPENAI_API_KEY=           # AI hero image generation
MISP_URL=                 # Your MISP instance
MISP_API_KEY=
OPENCTI_URL=              # Your OpenCTI instance
OPENCTI_API_KEY=
```

-----

## 🤝 Contributing

Contributions are very welcome. The best places to start:

- **Add a data source connector** — see <CONTRIBUTING.md> for the connector template
- **Improve card data** — spot an error or missing alias? Open a PR against `data/overrides/`
- **Frontend polish** — new filter types, card animations, export formats
- **Good first issues** — tagged [`good first issue`](https://github.com/threatdex/threatdex/issues?q=is%3Aissue+label%3A%22good+first+issue%22) in the issue tracker

Please read <CONTRIBUTING.md> and <SECURITY.md> before submitting.

-----

## ⚖️ Legal & Ethics

- All data is sourced from **publicly available, TLP:WHITE** intelligence feeds
- **Attribution is approximate** — country flags and sponsorship claims reflect community consensus, not legal findings
- No PII, no non-public intelligence, no TLP:AMBER or above
- Threat actor names and aliases are used for educational identification only
- See <SECURITY.md> for our responsible disclosure policy

-----

## 📄 License

ThreatDex code is [MIT licensed](LICENSE).

CTI data belongs to its respective upstream sources — MITRE ATT&CK, ETDA, AlienVault OTX, and others. See [DATA_SOURCES.md](docs/DATA_SOURCES.md) for full attribution.

-----

<p align="center">
  Built with ♥ for the security community<br/>
  <a href="https://threatdex.io">threatdex.io</a> · <a href="https://twitter.com/threatdex">@threatdex</a>
</p>
