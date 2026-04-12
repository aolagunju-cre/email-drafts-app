import styles from '../page.module.css'

export default function LoginPage() {
  async function handleLogin(formData: FormData) {
    'use server'
    const password = formData.get('password')
    if (password === process.env.AUTH_PASSWORD) {
      // Set cookie and redirect
      redirect('/dashboard')
    }
  }

  return (
    <main className={styles.main}>
      <div className={styles.loginCard}>
        <h1 className={styles.title}>📤 Email Drafts</h1>
        <p className={styles.subtitle}>Enter your password to continue</p>
        <form action="/api/auth/login" method="POST">
          <input
            type="password"
            name="password"
            placeholder="Password"
            className={styles.input}
            required
          />
          <button type="submit" className={styles.button}>
            Sign In
          </button>
        </form>
      </div>
    </main>
  )
}
