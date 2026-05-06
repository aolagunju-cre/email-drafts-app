// Attio API Helpers

const ATTIO_API_KEY = process.env.ATTIO_API_KEY!
const PROSPECT_LIST_ID = '94f88d4f-4334-49a6-b514-a2ec366898ee'
const ATTIO_BASE_V2 = 'https://api.attio.com/v2'

export interface AttioContact {
  record_id: string
  name: string
  email: string
  company: string
  job_title: string
  location: string
  web_url: string
}

export interface DraftEmail {
  name: string
  email: string
  company: string
  job_title: string
  draft: string
  record_id: string
}

export interface UncontactedProspect {
  recordId: string
  name: string
  email: string
  title: string
  companyName: string
  phone: string
  location: string
  entryId: string
  calledToday: boolean
  hasVm: boolean
}

// ─────────────────────────────────────────────────────────────────────────────
// Helper: get boolean value from checkbox field
// Attio checkbox fields can be: {value: true/false} object, "yes"/"no" string, or boolean
// ─────────────────────────────────────────────────────────────────────────────
function getBoolVal(field: any[] | undefined): boolean {
  if (!field || field.length === 0) return false
  const item = field[0]
  if (typeof item === 'boolean') return item
  if (typeof item === 'object' && item !== null) return item.value === true
  if (typeof item === 'string') return item === 'yes'
  return false
}

// ─────────────────────────────────────────────────────────────────────────────
// Step 1: Fetch ALL Prospect List entries
// Note: Attio's boolean filter {call: false} is broken — returns all entries
// ─────────────────────────────────────────────────────────────────────────────
export async function getProspectListEntries(): Promise<any[]> {
  const response = await fetch(
    `https://api.attio.com/v2/lists/${PROSPECT_LIST_ID}/entries/query`,
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${ATTIO_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ limit: 200 }),
    }
  )
  if (!response.ok) throw new Error(`Attio List Entries API error: ${response.status}`)
  const data = await response.json()
  if (data.error) throw new Error(`Attio error: ${data.error.message}`)
  return data.data || []
}

// ─────────────────────────────────────────────────────────────────────────────
// Step 2: Fetch a single person record by ID
// ─────────────────────────────────────────────────────────────────────────────
async function getPerson(recordId: string): Promise<Record<string, any>> {
  const r = await fetch(
    `https://api.attio.com/v2/objects/people/records/${recordId}`,
    { headers: { Authorization: `Bearer ${ATTIO_API_KEY}` }, cache: 'no-store' }
  )
  if (!r.ok) return {}
  const d = await r.json()
  return d.data?.values || {}
}

