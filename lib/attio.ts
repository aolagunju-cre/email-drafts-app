# Attio API Helpers

const ATTIO_API_KEY = process.env.ATTIO_API_KEY!
const ATTIO_WORKSPACE = 'ola-real-estate'

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

// Get all pending drafts from Attio (contacts with a DRAFT| note not yet marked SENT)
export async function getDraftsFromAttio(): Promise<DraftEmail[]> {
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
        filters: [],
        sort: [],
        limit: 100,
      }),
    }
  )

  if (!response.ok) {
    throw new Error(`Attio API error: ${response.status}`)
  }

  const data = await response.json()
  const people = data.data || []
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

// Fetch contacts that haven't been drafted yet
export async function getUndraftedContacts(limit = 10): Promise<AttioContact[]> {
  // First, query all people and filter by those without a "drafted" note
  // We use the notes attribute as a proxy for draft status
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
        filters: [],
        sort: [],
        limit: 100,
      }),
    }
  )

  if (!response.ok) {
    throw new Error(`Attio API error: ${response.status}`)
  }

  const data = await response.json()
  return (data.data || []).map((person: any) => {
    const name = person.values?.name?.[0]
    const emailEntry = person.values?.email_addresses?.[0]
    const companyRef = person.values?.company?.[0]
    const location = person.values?.primary_location?.[0]?.locality || ''

    return {
      record_id: person.id.record_id,
      name: name ? `${name.first_name || ''} ${name.last_name || ''}`.trim() : 'Unknown',
      email: emailEntry?.email_address || '',
      company: companyRef?.id || '',
      job_title: person.values?.job_title?.[0]?.value || '',
      location,
    }
  })
}

// Get the 10 most recently added contacts without drafts
export async function getTodaysContacts(limit = 10): Promise<AttioContact[]> {
  const allContacts = await getUndraftedContacts(100)
  // Filter out contacts without emails and return top N
  return allContacts.filter(c => c.email).slice(0, limit)
}

// Get contacts by IDs
export async function getContactsByIds(recordIds: string[]): Promise<AttioContact[]> {
  const response = await fetch(
    `https://api.attio.com/v2/objects/people/records/query`,
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
    throw new Error(`Attio API error: ${response.status}`)
  }

  const data = await response.json()
  return (data.data || []).map((person: any) => {
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

// Mark a contact as drafted by adding a tag or note
export async function markContactDrafted(recordId: string): Promise<void> {
  // We'll add a note that says "DRAFTED" so we can filter them out next time
  await addDraftNoteToContact(recordId, '[DRAFTED — DO NOT USE AGAIN]')
}
