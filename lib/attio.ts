// Attio API Helpers

const ATTIO_API_KEY = process.env.ATTIO_API_KEY!

// The Prospect List to pull contacts from
const PROSPECT_LIST_ID = process.env.ATTIO_PROSPECT_LIST_ID || '94f88d4f-4334-49a6-b514-a2ec366898ee'

export interface AttioContact {
  record_id: string
  name: string
  email: string
  company: string
  job_title: string
  location: string
}

export interface DraftEmail {
  name: string
  email: string
  company: string
  job_title: string
  draft: string
  record_id: string
}

// Parse draft note from contact
function parseDraftNote(body: string): DraftEmail | null {
  if (!body.startsWith('DRAFT|')) return null
  const parts = body.split('|')
  const draft: Partial<DraftEmail> = {}
  for (const part of parts) {
    const [key, ...rest] = part.split(':')
    const value = rest.join(':')
    if (key === 'To') draft.email = value
    else if (key === 'Name') draft.name = value
    else if (key === 'Company') draft.company = value
    else if (key === 'Title') draft.job_title = value
    else if (key === 'Draft') draft.draft = value
  }
  if (!draft.email || !draft.draft) return null
  return draft as DraftEmail
}

// Fetch contacts from the Prospect List only via the objects query API
async function getContactsFromProspectList(): Promise<any[]> {
  const response = await fetch(
    `https://api.attio.com/v2/objects/people/records/query?limit=100`,
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
            attribute: 'lists',
            filter: {
              type: 'any',
              value: [PROSPECT_LIST_ID],
            },
          },
        ],
        sort: [],
        limit: 100,
      }),
    }
  )

  if (!response.ok) {
    throw new Error(`Attio API error: ${response.status}`)
  }

  const data = await response.json()
  return data.data || []
}

// Get all pending drafts from Attio (contacts in Prospect List with a DRAFT| note not yet marked SENT)
export async function getDraftsFromAttio(): Promise<DraftEmail[]> {
  const people = await getContactsFromProspectList()
  const drafts: DraftEmail[] = []

  for (const person of people) {
    const notes: any[] = person.values?.notes || []
    const draftNote = notes.find((n: any) => n.body?.startsWith('DRAFT|'))
    const alreadySent = notes.some((n: any) => n.body?.startsWith('[SENT'))

    if (draftNote && !alreadySent) {
      const draft = parseDraftNote(draftNote.body)
      if (draft) {
        draft.record_id = person.id.record_id
        drafts.push(draft)
      }
    }
  }

  return drafts
}

// Fetch contacts from Prospect List that haven't been drafted yet
export async function getUndraftedContacts(limit = 10): Promise<AttioContact[]> {
  const people = await getContactsFromProspectList()

  // Filter out contacts that already have a [DRAFTED] or [SENT] note
  const undrafted = people.filter((person: any) => {
    const notes: any[] = person.values?.notes || []
    const hasDrafted = notes.some(
      (n: any) => n.body?.startsWith('[DRAFTED') || n.body?.startsWith('[SENT')
    )
    return !hasDrafted
  })

  return undrafted
    .map((person: any) => {
      const name = person.values?.name?.[0]
      const emailEntry = person.values?.email_addresses?.[0]
      const companyRef = person.values?.company?.[0]
      const location = person.values?.primary_location?.[0]?.locality || ''

      return {
        record_id: person.id.record_id,
        name: name ? `${name.first_name || ''} ${name.last_name || ''}`.trim() : 'Unknown',
        email: emailEntry?.email_address || '',
        company: companyRef?.title || '',
        job_title: person.values?.job_title?.[0]?.value || '',
        location,
      }
    })
    .filter((c: AttioContact) => c.email)
    .sort(() => Math.random() - 0.5) // shuffle so each run gets different contacts
    .slice(0, limit)
}

// Get the 10 most recently added contacts without drafts from Prospect List
export async function getTodaysContacts(limit = 10): Promise<AttioContact[]> {
  return getUndraftedContacts(limit)
}

// Add a note (draft email) to a contact record
export async function addDraftNoteToContact(
  recordId: string,
  draftEmail: string
): Promise<void> {
  const response = await fetch(
    `https://api.attio.com/v2/objects/people/records/${recordId}/notes`,
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${ATTIO_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        body: draftEmail,
      }),
    }
  )

  if (!response.ok) {
    throw new Error(`Attio note write error: ${response.status}`)
  }
}

// Mark a contact as drafted
export async function markContactDrafted(recordId: string): Promise<void> {
  await addDraftNoteToContact(recordId, '[DRAFTED — DO NOT USE AGAIN]')
}

// Alias for getTodaysContacts (used by the contacts API route)
export const getRandomContacts = getTodaysContacts
