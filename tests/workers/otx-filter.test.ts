import { describe, expect, it } from "vitest"
import {
  extractActorCandidate,
  isLikelyPollutedOtxActorName,
  looksLikeActorName,
} from "../../workers/shared/otx-filter"

describe("OTX actor-name filtering", () => {
  it("accepts common actor alias shapes", () => {
    expect(looksLikeActorName("APT28")).toBe(true)
    expect(looksLikeActorName("APT-C-36")).toBe(true)
    expect(looksLikeActorName("UNC5174")).toBe(true)
    expect(looksLikeActorName("UAT-9686")).toBe(true)
    expect(looksLikeActorName("Salt Typhoon")).toBe(true)
    expect(looksLikeActorName("Cloud Atlas")).toBe(true)
    expect(looksLikeActorName("MuddyWater")).toBe(true)
  })

  it("rejects article-title names that old OTX syncs inserted", () => {
    expect(looksLikeActorName("CoolClient backdoor updated, new data stealing tools used")).toBe(false)
    expect(looksLikeActorName("Chronology of MuddyWater APT Attacks Targeting the Middle East")).toBe(false)
    expect(looksLikeActorName("APT Group Expands Toolset With New GoGra Linux Backdoor")).toBe(false)
    expect(looksLikeActorName("Whispering in the dark")).toBe(false)
  })

  it("extracts actor aliases from tags before considering the title", () => {
    expect(
      extractActorCandidate({
        name: "Chronology of MuddyWater APT Attacks Targeting the Middle East",
        tags: ["apt", "threat-actor", "MuddyWater"],
      })
    ).toBe("MuddyWater")
  })

  it("does not infer actors from polluted article titles without a clean alias tag", () => {
    expect(
      extractActorCandidate({
        name: "CoolClient backdoor updated, new data stealing tools used",
        tags: ["apt", "threat-actor"],
      })
    ).toBeNull()

    expect(
      extractActorCandidate({
        name: "Chronology of MuddyWater APT Attacks Targeting the Middle East",
        tags: ["apt", "threat-actor"],
      })
    ).toBeNull()
  })

  it("uses the same predicate for conservative cleanup", () => {
    expect(isLikelyPollutedOtxActorName("CoolClient backdoor updated, new data stealing tools used")).toBe(true)
    expect(isLikelyPollutedOtxActorName("Salt Typhoon")).toBe(false)
  })
})
