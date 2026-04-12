import { NextResponse } from 'next/server'
import { addDraftNoteToContact, markContactDrafted } from '../../lib/attio'
import { sendDraftsToTelegram, type DraftEmail } from '../../lib/telegram'

// Draft emails stored as notes on each contact in Attio
// Note body format: "DRAFT|To: email|Name: full name|Company: company|Draft: email body"

export async function POST() {
  try {
    const drafts: DraftEmail[] = []
    const contactIds: string[] = []

    // Read all contacts with notes, parse draft notes
    const response = await fetch(
      `https://api.attio.com/v2/objects/people/records/query?limit=100`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${process.env.ATTIO_API_KEY}`,
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
      return NextResponse.json({ error: 'Failed to fetch contacts' }, { status: 500 })
    }

    const data = await response.json()
    const people = data.data || []

    for (const person of people) {
      const notes: any[] = person.values?.notes || []
      const draftNote = notes.find(
        (n: any) => n.body && n.body.startsWith('DRAFT|')
      )

      if (draftNote) {
        const parts = draftNote.body.split('|')
        const draftEmail: DraftEmail = {
          name: '',
          email: '',
          company: '',
          job_title: '',
          draft: '',
        }
        for (const part of parts) {
          const [key, ...rest] = part.split(':')
          const value = rest.join(':')
          if (key === 'To') draftEmail.email = value
          else if (key === 'Name') draftEmail.name = value
          else if (key === 'Company') draftEmail.company = value
          else if (key === 'Title') draftEmail.job_title = value
          else if (key === 'Draft') draftEmail.draft = value
        }
        if (draftEmail.email && draftEmail.draft) {
          drafts.push(draftEmail)
          contactIds.push(person.id.record_id)
        }
      }
    }

    if (drafts.length === 0) {
      return NextResponse.json(
        { error: 'No drafts found. Run the morning automation first.' },
        { status: 404 }
      )
    }

    // Send to Telegram
    await sendDraftsToTelegram(drafts)

    // Mark contacts as sent (add another note so they don't get reused)
    for (const recordId of contactIds) {
      await addDraftNoteToContact(recordId, '[SENT — DO NOT USE AGAIN]')
    }

    return NextResponse.json({ success: true, count: drafts.length })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
