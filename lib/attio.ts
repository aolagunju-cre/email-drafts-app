// Attio API Helpers

const ATTIO_API_KEY = process.env.ATTIO_API_KEY!
const PROSPECT_LIST_ID = '94f88d4f-4334-49a6-b514-a2ec366898ee'

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

// ─────────────────────────────────────────────────────────────────────────────
// Step 1: Query list entries where Call, VM, Meeting, Email are ALL unchecked
// ─────────────────────────────────────────────────────────────────────────────
export async function getUncheckedEntryRecordIds(): Promise<string[]> {
  const response = await fetch(
    `https://api.attio.com/v2/lists/call_list/entries/query`,
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${ATTIO_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        filter: {
          call: false,
          voicemail: false,
          booked_meeting: false,
          email: false,
        },
        limit: 100,
      }),
    }
  )

  if (!response.ok) {
    throw new Error(`Attio List Entries API error: ${response.status}`)
  }

  const data = await response.json()
  if (data.error) {
    throw new Error(`Attio error: ${data.error.message}`)
  }

  const entries: any[] = data.data || []
  return entries.map((e: any) => e.parent_record_id)
}

// ─────────────────────────────────────────────────────────────────────────────
// Step 2: Batch-fetch person records by their record_ids
// ─────────────────────────────────────────────────────────────────────────────
export async function getPeopleByRecordIds(recordIds: string[]): Promise<any[]> {
  if (recordIds.length === 0) return []

  const response = await fetch(
    `https://api.attio.com/v2/objects/people/records/query?limit=${recordIds.length}`,
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${ATTIO_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        object: 'person',
        filters: [
          {
            attribute: 'record_id',
            filter: {
              type: 'any',
              value: recordIds,
            },
          },
        ],
        sort: [],
        limit: recordIds.length,
      }),
    }
  )

  if (!response.ok) {
    throw new Error(`Attio People API error: ${response.status}`)
  }

  const data = await response.json()
  return data.data || []
}

// ─────────────────────────────────────────────────────────────────────────────
// Step 3: Get prospects with NO activity (Call, VM, Meeting, Email all unchecked)
//         — shuffled randomly so each run shows different prospects
// ─────────────────────────────────────────────────────────────────────────────
export async function getUndraftedContacts(limit = 10): Promise<AttioContact[]> {
  // 1. Get record IDs of unchecked prospects from the list
  const recordIds = await getUncheckedEntryRecordIds()

  // 2. Fetch full person records for those IDs
  const people = await getPeopleByRecordIds(recordIds)

  // 3. Map to AttioContact shape
  const contacts = people
    .map((person: any) => {
      const name = person.values?.name?.[0]
      const emailEntry = person.values?.email_addresses?.[0]
      const companyRef = person.values?.company?.[0]
      const location = person.values?.primary_location?.[0]?.locality || ''
      const recordId = person.id.record_id

      return {
        record_id: recordId,
        name: name
          ? `${name.first_name || ''} ${name.last_name || ''}`.trim()
          : 'Unknown',
        email: emailEntry?.email_address || '',
        company: companyRef?.title || '',
        job_title: person.values?.job_title?.[0]?.value || '',
        location,
        web_url: `https://app.attio.com/ola-real-estate/person/${recordId}`,
      }
    })
    .filter((c: AttioContact) => c.email)
    .sort(() => Math.random() - 0.5) // shuffle so each run gets different contacts
    .slice(0, limit)

  return contacts
}

// Alias used by the contacts API route
export const getRandomContacts = getUndraftedContacts

// ─────────────────────────────────────────────────────────────────────────────
// Draft note helpers (not used by generate route, kept for future use)
// ─────────────────────────────────────────────────────────────────────────────
export async function addDraftNoteToRecord(
  recordId: string,
  body: string
): Promise<void> {
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
  if (!response.ok) {
    throw new Error(`Attio note write error: ${response.status}`)
  }
}
