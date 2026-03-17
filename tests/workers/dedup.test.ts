import { describe, it, expect } from "vitest"
import { normalizeName } from "../../workers/shared/dedup"

describe("normalizeName", () => {
  it("strips APT prefix", () => {
    expect(normalizeName("APT28")).toBe("28")
  })

  it("lowercases and strips punctuation", () => {
    expect(normalizeName("Fancy Bear!")).toBe("fancy bear")
  })

  it("handles unicode normalization", () => {
    expect(normalizeName("APT 28")).toBe("28")
  })
})
