import React from "react"
import { describe, it, expect } from "vitest"
import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import "@testing-library/jest-dom"
import type { ThreatActor } from "@threatdex/schema"
import { CardFront } from "../components/CardFront"
import { CardBack } from "../components/CardBack"
import { ThreatActorCard } from "../components/ThreatActorCard"
import { RarityBadge } from "../components/RarityBadge"
import { ThreatLevelBar } from "../components/ThreatLevelBar"

// ---------------------------------------------------------------------------
// Shared fixture
// ---------------------------------------------------------------------------

const mockActor: ThreatActor = {
  id: "apt28",
  canonicalName: "APT28",
  aliases: ["Fancy Bear", "Sofacy", "STRONTIUM"],
  mitreId: "G0007",
  country: "Russia",
  countryCode: "RU",
  motivation: ["espionage", "sabotage"],
  threatLevel: 9,
  sophistication: "Nation-State Elite",
  firstSeen: "2004",
  lastSeen: "2024",
  sectors: ["Government", "Defense", "Energy"],
  geographies: ["Europe", "United States", "Middle East"],
  tools: ["X-Agent", "X-Tunnel", "Zebrocy", "Mimikatz"],
  ttps: [
    {
      techniqueId: "T1566",
      techniqueName: "Phishing",
      tactic: "Initial Access",
    },
    {
      techniqueId: "T1078",
      techniqueName: "Valid Accounts",
      tactic: "Defense Evasion",
    },
  ],
  campaigns: [
    {
      name: "Operation Dragon Fire",
      year: "2023",
      description: "Targeted financial institutions in Southeast Asia.",
    },
  ],
  description:
    "APT28 is a threat group attributed to Russia's GRU intelligence directorate.",
  tagline: "Russia's premier cyber espionage unit.",
  rarity: "MYTHIC",
  imageUrl: undefined,
  sources: [
    {
      source: "mitre",
      sourceId: "G0007",
      fetchedAt: "2024-01-15T00:00:00.000Z",
      url: "https://attack.mitre.org/groups/G0007/",
    },
  ],
  tlp: "WHITE",
  lastUpdated: "2024-01-15T00:00:00.000Z",
}

// ---------------------------------------------------------------------------
// CardFront
// ---------------------------------------------------------------------------

describe("CardFront", () => {
  it("renders the actor canonical name", () => {
    render(<CardFront actor={mockActor} />)
    expect(screen.getByText("APT28")).toBeInTheDocument()
  })

  it("renders the rarity badge", () => {
    render(<CardFront actor={mockActor} />)
    // RarityBadge renders the rarity text; MYTHIC appears in header badge
    const mythicElements = screen.getAllByText("MYTHIC")
    expect(mythicElements.length).toBeGreaterThan(0)
  })

  it("renders the TLP badge", () => {
    render(<CardFront actor={mockActor} />)
    expect(screen.getByText("TLP:WHITE")).toBeInTheDocument()
  })

  it("renders the MITRE ID in the header", () => {
    render(<CardFront actor={mockActor} />)
    expect(screen.getByText("G0007")).toBeInTheDocument()
  })

  it("renders the actor tagline when provided", () => {
    render(<CardFront actor={mockActor} />)
    expect(
      screen.getByText("Russia's premier cyber espionage unit."),
    ).toBeInTheDocument()
  })

  it("renders up to 3 aliases", () => {
    render(<CardFront actor={mockActor} />)
    // The aliases text includes "aka Fancy Bear · Sofacy · STRONTIUM"
    const aliasText = screen.getByText(/Fancy Bear/)
    expect(aliasText).toBeInTheDocument()
  })

  it("renders the threat level bar container", () => {
    const { container } = render(<CardFront actor={mockActor} />)
    // ThreatLevelBar renders 10 segment divs
    const segments = container.querySelectorAll(
      'div[style*="border-radius: 2px"]',
    )
    expect(segments.length).toBeGreaterThanOrEqual(10)
  })

  it("renders motivation chips", () => {
    render(<CardFront actor={mockActor} />)
    expect(screen.getByText("espionage")).toBeInTheDocument()
    expect(screen.getByText("sabotage")).toBeInTheDocument()
  })

  it("renders the origin country", () => {
    render(<CardFront actor={mockActor} />)
    expect(screen.getByText(/Russia/)).toBeInTheDocument()
  })

  it("renders the active period", () => {
    render(<CardFront actor={mockActor} />)
    expect(screen.getByText("2004 – 2024")).toBeInTheDocument()
  })

  it("renders sophistication label", () => {
    render(<CardFront actor={mockActor} />)
    expect(screen.getByText("Nation-State Elite")).toBeInTheDocument()
  })

  it("renders a fallback placeholder when imageUrl is absent", () => {
    render(<CardFront actor={{ ...mockActor, imageUrl: undefined }} />)
    // Placeholder shows actor initials
    expect(screen.getByText("A")).toBeInTheDocument() // "APT28" → "A" + "2" initials split
  })

  it("renders an img element when imageUrl is provided", () => {
    const { container } = render(
      <CardFront
        actor={{ ...mockActor, imageUrl: "https://cdn.threatdex.io/apt28.png" }}
      />,
    )
    const img = container.querySelector("img")
    expect(img).not.toBeNull()
    expect(img?.getAttribute("src")).toBe("https://cdn.threatdex.io/apt28.png")
  })

  it("applies optional className prop", () => {
    const { container } = render(
      <CardFront actor={mockActor} className="custom-class" />,
    )
    expect(container.firstChild).toHaveClass("custom-class")
  })
})

