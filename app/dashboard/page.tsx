import styles from '../page.module.css'
import { getDraftsFromAttio } from '../../lib/attio'
import { sendDraftsToTelegram } from '../../lib/telegram'

async function getDrafts() {
  try {
    return await getDraftsFromAttio()
  } catch {
    return []
  }
}

export default async function DashboardPage() {
  const drafts = await getDrafts()

  return (
    <main className={styles.main}>
      <div className={styles.header}>
        <h1 className={styles.title}>📤 Email Drafts</h1>
        <p className={styles.subtitle}>
          {drafts.length > 0
            ? `${drafts.length} drafts ready to send`
            : 'No drafts available — run the morning automation first'}
        </p>
        <form action="/api/send-drafts" method="POST">
          <button
            type="submit"
            className={styles.button}
            disabled={drafts.length === 0}
          >
            📤 Send to Telegram
          </button>
        </form>
        <form action="/api/auth/logout" method="POST">
          <button type="submit" className={styles.logoutBtn}>
            Sign Out
          </button>
        </form>
      </div>

      {drafts.length > 0 && (
        <div className={styles.draftsList}>
          {drafts.map((draft, i) => (
            <div key={i} className={styles.draftCard}>
              <div className={styles.draftHeader}>
                <strong>{draft.name}</strong>
                <span>{draft.email}</span>
              </div>
              <p className={styles.draftCompany}>{draft.company}</p>
              <div className={styles.draftBody}>{draft.draft}</div>
            </div>
          ))}
        </div>
      )}
    </main>
  )
}
