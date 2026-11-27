import { useState } from 'react'
import { errorMessage, requireSupabase, supabaseConfigured } from '../data/supabase'

export default function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError(null)

    if (!supabaseConfigured) {
      setError('Supabase is not configured yet. Add your project URL and anon key to .env.local.')
      return
    }

    setBusy(true)
    try {
      const { error: signInError } = await requireSupabase().auth.signInWithPassword({
        email: email.trim(),
        password,
      })
      if (signInError) throw new Error(errorMessage(signInError))
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Sign in failed. Please try again.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="login-page">
      <div className="card login-card">
        <div className="brand brand-large">
          <span className="brand-mark" aria-hidden="true">
            NM
          </span>
          <div>
            <strong>Noon Meals</strong>
            <span className="brand-subtitle">School meal expense tracker</span>
          </div>
        </div>

        <h1>Teacher sign in</h1>
        <p className="muted">
          One shared teacher account manages ingredients, purchases, recipes and daily menus.
        </p>

        {!supabaseConfigured && (
          <div className="notice notice-warn" role="status">
            Supabase is not configured. Copy <code>.env.example</code> to{' '}
            <code>.env.local</code> and add your project URL and anon key, then restart the dev
            server.
          </div>
        )}

        <form onSubmit={handleSubmit} className="stack">
          <div>
            <label htmlFor="email">Email</label>
            <input
              id="email"
              type="email"
              autoComplete="username"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              required
            />
          </div>

          <div>
            <label htmlFor="password">Password</label>
            <input
              id="password"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              required
            />
          </div>

          {error && (
            <p className="error-banner" role="alert">
              {error}
            </p>
          )}

          <button type="submit" className="btn btn-primary btn-block" disabled={busy}>
            {busy ? 'Signing in…' : 'Sign in'}
          </button>
        </form>

        <p className="muted small">
          Sign-ups are disabled. Ask the administrator to create the teacher account in the
          Supabase dashboard.
        </p>
      </div>
    </div>
  )
}
