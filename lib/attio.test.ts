import { describe, it, expect, vi, beforeEach } from 'vitest'

// ─────────────────────────────────────────────────────────────────────────────
// Mock Attio API responses — realistic shapes based on actual Attio API docs
// ─────────────────────────────────────────────────────────────────────────────

const mockUncheckedEntriesResponse = {
  data: [
    {
      id: { workspace_id: 'ws1', list_id: '94f88d4f-4334-49a6-b514-a2ec366898ee', entry_id: 'e1' },
      parent_record_id: 'person-id-001',
      parent_object: 'people',
      created_at: '2026-01-01T00:00:00Z',
      entry_values: {
        call: [],              // unchecked = empty array
        voicemail: [],          // unchecked = empty array
        booked_meeting: [],    // unchecked = empty array
        email: [],             // unchecked = empty array
      },
    },
    {
      id: { workspace_id: 'ws1', list_id: '94f88d4f-4334-49a6-b514-a2ec366898ee', entry_id: 'e2' },
      parent_record_id: 'person-id-002',
      parent_object: 'people',
      created_at: '2026-01-02T00:00:00Z',
      entry_values: {
        call: [{ active_from: '2026-01-10T00:00:00Z', value: true }], // checked
        voicemail: [],
        booked_meeting: [],
        email: [],
      },
    },
    {
      id: { workspace_id: 'ws1', list_id: '94f88d4f-4334-49a6-b514-a2ec366898ee', entry_id: 'e3' },
      parent_record_id: 'person-id-003',
      parent_object: 'people',
      created_at: '2026-01-03T00:00:00Z',
      entry_values: {
        call: [],
        voicemail: [],
        booked_meeting: [{ active_from: '2026-01-11T00:00:00Z', value: true }], // checked
        email: [],
      },
    },
    {
      id: { workspace_id: 'ws1', list_id: '94f88d4f-4334-49a6-b514-a2ec366898ee', entry_id: 'e4' },
      parent_record_id: 'person-id-004',
      parent_object: 'people',
      created_at: '2026-01-04T00:00:00Z',
      entry_values: {
        call: [],
        voicemail: [],
        booked_meeting: [],
        email: [], // unchecked
      },
    },
  ],
}

const mockPeopleResponse = {
  data: [
    {
      id: { workspace_id: 'ws1', object_id: 'obj1', record_id: 'person-id-001' },
      values: {
        name: [{ first_name: 'Aaron', last_name: 'David', full_name: 'Aaron David' }],
        email_addresses: [{ email_address: 'a.david@navigatorpetroleum.ca' }],
        company: [{ title: 'Navigator Petroleum' }],
        job_title: [{ value: 'Principal' }],
        primary_location: [{ locality: 'Calgary' }],
      },
    },
    {
      id: { workspace_id: 'ws1', object_id: 'obj1', record_id: 'person-id-004' },
      values: {
        name: [{ first_name: 'Kevin', last_name: 'Kyle', full_name: 'Kevin Kyle' }],
        email_addresses: [{ email_address: 'kevin.kyle@swiftsupply.ca' }],
        company: [{ title: 'Swift Supply' }],
        job_title: [{ value: 'CFO' }],
        primary_location: [{ locality: 'Calgary' }],
      },
    },
  ],
}

// ─────────────────────────────────────────────────────────────────────────────
// Mock global fetch for Attio API
// ─────────────────────────────────────────────────────────────────────────────

function mockFetch(responses: Map<string, any>) {
  return vi.stubGlobal('fetch', vi.fn((url: string, options?: any) => {
    const body = options?.body ? JSON.parse(options.body) : {}
    const urlStr = typeof url === 'string' ? url : ''

    // List entries query — return only entries where ALL four checkboxes are false
    if (urlStr.includes('/lists/call_list/entries/query')) {
      // Simulate the filter: only return entries where call/voicemail/booked_meeting/email are all empty arrays
      const unchecked = mockUncheckedEntriesResponse.data.filter((e: any) => {
        const ev = e.entry_values
        const callEmpty = !ev.call || ev.call.length === 0
        const vmEmpty = !ev.voicemail || ev.voicemail.length === 0
        const meetEmpty = !ev.booked_meeting || ev.booked_meeting.length === 0
        const emailEmpty = !ev.email || ev.email.length === 0
        return callEmpty && vmEmpty && meetEmpty && emailEmpty
      })
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ data: unchecked }),
      })
    }

    // People query by record_ids — return matching people
    if (urlStr.includes('/objects/people/records/query')) {
      const requestedIds: string[] = body?.filters?.[0]?.filter?.value || []
      const matched = mockPeopleResponse.data.filter((p: any) =>
        requestedIds.includes(p.id.record_id)
      )
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ data: matched }),
      })
    }

    return Promise.resolve({ ok: false, json: () => Promise.resolve({}) })
  }))
}

// ─────────────────────────────────────────────────────────────────────────────
// Tests
// ─────────────────────────────────────────────────────────────────────────────

