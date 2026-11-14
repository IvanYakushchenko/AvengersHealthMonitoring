import { useEffect, useRef, useState, type FormEvent } from 'react'
import { animate, stagger } from 'animejs'
import { Eye, EyeOff, Loader2, LogIn, Lock, User } from 'lucide-react'
import NasaLogo from './components/NasaLogo'
import Heartbeat from './components/Heartbeat'
import { authApi, type Session } from '../../api/healthApi'

type LoginPageProps = {
  onLogin: (session: Session) => void
  // Shown above the form, e.g. "Your session has ended".
  notice?: string | null
}

type FieldErrors = { username?: string; password?: string }

const prefersReducedMotion = () =>
  typeof window !== 'undefined' &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches

function validate(username: string, password: string): FieldErrors {
  const errors: FieldErrors = {}
  if (!username.trim()) errors.username = 'Username is required.'
  if (!password) errors.password = 'Password is required.'
  return errors
}

function LoginPage({ onLogin, notice }: LoginPageProps) {
  const cardRef = useRef<HTMLFormElement>(null)
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [capsLock, setCapsLock] = useState(false)
  const [touched, setTouched] = useState({ username: false, password: false })
  const [submitError, setSubmitError] = useState('')
  const [loading, setLoading] = useState(false)

  const fieldErrors = validate(username, password)
  const visibleErrors: FieldErrors = {
    username: touched.username ? fieldErrors.username : undefined,
    password: touched.password ? fieldErrors.password : undefined,
  }

  // Entrance animation: card fades up, then its children stagger in.
  useEffect(() => {
    if (prefersReducedMotion() || !cardRef.current) return
    const items = cardRef.current.querySelectorAll('[data-anim]')
    const animation = animate(items, {
      opacity: [0, 1],
      translateY: [16, 0],
      duration: 500,
      ease: 'outExpo',
      delay: stagger(80),
    })
    return () => {
      animation.cancel()
    }
  }, [])

  const shake = () => {
    if (prefersReducedMotion() || !cardRef.current) return
    animate(cardRef.current, {
      translateX: [0, -10, 10, -8, 8, -4, 4, 0],
      duration: 450,
      ease: 'linear',
    })
  }

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (loading) return
    setTouched({ username: true, password: true })
    const errors = validate(username, password)
    if (errors.username || errors.password) {
      shake()
      return
    }

    setSubmitError('')
    setLoading(true)
    try {
      const session = await authApi.login(username.trim(), password)
      onLogin(session)
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : 'Login failed. Please try again.')
      shake()
    } finally {
      setLoading(false)
    }
  }

  const inputClass = (hasError: boolean) =>
    `w-full rounded-md border bg-white py-2 pl-10 pr-10 text-ink outline-none transition-colors focus:border-brand focus:ring-2 focus:ring-brand-light/40 ${
      hasError ? 'border-danger' : 'border-slate-300'
    }`

  return (
    <div className="starfield relative flex min-h-screen w-full items-center justify-center overflow-hidden bg-ink p-4">
      <form
        ref={cardRef}
        onSubmit={handleSubmit}
        noValidate
        className="flex w-full max-w-sm flex-col gap-4 rounded-lg bg-white p-8 shadow-md"
      >
        <div data-anim className="flex flex-col items-center gap-2">
          <NasaLogo className="h-16 w-16" />
          <h1 className="text-center text-2xl font-semibold text-ink">Astronaut Health Monitor</h1>
          <p className="text-center text-xs uppercase tracking-widest text-brand">Mission crew sign in</p>
          <Heartbeat />
        </div>

        <div data-anim className="flex flex-col gap-1 text-sm text-slate-700">
          <label htmlFor="username">Username</label>
          <div className="relative">
            <User size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              id="username"
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              onBlur={() => setTouched((t) => ({ ...t, username: true }))}
              className={inputClass(!!visibleErrors.username)}
              autoComplete="username"
              autoFocus
              aria-invalid={!!visibleErrors.username}
              aria-describedby={visibleErrors.username ? 'username-error' : undefined}
            />
          </div>
          {visibleErrors.username && (
            <p id="username-error" className="text-xs text-danger">
              {visibleErrors.username}
            </p>
          )}
        </div>

        <div data-anim className="flex flex-col gap-1 text-sm text-slate-700">
          <label htmlFor="password">Password</label>
          <div className="relative">
            <Lock size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              id="password"
              type={showPassword ? 'text' : 'password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onBlur={() => setTouched((t) => ({ ...t, password: true }))}
              onKeyDown={(e) => setCapsLock(e.getModifierState('CapsLock'))}
              onKeyUp={(e) => setCapsLock(e.getModifierState('CapsLock'))}
              className={inputClass(!!visibleErrors.password)}
              autoComplete="current-password"
              aria-invalid={!!visibleErrors.password}
              aria-describedby={visibleErrors.password ? 'password-error' : undefined}
            />
            <button
              type="button"
              onClick={() => setShowPassword((s) => !s)}
              aria-label={showPassword ? 'Hide password' : 'Show password'}
              aria-pressed={showPassword}
              className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-slate-400 hover:text-brand"
            >
              {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
          </div>
          {visibleErrors.password && (
            <p id="password-error" className="text-xs text-danger">
              {visibleErrors.password}
            </p>
          )}
          {capsLock && <p className="text-xs text-amber-700">Caps Lock is on.</p>}
        </div>

        {notice && !submitError && <p className="text-sm text-brand">{notice}</p>}
        <p aria-live="polite" className="min-h-5 text-sm text-danger">
          {submitError}
        </p>

        <button
          data-anim
          type="submit"
          disabled={loading}
          className="flex items-center justify-center gap-2 rounded-md bg-brand px-4 py-2 font-medium text-white transition-colors hover:bg-brand-dark disabled:cursor-not-allowed disabled:opacity-70"
        >
          {loading ? <Loader2 size={18} className="animate-spin" /> : <LogIn size={18} />}
          {loading ? 'Signing in…' : 'Log in'}
        </button>
      </form>
      <p className="absolute bottom-3 text-center text-xs text-slate-400">
        Space Apps prototype · not an official NASA product <br/>
        AUK Avengers team | NASA Space Apps Hackaton 2026
      </p>
    </div>
  )
}

export default LoginPage
