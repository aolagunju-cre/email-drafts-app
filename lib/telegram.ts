// Telegram notification helper
// Sends a message to the configured Telegram chat

const TG_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN!
const TG_CHAT_ID = process.env.TELEGRAM_CHAT_ID!

export interface DraftEmail {
  name: string
  email: string
  company: string
  job_title: string
  draft: string
}

export async function sendDraftsToTelegram(drafts: DraftEmail[]): Promise<void> {
  const lines = drafts.map((d, i) => {
    return `📬 Email ${i + 1}\n${'─'.repeat(30)}\nTo: ${d.name} | ${d.email}\nCompany: ${d.company}\n${'─'.repeat(30)}\n${d.draft}`
  })

  const message = [`📤 *10 Cold Email Drafts — Ready to Send*\n${'━'.repeat(30)}`, ...lines, `'━'.repeat(30)}\n_${drafts.length} drafts delivered. Send manually from your email._`].join('\n\n')

  const encoded = encodeURIComponent(message)
  const url = `https://api.telegram.org/bot${TG_BOT_TOKEN}/sendMessage?chat_id=${TG_CHAT_ID}&text=${encoded}&parse_mode=Markdown`

  const response = await fetch(url, { method: 'POST' })
  if (!response.ok) {
    throw new Error(`Telegram send failed: ${response.status}`)
  }
}
