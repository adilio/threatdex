import { render, screen } from "@testing-library/react"
import { RarityBadge } from "~/components/RarityBadge"
import { describe, it, expect } from "vitest"

describe("RarityBadge", () => {
  it("renders MYTHIC badge", () => {
    render(<RarityBadge rarity="MYTHIC" />)
    expect(screen.getByText("MYTHIC")).toBeInTheDocument()
  })

  it("renders RARE badge", () => {
    render(<RarityBadge rarity="RARE" />)
    expect(screen.getByText("RARE")).toBeInTheDocument()
  })
})
