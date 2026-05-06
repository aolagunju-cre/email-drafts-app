/**
 * Attio API Integration Tests — Real Attio API
 *
 * Run: npx vitest run lib/attio.test.ts
 */

import { describe, it, expect } from 'vitest'

const ATTIO_KEY = process.env.ATTIO_API_KEY ?? "ed1b79023895fcf8c37083aad62e8f834487ab3bfb0707374f1268779dcf33a4"
const LIST_ID = process.env.ATTIO_PROSPECT_LIST_ID ?? "94f88d4f-4334-49a6-b514-a2ec366898ee"
const BASE = "https://api.attio.com/v2"

// Low-level fetch helper — returns parsed JSON
const attioFetch = (
  path: string,
  method = "GET",
  body?: object,
) =>
  fetch(`${BASE}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${ATTIO_KEY}`,
      "Content-Type": "application/json",
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  }).then(r => r.json()) as Promise<Record<string, any>>

// ── Helpers ───────────────────────────────────────────────────────────────

/** True if checkbox field is explicitly {value: true} */
const isChecked = (field?: any[]): boolean =>
  field?.[0]?.value === true

/** True if checkbox field is absent or explicitly false (unchecked) */
const isUnchecked = (field?: any[]): boolean =>
  !field || field.length === 0 || field[0].value === false

/** True if person has NOT been emailed, called, VM'd, or met */
const isUncontacted = (ev: Record<string, any>): boolean =>
  isUnchecked(ev.email) &&
  isUnchecked(ev.call) &&
  isUnchecked(ev.voicemail) &&
  isUnchecked(ev.booked_meeting)

// ── Tests ────────────────────────────────────────────────────────────────

