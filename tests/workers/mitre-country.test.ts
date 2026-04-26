import { describe, expect, it } from "vitest"
import { inferCountryFromLabels } from "../../workers/mitre-sync"

describe("MITRE country inference", () => {
  it("uses attribution language instead of victim geographies", () => {
    expect(
      inferCountryFromLabels(
        [],
        "Kimsuky is a North Korea-based cyber espionage group targeting the United States, Japan, Russia, and Europe."
      )
    ).toEqual(["North Korea", "KP", false])

    expect(
      inferCountryFromLabels(
        [],
        "Mustang Panda is a China-based cyber espionage threat actor with notable activity in Russia, Mongolia, and Vietnam."
      )
    ).toEqual(["China", "CN", false])
  })

  it("does not infer origin from country mentions without attribution wording", () => {
    expect(
      inferCountryFromLabels(
        [],
        "This group has targeted government agencies in Russia, China, and the United States since 2020."
      )
    ).toEqual([undefined, undefined, false])
  })
})
