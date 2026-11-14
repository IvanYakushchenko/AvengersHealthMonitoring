import { useState, type FormEvent } from 'react'
import { LogIn } from 'lucide-react'

type LoginPageProps = {
  onLogin: (username: string) => void
}

function LoginPage({ onLogin }: LoginPageProps) {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!username.trim() || !password) {
      setError('Please enter both username and password.')
      return
    }
    // Placeholder: replace with a real authentication request.
    setError('')
    onLogin(username.trim())
  }

  return (
    <div className="flex min-h-screen w-full items-center justify-center bg-slate-100 p-4">
      <form
        onSubmit={handleSubmit}
        className="flex w-full max-w-sm flex-col gap-4 rounded-lg bg-white p-8 shadow-md"
      >
        <h1 className="text-center text-2xl font-semibold text-slate-800">Sign in</h1>

        <label className="flex flex-col gap-1 text-sm text-slate-700">
          Username
          <input
            type="text"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            className="rounded-md border border-slate-300 px-3 py-2 outline-none focus:border-red-800"
            autoComplete="username"
          />
        </label>

        <label className="flex flex-col gap-1 text-sm text-slate-700">
          Password
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="rounded-md border border-slate-300 px-3 py-2 outline-none focus:border-red-800"
            autoComplete="current-password"
          />
        </label>

        {error && <p className="text-sm text-red-700">{error}</p>}

        <button
          type="submit"
          className="flex items-center justify-center gap-2 rounded-md bg-red-800 px-4 py-2 font-medium text-white hover:bg-red-900"
        >
          <LogIn size={18} />
          Log in
        </button>
      </form>
    </div>
  )
}

export default LoginPage