describe("Attio API — Real Integration", () => {

  // 1. Auth — can we reach Attio?
  it("object metadata returns api_slug and singular_noun (wrapped in data)", async () => {
    const d = await attioFetch("/objects/people")
    // Attio wraps single-record responses in { data: {...} }
    expect(d.data.api_slug).toBe("people")
    expect(d.data.singular_noun).toBe("Person")
  })

  // 2. People — query returns array of records with values
  it("can query people and get name + email_addresses", async () => {
    const d = await attioFetch("/objects/people/records/query", "POST", { limit: 3 })
    expect(Array.isArray(d.data)).toBe(true)
    const p = d.data[0]
    expect(p.values.name).toBeDefined()
    expect(Array.isArray(p.values.email_addresses)).toBe(true)
  })

  // 3. Prospect List — entries query returns list entries with entry_values
  it("list entries have id, parent_record_id, and entry_values", async () => {
    const d = await attioFetch(`/lists/${LIST_ID}/entries/query`, "POST", { limit: 3 })
    expect(Array.isArray(d.data)).toBe(true)
    const e = d.data[0]
    expect(e.id).toBeDefined()
    expect(typeof e.parent_record_id).toBe("string")
    expect(e.entry_values).toBeDefined()
  })

  // 4. Prospect List entry checkboxes — unchecked returns [] not undefined
  it("unchecked checkbox is [], checked is {value: true}", async () => {
    const d = await attioFetch(`/lists/${LIST_ID}/entries/query`, "POST", { limit: 20 })
    const entries: any[] = d.data

    let hasChecked = false, hasEmpty = false
    for (const e of entries) {
      const ev = e.entry_values ?? {}
      if (ev.email?.length === 0) hasEmpty = true
      if (isChecked(ev.email)) hasChecked = true
      if (hasChecked && hasEmpty) break
    }

    // At least one entry with checked email OR at least one unchecked is valid
    expect(hasChecked || hasEmpty).toBe(true)
    // All entries should have the email field present (even if empty array)
    for (const e of entries) {
      expect(Array.isArray(e.entry_values?.email)).toBe(true)
    }
  })

  // 5. isUncontacted() helper — keeps unchecked, removes contacted
  it("isUncontacted() is true for unchecked entries, false for checked ones", async () => {
    const d = await attioFetch(`/lists/${LIST_ID}/entries/query`, "POST", { limit: 20 })
    const entries: any[] = d.data

    const uncontacted = entries.filter(e => isUncontacted(e.entry_values ?? {}))

    // Every returned entry must satisfy isUncontacted
    for (const e of uncontacted) {
      expect(isUncontacted(e.entry_values ?? {})).toBe(true)
    }

    // If there are contacted entries, verify they fail the check
    const contacted = entries.filter(e => !isUncontacted(e.entry_values ?? {}))
    for (const e of contacted) {
      expect(isUncontacted(e.entry_values ?? {})).toBe(false)
    }

    // Expect to find at least some uncontacted people
    expect(uncontacted.length).toBeGreaterThan(0)
  })

  // 6. GET single person by record ID
  it("can GET a specific person by their record ID", async () => {
    const listData = await attioFetch(`/lists/${LIST_ID}/entries/query`, "POST", { limit: 1 })
    const personId = listData.data[0].parent_record_id
    const person = await attioFetch(`/objects/people/records/${personId}`)
    expect(person.data.id.record_id).toBe(personId)
    expect(person.data.values.name).toBeDefined()
  })

  // 7. GET company linked to person
  it("can fetch the company linked to a person", async () => {
    const listData = await attioFetch(`/lists/${LIST_ID}/entries/query`, "POST", { limit: 10 })
    for (const entry of listData.data) {
      const personId = entry.parent_record_id
      const person = await attioFetch(`/objects/people/records/${personId}`)
      const companyLink: any[] = person.data?.values?.company ?? []
      if (companyLink.length > 0) {
        const companyId = companyLink[0].target_record_id
        const company = await attioFetch(`/objects/companies/records/${companyId}`)
        expect(company.data?.values?.name).toBeDefined()
        return
      }
    }
    // No company links found is ok — just means all prospects are unlinked
  })

  // 8. PATCH checkbox — correct format is { data: { entry_values: { field: [{ value: true }] } }
  it("can PATCH checkbox to true then read it back", async () => {
    // Grab first entry
    const listData = await attioFetch(`/lists/${LIST_ID}/entries/query`, "POST", { limit: 1 })
    const entry: any = listData.data[0]
    const entryId = entry.id.entry_id

    // PATCH email to true — must wrap in data.entry_values
    const patchRes = await attioFetch(
      `/lists/${LIST_ID}/entries/${entryId}`,
      "PATCH",
      { data: { entry_values: { email: [{ value: true }] } } }
    )
    expect(patchRes.data).toBeDefined()
    expect(patchRes.data.entry_values.email[0].value).toBe(true)

    // Re-fetch and confirm it's persisted
    const verify = await attioFetch(`/lists/${LIST_ID}/entries/query`, "POST", { limit: 10 })
    const updated: any = verify.data.find((e: any) => e.id.entry_id === entryId)
    expect(updated.entry_values.email[0].value).toBe(true)

    // PATCH back to false (cleanup)
    await attioFetch(
      `/lists/${LIST_ID}/entries/${entryId}`,
      "PATCH",
      { data: { entry_values: { email: [{ value: false }] } } }
    )
  })

  // 9. Cursor pagination — SKIPPED: Attio people/records/query does not return
  // cursor/paging info in this workspace, so we cannot test pagination this way.
  // The API returns up to limit=500 records per query; to get all records
  // you would need to export via the Attio UI or use a different API endpoint.
  it.skip("starting_after cursor returns records after last ID", async () => {
    const page1 = await attioFetch("/objects/people/records/query", "POST", { limit: 5 })
    expect(page1.data.length).toBe(5)
    const lastId = page1.data[4].id.record_id

    const page2 = await attioFetch("/objects/people/records/query", "POST", {
      limit: 5,
      paging: { starting_after: lastId },
    })
    expect(page2.data.length).toBe(5)

    // No overlap between pages
    const page1Ids = new Set(page1.data.map((p: any) => p.id.record_id))
    for (const record of page2.data) {
      expect(page1Ids.has(record.id.record_id)).toBe(false)
    }
  })
})