// ---------------------------------------------------------------------------
// CardBack
// ---------------------------------------------------------------------------

describe("CardBack", () => {
  it("renders the actor canonical name in the header", () => {
    render(<CardBack actor={mockActor} />)
    expect(screen.getAllByText("APT28").length).toBeGreaterThan(0)
  })

  it("renders the THREAT INTELLIGENCE label", () => {
    render(<CardBack actor={mockActor} />)
    expect(screen.getByText(/Threat Intelligence/i)).toBeInTheDocument()
  })

  it("renders TTP technique IDs", () => {
    render(<CardBack actor={mockActor} />)
    expect(screen.getByText("T1566")).toBeInTheDocument()
    expect(screen.getByText("T1078")).toBeInTheDocument()
  })

  it("renders campaign name", () => {
    render(<CardBack actor={mockActor} />)
    expect(screen.getByText("Operation Dragon Fire")).toBeInTheDocument()
  })

  it("renders tool chips", () => {
    render(<CardBack actor={mockActor} />)
    expect(screen.getByText("X-Agent")).toBeInTheDocument()
    expect(screen.getByText("Mimikatz")).toBeInTheDocument()
  })

  it("renders source attribution", () => {
    render(<CardBack actor={mockActor} />)
    expect(screen.getByText("mitre")).toBeInTheDocument()
  })

  it("renders sector information", () => {
    render(<CardBack actor={mockActor} />)
    expect(screen.getByText(/Government/)).toBeInTheDocument()
  })

  it("renders geographic targets", () => {
    render(<CardBack actor={mockActor} />)
    expect(screen.getByText(/Europe/)).toBeInTheDocument()
  })
})

// ---------------------------------------------------------------------------
// ThreatActorCard (flip wrapper)
// ---------------------------------------------------------------------------

