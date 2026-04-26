/**
 * Curated emerging actor sync.
 *
 * MITRE and ETDA can lag fast-moving public reporting. This worker keeps a
 * small, source-cited set of emerging actors in ThreatDex until they are
 * covered by the canonical feeds.
 *
 * Usage:
 *   pnpm workers:curated
 */

import { logSyncStart, logSyncComplete, logSyncError } from "./shared/supabase.js"
import { upsertActorPreservingMedia } from "./shared/upsert.js"
import type { ThreatActorData } from "./shared/models.js"

function nowIso(): string {
  return new Date().toISOString()
}

const CURATED_ACTORS: Omit<ThreatActorData, "lastUpdated">[] = [
  {
    id: "teampcp",
    canonicalName: "TeamPCP",
    aliases: ["DeadCatx3", "PCPcat", "PersyPCP", "ShellForce", "Team PCP"],
    country: "Unknown",
    motivation: ["financial", "sabotage"],
    threatLevel: 8,
    sophistication: "High",
    firstSeen: "2025",
    lastSeen: "2026",
    sectors: [
      "Cloud infrastructure",
      "Software supply chain",
      "CI/CD",
      "Financial services",
      "Professional services",
      "Consumer goods",
    ],
    geographies: [
      "Worldwide",
      "United Arab Emirates",
      "Canada",
      "South Korea",
      "Serbia",
      "United States",
      "Vietnam",
      "Iran",
    ],
    tools: [
      "FRP",
      "GO Simple Tunnel",
      "Sliver",
      "XMRig",
      "TeamPCP Cloud Stealer",
      "tpcp.tar.gz",
    ],
    ttps: [],
    campaigns: [
      {
        name: "Cloud infrastructure exploitation wave",
        year: "2025",
        description:
          "Large-scale exploitation of exposed Docker APIs, Kubernetes services, Ray dashboards, Redis instances, and related cloud misconfigurations beginning in late 2025. Reference: [Cyble TeamPCP profile](https://cyble.com/threat-actor-profiles/teampcp/).",
      },
      {
        name: "CI/CD security tool supply chain compromise",
        year: "2026",
        description:
          "Four-wave March 2026 supply-chain campaign affecting Trivy, Checkmarx KICS/AST GitHub Actions, and LiteLLM, using stolen CI/CD credentials to cascade across developer tooling. Reference: [Cloud Security Alliance research note](https://labs.cloudsecurityalliance.org/research/csa-research-note-teampcp-cicd-supply-chain-20260325-csa-sty/).",
      },
      {
        name: "Telnyx PyPI compromise",
        year: "2026",
        description:
          "Malicious Telnyx Python package releases used a staged payload to collect and exfiltrate secrets, continuing TeamPCP's March 2026 open-source supply-chain campaign. Reference: [Akamai analysis](https://www.akamai.com/blog/security-research/2026/mar/telnyx-pypi-2026-teampcp-supply-chain-attacks).",
      },
    ],
    description:
      "TeamPCP is an emerging cloud-focused cybercriminal operation observed in late 2025 and 2026. Public reporting describes a shift from automated exploitation of exposed cloud-native infrastructure into cascading software supply-chain attacks against CI/CD and developer tooling, including Trivy, Checkmarx KICS/AST, LiteLLM, and Telnyx. The group is also tracked as DeadCatx3, PCPcat, PersyPCP, and ShellForce. References: [Cyble profile](https://cyble.com/threat-actor-profiles/teampcp/), [Cloud Security Alliance research note](https://labs.cloudsecurityalliance.org/research/csa-research-note-teampcp-cicd-supply-chain-20260325-csa-sty/), [Akamai analysis](https://www.akamai.com/blog/security-research/2026/mar/telnyx-pypi-2026-teampcp-supply-chain-attacks).",
    tagline: "Cloud exploitation scaled into CI/CD supply-chain compromise.",
    rarity: "LEGENDARY",
    sources: [
      {
        source: "manual",
        sourceId: "teampcp-curated-2026",
        fetchedAt: nowIso(),
        url: "https://cyble.com/threat-actor-profiles/teampcp/",
      },
    ],
    tlp: "WHITE",
  },
]

async function main(): Promise<void> {
  const logId = await logSyncStart("manual")
  let recordsSynced = 0

  try {
    for (const actor of CURATED_ACTORS) {
      const result = await upsertActorPreservingMedia({
        ...actor,
        lastUpdated: nowIso(),
      })

      if (result.error) {
        console.warn(`Curated upsert error for ${actor.canonicalName}:`, result.error)
      } else {
        recordsSynced++
      }
    }

    await logSyncComplete(logId, recordsSynced)
    console.log(`Curated sync complete — ${recordsSynced} actors upserted`)
  } catch (error) {
    await logSyncError(logId, String(error))
    throw error
  }
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
