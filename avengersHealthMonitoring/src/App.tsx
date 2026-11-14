import { useState } from 'react'
import './App.css'
import { LoginPage } from './features/login'
import { IndicationsPage } from './features/indications'

function App() {
  const [user, setUser] = useState<string | null>(null)

  if (!user) {
    return <LoginPage onLogin={setUser} />
  }

  return <IndicationsPage crewId={user} onLogout={() => setUser(null)} />;
}

export default App