describe("ThreatActorCard", () => {
  it("renders the card front by default (uncontrolled)", () => {
    render(<ThreatActorCard actor={mockActor} />)
    // CardFront renders the canonical name visible in front
    expect(screen.getAllByText("APT28").length).toBeGreaterThan(0)
  })

  it("flips on click in uncontrolled mode", async () => {
    const user = userEvent.setup()
    const { container } = render(<ThreatActorCard actor={mockActor} />)
    const cardWrapper = container.firstChild as HTMLElement
    await user.click(cardWrapper)
    // After flip the inner container should have rotateY(180deg)
    const inner = cardWrapper.firstChild as HTMLElement
    expect(inner.style.transform).toContain("rotateY(180deg)")
  })

  it("calls onFlip callback when clicked in controlled mode", async () => {
    const user = userEvent.setup()
    let flipped = false
    const handleFlip = () => {
      flipped = true
    }
    const { container } = render(
      <ThreatActorCard actor={mockActor} flipped={false} onFlip={handleFlip} />,
    )
    const cardWrapper = container.firstChild as HTMLElement
    await user.click(cardWrapper)
    expect(flipped).toBe(true)
  })

  it("respects controlled flipped=true prop", () => {
    const { container } = render(
      <ThreatActorCard actor={mockActor} flipped={true} />,
    )
    const inner = (container.firstChild as HTMLElement).firstChild as HTMLElement
    expect(inner.style.transform).toContain("rotateY(180deg)")
  })

  it("is keyboard accessible via Enter key", async () => {
    const user = userEvent.setup()
    const { container } = render(<ThreatActorCard actor={mockActor} />)
    const cardWrapper = container.firstChild as HTMLElement
    cardWrapper.focus()
    await user.keyboard("{Enter}")
    const inner = cardWrapper.firstChild as HTMLElement
    expect(inner.style.transform).toContain("rotateY(180deg)")
  })
})

// ---------------------------------------------------------------------------
// RarityBadge
// ---------------------------------------------------------------------------

describe("RarityBadge", () => {
  it("renders MYTHIC text", () => {
    render(<RarityBadge rarity="MYTHIC" />)
    expect(screen.getByText("MYTHIC")).toBeInTheDocument()
  })

  it("renders LEGENDARY text", () => {
    render(<RarityBadge rarity="LEGENDARY" />)
    expect(screen.getByText("LEGENDARY")).toBeInTheDocument()
  })

  it("renders EPIC text", () => {
    render(<RarityBadge rarity="EPIC" />)
    expect(screen.getByText("EPIC")).toBeInTheDocument()
  })

  it("renders RARE text", () => {
    render(<RarityBadge rarity="RARE" />)
    expect(screen.getByText("RARE")).toBeInTheDocument()
  })

  it("applies MYTHIC yellow background", () => {
    const { container } = render(<RarityBadge rarity="MYTHIC" />)
    const badge = container.firstChild as HTMLElement
    expect(badge.style.background).toContain("#FFFF00")
  })

  it("applies LEGENDARY pink background", () => {
    const { container } = render(<RarityBadge rarity="LEGENDARY" />)
    const badge = container.firstChild as HTMLElement
    expect(badge.style.background).toContain("#FF0BBE")
  })

  it("accepts size prop without error", () => {
    expect(() => render(<RarityBadge rarity="RARE" size="lg" />)).not.toThrow()
  })
})

// ---------------------------------------------------------------------------
// ThreatLevelBar
// ---------------------------------------------------------------------------

describe("ThreatLevelBar", () => {
  it("renders 10 segments", () => {
    const { container } = render(<ThreatLevelBar level={5} />)
    const segments = container.querySelectorAll(
      'div[style*="border-radius: 2px"]',
    )
    expect(segments.length).toBe(10)
  })

  it("shows numeric label", () => {
    render(<ThreatLevelBar level={7} />)
    expect(screen.getByText("7/10")).toBeInTheDocument()
  })

  it("shows text label when showLabel is true", () => {
    render(<ThreatLevelBar level={9} showLabel={true} />)
    // Level 9 → "Catastrophic"
    expect(screen.getByText("Catastrophic")).toBeInTheDocument()
  })

  it("clamps level above 10 to 10", () => {
    render(<ThreatLevelBar level={15} />)
    expect(screen.getByText("10/10")).toBeInTheDocument()
  })

  it("clamps level below 1 to 1", () => {
    render(<ThreatLevelBar level={-5} />)
    expect(screen.getByText("1/10")).toBeInTheDocument()
  })
})
