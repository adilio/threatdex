/**
 * Tests for upsert merge guarantees.
 *
 * These tests verify that the upsertActorPreservingMedia function correctly
 * preserves existing data when merging, especially for media fields and
 * accumulated data like sources, TTPs, and campaigns.
 */

import { describe, it, expect, vi, beforeEach } from "vitest"
import { upsertActorPreservingMedia } from "../../workers/shared/upsert"
import { mergeActors } from "../../workers/shared/dedup"
import type { ThreatActorData } from "../../workers/shared/models"

// Mock supabase client
const mockSupabase: any = {
  from: vi.fn(() => mockSupabase),
  select: vi.fn(() => mockSupabase),
  eq: vi.fn(() => mockSupabase),
  maybeSingle: vi.fn(() => mockSupabase),
  single: vi.fn(() => mockSupabase),
  upsert: vi.fn(() => ({ error: null })),
}

vi.mock("../../workers/shared/supabase", () => ({
  getSupabase: () => mockSupabase,
}))

vi.mock("../../workers/shared/dedup", async () => {
  const actual = await vi.importActual("../../workers/shared/dedup")
  return {
    ...actual,
    findMatchingActor: async () => null,
  }
})

describe("upsert merge guarantees", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe("upsertActorPreservingMedia", () => {
    it("preserves image_url when same-ID actor is re-synced without an image", async () => {
      const existingRow = {
        id: "test-actor",
        canonical_name: "Test Actor",
        image_url: "https://example.com/test-actor.png",
        image_prompt: "A test actor image",
        sources: [{ source: "mitre", fetched_at: "2024-01-01T00:00:00Z" }],
      }

      mockSupabase.maybeSingle = vi.fn(() => ({ data: existingRow, error: null }))
      mockSupabase.upsert = vi.fn(() => ({ error: null }))

      const incoming: ThreatActorData = {
        id: "test-actor",
        canonicalName: "Test Actor",
        aliases: [],
        motivation: ["espionage"],
        threatLevel: 7,
        sophistication: "High",
        sources: [{ source: "etda", sourceId: "test", fetchedAt: "2024-01-02T00:00:00Z" }],
        ttps: [],
        campaigns: [],
        tools: [],
        sectors: [],
        geographies: [],
        description: "Updated description",
        rarity: "EPIC",
        tlp: "WHITE",
        lastUpdated: new Date().toISOString(),
      }

      const result = await upsertActorPreservingMedia(incoming)

      expect(result.error).toBeNull()
      expect(result.merged).toBe(true)
      expect(result.id).toBe("test-actor")

      // Verify upsert was called with preserved image_url
      const upsertCall = mockSupabase.upsert.mock.calls[0]
      const upsertData = upsertCall[0]
      expect(upsertData.image_url).toBe(existingRow.image_url)
    })

    it("preserves image_curated SANDWORM through full intel re-sync", async () => {
      const existingRow = {
        id: "sandworm",
        canonical_name: "SANDWORM",
        image_url: "https://example.com/sandworm.png",
        image_prompt: "Sandworm image",
        image_curated: true,
        sources: [{ source: "manual", fetched_at: "2024-01-01T00:00:00Z" }],
      }

      mockSupabase.maybeSingle = vi.fn(() => ({ data: existingRow, error: null }))
      mockSupabase.upsert = vi.fn(() => ({ error: null }))

      const incoming: ThreatActorData = {
        id: "sandworm",
        canonicalName: "SANDWORM",
        aliases: [],
        motivation: ["sabotage"],
        threatLevel: 9,
        sophistication: "Nation-State Elite",
        sources: [{ source: "mitre", sourceId: "G0016", fetchedAt: "2024-01-02T00:00:00Z" }],
        ttps: [],
        campaigns: [],
        tools: [],
        sectors: [],
        geographies: [],
        description: "Updated description",
        rarity: "MYTHIC",
        tlp: "WHITE",
        lastUpdated: new Date().toISOString(),
      }

      const result = await upsertActorPreservingMedia(incoming)

      expect(result.error).toBeNull()
      expect(result.merged).toBe(true)

      const upsertCall = mockSupabase.upsert.mock.calls[0]
      const upsertData = upsertCall[0]
      expect(upsertData.image_url).toBe(existingRow.image_url)
      expect(upsertData.image_curated).toBe(true)
    })

    it("merges TTPs from incoming into existing without dropping either set", async () => {
      const existingRow = {
        id: "test-actor",
        canonical_name: "Test Actor",
        ttps: [
          { technique_id: "T1566", technique_name: "Phishing", tactic: "initial-access" },
          { technique_id: "T1059", technique_name: "Command-Line", tactic: "execution" },
        ],
        sources: [{ source: "mitre", fetched_at: "2024-01-01T00:00:00Z" }],
      }

      mockSupabase.maybeSingle = vi.fn(() => ({ data: existingRow, error: null }))
      mockSupabase.upsert = vi.fn(() => ({ error: null }))

      const incoming: ThreatActorData = {
        id: "test-actor",
        canonicalName: "Test Actor",
        aliases: [],
        motivation: ["espionage"],
        threatLevel: 7,
        sophistication: "High",
        ttps: [
          { techniqueId: "T1059", techniqueName: "Command-Line", tactic: "execution" },
          { techniqueId: "T1190", techniqueName: "Exploit Public-Facing", tactic: "initial-access" },
        ],
        campaigns: [],
        tools: [],
        sectors: [],
        geographies: [],
        sources: [{ source: "etda", sourceId: "test", fetchedAt: "2024-01-02T00:00:00Z" }],
        description: "Updated",
        rarity: "EPIC",
        tlp: "WHITE",
        lastUpdated: new Date().toISOString(),
      }

      await upsertActorPreservingMedia(incoming)

      const upsertCall = mockSupabase.upsert.mock.calls[0]
      const upsertData = upsertCall[0]
      expect(upsertData.ttps).toHaveLength(3) // T1566, T1059, T1190
    })

    it("preserves ETDA sources[] when MITRE re-syncs the same actor", async () => {
      const existingRow = {
        id: "apt28",
        canonical_name: "APT28",
        sources: [
          { source: "etda", source_id: "apt28", fetched_at: "2024-01-01T00:00:00Z", url: "https://etda.example.com/apt28" },
        ],
      }

      mockSupabase.maybeSingle = vi.fn(() => ({ data: existingRow, error: null }))
      mockSupabase.upsert = vi.fn(() => ({ error: null }))

      const incoming: ThreatActorData = {
        id: "apt28",
        canonicalName: "APT28",
        aliases: [],
        motivation: ["espionage"],
        threatLevel: 8,
        sophistication: "Very High",
        ttps: [],
        campaigns: [],
        tools: [],
        sectors: [],
        geographies: [],
        sources: [
          { source: "mitre", sourceId: "G0007", fetchedAt: "2024-01-02T00:00:00Z", url: "https://attack.mitre.org/groups/G0007/" },
        ],
        description: "Russian threat actor",
        rarity: "LEGENDARY",
        tlp: "WHITE",
        lastUpdated: new Date().toISOString(),
      }

      await upsertActorPreservingMedia(incoming)

      const upsertCall = mockSupabase.upsert.mock.calls[0]
      const upsertData = upsertCall[0]
      expect(upsertData.sources).toHaveLength(2)
      expect(upsertData.sources.some((s: { source: string }) => s.source === "etda")).toBe(true)
      expect(upsertData.sources.some((s: { source: string }) => s.source === "mitre")).toBe(true)
    })
  })

  describe("mergeActors", () => {
    it("preserves existing image_url when incoming has none", () => {
      const existing: Record<string, unknown> = {
        id: "test",
        canonical_name: "Test",
        image_url: "https://example.com/test.png",
        image_prompt: "Test image",
        ttps: [],
        campaigns: [],
        sources: [],
        aliases: [],
        motivation: [],
        sectors: [],
        geographies: [],
        tools: [],
      }

      const incoming: ThreatActorData = {
        id: "test",
        canonicalName: "Test",
        aliases: [],
        motivation: ["espionage"],
        threatLevel: 5,
        sophistication: "Medium",
        ttps: [],
        campaigns: [],
        tools: [],
        sectors: [],
        geographies: [],
        sources: [{ source: "mitre", fetchedAt: "2024-01-01T00:00:00Z" }],
        description: "Test",
        rarity: "RARE",
        tlp: "WHITE",
        lastUpdated: new Date().toISOString(),
      }

      const merged = mergeActors(existing, incoming)
      expect(merged.imageUrl).toBe("https://example.com/test.png")
      expect(merged.imagePrompt).toBe("Test image")
    })

    it("takes new image_url when incoming has one and existing does not", () => {
      const existing: Record<string, unknown> = {
        id: "test",
        canonical_name: "Test",
        ttps: [],
        campaigns: [],
        sources: [],
        aliases: [],
        motivation: [],
        sectors: [],
        geographies: [],
        tools: [],
      }

      const incoming: ThreatActorData = {
        id: "test",
        canonicalName: "Test",
        aliases: [],
        motivation: ["espionage"],
        threatLevel: 5,
        sophistication: "Medium",
        imageUrl: "https://example.com/new-test.png",
        imagePrompt: "New test image",
        ttps: [],
        campaigns: [],
        tools: [],
        sectors: [],
        geographies: [],
        sources: [{ source: "mitre", fetchedAt: "2024-01-01T00:00:00Z" }],
        description: "Test",
        rarity: "RARE",
        tlp: "WHITE",
        lastUpdated: new Date().toISOString(),
      }

      const merged = mergeActors(existing, incoming)
      expect(merged.imageUrl).toBe("https://example.com/new-test.png")
      expect(merged.imagePrompt).toBe("New test image")
    })
  })
})