async function getCompany(recordId: string): Promise<Record<string, any> | null> {
  try {
    const r = await fetch(
      `https://api.attio.com/v2/objects/companies/records/${recordId}`,
      { headers: { Authorization: `Bearer ${ATTIO_API_KEY}` }, cache: 'no-store' }
    )
    if (!r.ok) return null
    const d = await r.json()
    return d.data?.values || null
  } catch {
    return null
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Get contacts with NO outreach (email/call/vm/meeting checkboxes all false)
// Uses Prospect List entries + individual person lookups
// ─────────────────────────────────────────────────────────────────────────────
export async function getUndraftedContacts(limit = 10): Promise<AttioContact[]> {
  const allEntries = await getProspectListEntries()

  // Client-side filter: only entries where NO outreach checkbox is "yes"
  const unchecked = allEntries.filter((e: any) => {
    const ev = e.entry_values || {}
    const emailed = getBoolVal(ev.email)
    const called  = getBoolVal(ev.call)
    const vm      = getBoolVal(ev.voicemail)
    const met     = getBoolVal(ev.booked_meeting)
    return !emailed && !called && !vm && !met
  })

  const contacts: AttioContact[] = []
  for (const entry of unchecked) {
    if (contacts.length >= limit) break
    const rid = entry.parent_record_id
    if (!rid) continue

    const person = await getPerson(rid)
    const nameRef = person.name?.[0]
    const name = nameRef
      ? `${nameRef.first_name || ''} ${nameRef.last_name || ''}`.trim()
      : 'Unknown'
    const email = person.email_addresses?.[0]?.email_address || ''
    if (!email) continue

    contacts.push({
      record_id: rid,
      name,
      email,
      company: person.company?.[0]?.title || '',
      job_title: person.job_title?.[0]?.value || '',
      location: person.primary_location?.[0]?.locality || '',
      web_url: `https://app.attio.com/ola-real-estate/person/${rid}`,
    })
  }

  // Shuffle so each run shows different contacts
  return contacts.sort(() => Math.random() - 0.5)
}

export const getRandomContacts = getUndraftedContacts

// ─────────────────────────────────────────────────────────────────────────────
// Prospect List v2 — with entry IDs for writing back outreach status
// ─────────────────────────────────────────────────────────────────────────────
export async function getUncontactedProspectsV2(limit = 20): Promise<UncontactedProspect[]> {
  const allEntries = await getProspectListEntries()

  const unchecked = allEntries.filter((e: any) => {
    const ev = e.entry_values || {}
    const emailed = getBoolVal(ev.email)
    const called  = getBoolVal(ev.call)
    const vm      = getBoolVal(ev.voicemail)
    const met     = getBoolVal(ev.booked_meeting)
    return !emailed && !called && !vm && !met
  })

  const prospects: UncontactedProspect[] = []
  for (const entry of unchecked) {
    if (prospects.length >= limit) break
    const rid = entry.parent_record_id
    if (!rid) continue

    const person = await getPerson(rid)
    const nameRef = person.name?.[0]
    const name = nameRef ? `${nameRef.first_name || ''} ${nameRef.last_name || ''}`.trim() : ''
    const email = person.email_addresses?.[0]?.email_address || ''
    if (!email) continue

    const companyRef = person.company?.[0]
    let companyName = companyRef?.title || ''
    if (companyRef?.target_record_id && !companyName) {
      const co = await getCompany(companyRef.target_record_id)
      companyName = co?.name?.[0]?.value || ''
    }

    const ev = entry.entry_values || {}
    prospects.push({
      recordId: rid,
      name,
      email,
      title: person.job_title?.[0]?.value || '',
      companyName,
      phone: person.phone_numbers?.[0]?.phone_number || '',
      location: person.primary_location?.[0]?.locality || '',
      entryId: entry.id?.entry_id || '',
      calledToday: getBoolVal(ev.called_today),
      hasVm: getBoolVal(ev.voicemail),
    })
  }

  return prospects.sort(() => Math.random() - 0.5)
}

// ─────────────────────────────────────────────────────────────────────────────
// Write outreach status back to a Prospect List entry
// ─────────────────────────────────────────────────────────────────────────────
export async function markOutreach(entryId: string, type: 'email' | 'call' | 'voicemail' | 'booked_meeting') {
  const res = await fetch(`${ATTIO_BASE_V2}/lists/${PROSPECT_LIST_ID}/entries/${entryId}`, {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${ATTIO_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ data: { entry_values: { [type]: [{ value: true }] } } }),
  })
  if (!res.ok) throw new Error(`markOutreach failed: ${res.status} ${await res.text()}`)
  return res.json()
}

// ─────────────────────────────────────────────────────────────────────────────
// Draft note helpers (not used by generate route, kept for future use)
// ─────────────────────────────────────────────────────────────────────────────
export async function addDraftNoteToRecord(recordId: string, body: string): Promise<void> {
  const response = await fetch(
    `https://api.attio.com/v2/objects/people/records/${recordId}/notes`,
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${ATTIO_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ body }),
    }
  )
  if (!response.ok) throw new Error(`Attio note write error: ${response.status}`)
}

// Legacy wrapper for backward compatibility with tests
export async function getUncheckedEntryRecordIds(): Promise<string[]> {
  const entries = await getProspectListEntries()
  return entries.map((e: any) => e.parent_record_id)
}

// Legacy wrapper for backward compatibility
export async function getPeopleByRecordIds(recordIds: string[]): Promise<any[]> {
  const results: any[] = []
  for (const rid of recordIds) {
    try {
      const response = await fetch(
        `https://api.attio.com/v2/objects/people/records/${rid}`,
        { headers: { Authorization: `Bearer ${ATTIO_API_KEY}` }, cache: 'no-store' }
      )
      if (!response.ok) continue
      const d = await response.json()
      if (d.data) results.push(d.data)
    } catch {
      // skip
    }
  }
  return results
}
