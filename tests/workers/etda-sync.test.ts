import { describe, expect, it } from "vitest"
import { parseActorPage, parseGroupList } from "../../workers/etda-sync"

const actorHtml = `
<!DOCTYPE html>
<html>
  <head><title>Aggah - Threat Group Cards: A Threat Actor Encyclopedia</title></head>
  <body>
    <h1>Threat Group Cards: A Threat Actor Encyclopedia</h1>
    <h3>APT group: Aggah</h3>
    <table>
      <tr><td class="tshaded">Names</td><td>Aggah <i>(Palo Alto)</i></td></tr>
      <tr><td class="tshaded">Country</td><td>[Unknown]</td></tr>
      <tr><td class="tshaded">Motivation</td><td>Information theft and espionage, Financial gain</td></tr>
      <tr><td class="tshaded">First seen</td><td>2018</td></tr>
      <tr><td class="tshaded">Description</td><td>In March 2019, Unit 42 began looking into an attack campaign across the United States, Europe, and Asia.</td></tr>
      <tr><td class="tshaded">Observed</td><td>Sectors: Automotive, Government.<br />Countries: United States, China, Russia.</td></tr>
      <tr><td class="tshaded">Tools used</td><td>Agent Tesla, RevengeRAT.</td></tr>
    </table>
  </body>
</html>
`

describe("ETDA sync parsing", () => {
  it("parses only real card links from the group list", () => {
    const html = `
      <a href="/cgi-bin/listgroups.cgi">Groups</a>
      <a href="/cgi-bin/showcard.cgi?g=APT%2041&n=1" title="Show the card for APT 41">APT 41</a>
      <a href="/cgi-bin/showcard.cgi?g=APT%2041&n=1" title="Show the card for APT 41">APT 41 duplicate</a>
    `

    expect(parseGroupList(html)).toEqual(["APT 41"])
  })

  it("does not use the generic site h1 as the actor name", () => {
    const actor = parseActorPage(actorHtml, "Aggah")

    expect(actor?.canonicalName).toBe("Aggah")
    expect(actor?.id).toBe("aggah")
    expect(actor?.description).toContain("Unit 42")
  })

  it("does not infer origin from observed victim geographies", () => {
    const actor = parseActorPage(actorHtml, "Aggah")

    expect(actor?.country).toBeUndefined()
    expect(actor?.countryCode).toBeUndefined()
  })

  it("rejects the ETDA aggregate list page as an actor", () => {
    const aggregateHtml = `
      <title>All groups - Threat Group Cards: A Threat Actor Encyclopedia</title>
      <h1>Threat Group Cards: A Threat Actor Encyclopedia</h1>
    `

    expect(parseActorPage(aggregateHtml, "listgroups")).toBeNull()
  })
})