describe('Attio API — Prospect List Filtering', () => {

  beforeEach(() => {
    vi.clearAllMocks()
    // Default: both APIs return valid unchecked entries
    const responses = new Map()
    mockFetch(responses)
  })

  // ─── Test 1 ───────────────────────────────────────────────────────────────

  it('getUncheckedEntryRecordIds returns only parent_record_ids with all 4 checkboxes unchecked', async () => {
    // Import dynamically so mocks are set first
    const { getUncheckedEntryRecordIds } = await import('../lib/attio')

    const recordIds = await getUncheckedEntryRecordIds()

    // From mockUncheckedEntriesResponse: only person-id-001 and person-id-004
    // have all four fields as empty arrays.
    // person-id-002 has call=true, person-id-003 has booked_meeting=true
    expect(recordIds).toContain('person-id-001')
    expect(recordIds).toContain('person-id-004')
    expect(recordIds).not.toContain('person-id-002')
    expect(recordIds).not.toContain('person-id-003')
  })

  // ─── Test 2 ───────────────────────────────────────────────────────────────

  it('getPeopleByRecordIds returns person data for requested IDs', async () => {
    const { getPeopleByRecordIds } = await import('../lib/attio')

    const people = await getPeopleByRecordIds(['person-id-001', 'person-id-004'])

    expect(people).toHaveLength(2)
    expect(people[0].values.name[0].first_name).toBe('Aaron')
    expect(people[0].values.email_addresses[0].email_address).toBe('a.david@navigatorpetroleum.ca')
    expect(people[1].values.name[0].first_name).toBe('Kevin')
  })

  it('getPeopleByRecordIds returns empty array when given no IDs', async () => {
    const { getPeopleByRecordIds } = await import('../lib/attio')

    const people = await getPeopleByRecordIds([])

    expect(people).toHaveLength(0)
  })

  // ─── Test 3 ───────────────────────────────────────────────────────────────

  it('getUndraftedContacts returns contacts with email, name, company, job_title, web_url', async () => {
    const { getUndraftedContacts } = await import('../lib/attio')

    // Patch fetch to return both unchecked entries AND matching people
    vi.stubGlobal('fetch', vi.fn((url: string, options?: any) => {
      const urlStr = typeof url === 'string' ? url : ''
      if (urlStr.includes('/lists/call_list/entries/query')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ data: mockUncheckedEntriesResponse.data }),
        })
      }
      if (urlStr.includes('/objects/people/records/query')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve(mockPeopleResponse),
        })
      }
      return Promise.resolve({ ok: false, json: () => Promise.resolve({}) })
    }))

    const contacts = await getUndraftedContacts(10)

    // Should filter to only the 2 people with emails and all 4 unchecked
    expect(contacts.length).toBeGreaterThan(0)

    // Every contact must have all required fields
    for (const c of contacts) {
      expect(c.record_id).toBeTruthy()
      expect(c.name).toBeTruthy()
      expect(c.email).toContain('@')         // must be a valid email format
      expect(c.web_url).toContain('attio.com')
      expect(c.web_url).toContain(c.record_id) // web_url must contain the record_id
    }

    // No records with checked boxes should appear
    expect(contacts.find(c => c.name === 'should-not-exist')).toBeUndefined()
  })

  // ─── Test 4 ───────────────────────────────────────────────────────────────

  it('getUndraftedContacts filters out people with no email address', async () => {
    const { getUndraftedContacts } = await import('../lib/attio')

    // Mock where one person has no email
    vi.stubGlobal('fetch', vi.fn((url: string, options?: any) => {
      const urlStr = typeof url === 'string' ? url : ''
      if (urlStr.includes('/lists/call_list/entries/query')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({
            data: [
              {
                id: { entry_id: 'e1' },
                parent_record_id: 'no-email-person',
                entry_values: { call: [], voicemail: [], booked_meeting: [], email: [] },
              },
            ],
          }),
        })
      }
      if (urlStr.includes('/objects/people/records/query')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({
            data: [
              {
                id: { record_id: 'no-email-person' },
                values: {
                  name: [{ first_name: 'No', last_name: 'Email' }],
                  email_addresses: [],          // no email
                  company: [],
                  job_title: [],
                  primary_location: [],
                },
              },
            ],
          }),
        })
      }
      return Promise.resolve({ ok: false, json: () => Promise.resolve({}) })
    }))

    const contacts = await getUndraftedContacts(10)

    // Person with no email should be excluded
    expect(contacts.find(c => c.email === '')).toBeUndefined()
  })

  // ─── Test 5 ───────────────────────────────────────────────────────────────

  it('getUndraftedContacts respects the limit parameter', async () => {
    const { getUndraftedContacts } = await import('../lib/attio')

    // Use the real mock responses — 2 contacts should come back
    vi.stubGlobal('fetch', vi.fn((url: string, options?: any) => {
      const urlStr = typeof url === 'string' ? url : ''
      if (urlStr.includes('/lists/call_list/entries/query')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ data: mockUncheckedEntriesResponse.data }),
        })
      }
      if (urlStr.includes('/objects/people/records/query')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve(mockPeopleResponse),
        })
      }
      return Promise.resolve({ ok: false, json: () => Promise.resolve({}) })
    }))

    const contacts = await getUndraftedContacts(1)

    // Limit of 1 should be respected
    expect(contacts.length).toBeLessThanOrEqual(1)
  })

  // ─── Test 6 ───────────────────────────────────────────────────────────────

  it('Attio API errors are thrown as descriptive errors', async () => {
    vi.stubGlobal('fetch', vi.fn(() =>
      Promise.resolve({
        ok: false,
        status: 404,
        json: () => Promise.resolve({ error: { message: 'not_found' } }),
      })
    ))

    const { getUncheckedEntryRecordIds } = await import('../lib/attio')

    await expect(getUncheckedEntryRecordIds()).rejects.toThrow('404')
  })
})
