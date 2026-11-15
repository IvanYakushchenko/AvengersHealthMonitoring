import { useCallback, useMemo, useState, type ReactNode } from 'react'
import './App.css'
import { LoginPage } from './features/login'
import { IndicationsPage } from './features/indications'
import { AdminPage } from './features/admin/AdminPage'
import { SuperadminPage } from './features/superadmin/SuperadminPage'
import { ChangePasswordDialog } from './features/account/ChangePasswordDialog'
import { CrewTutorial } from './features/tutorial/CrewTutorial'
import { hasSeenTutorial, markTutorialSeen } from './features/tutorial/tutorialSeen'
import {
  authApi,
  crewMemberSource,
  crewSource,
  type CrewMember,
  type Session,
} from './api/healthApi'

function App() {
  // The session lives in memory only: a page reload asks for the login again.
  const [session, setSession] = useState<Session | null>(null)
  // Mission control: the crew member whose health is open, or null for the crew list.
  const [selectedCrew, setSelectedCrew] = useState<CrewMember | null>(null)
  const [showPassword, setShowPassword] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)
  // The crew tutorial: opened after the first login, and from the header button.
  const [tutorialOpen, setTutorialOpen] = useState(false)

  const endSession = useCallback((message: string | null) => {
    setSession(null)
    setSelectedCrew(null)
    setShowPassword(false)
    setTutorialOpen(false)
    setNotice(message)
  }, [])

  const closeTutorial = useCallback(() => {
    if (session && !session.isAdmin && !session.isSuperadmin) markTutorialSeen(session.username)
    setTutorialOpen(false)
  }, [session])

  const logout = useCallback(() => {
    if (session) void authApi.logout(session.token).catch(() => undefined)
    endSession(null)
  }, [session, endSession])

  const sessionExpired = useCallback(
    () => endSession('Your session has ended. Please log in again.'),
    [endSession],
  )

  const token = session?.token ?? null
  const crewApi = useMemo(
    () => (token && session && !session.isAdmin ? crewSource(token) : null),
    [token, session],
  )
  const memberApi = useMemo(
    () => (token && selectedCrew ? crewMemberSource(token, selectedCrew.astronautId) : null),
    [token, selectedCrew],
  )

  if (!session || !token) {
    return (
      <LoginPage
        notice={notice}
        onLogin={(newSession) => {
          setNotice(null)
          setSession(newSession)
          const isCrew = !newSession.isAdmin && !newSession.isSuperadmin
          setTutorialOpen(isCrew && !hasSeenTutorial(newSession.username))
        }}
      />
    )
  }

  const openPassword = () => setShowPassword(true)

  let page: ReactNode
  if (session.isSuperadmin) {
    page = (
      <SuperadminPage
        token={token}
        username={session.username}
        onChangePassword={openPassword}
        onLogout={logout}
        onSessionExpired={sessionExpired}
      />
    )
  } else if (session.isAdmin) {
    page =
      selectedCrew && memberApi ? (
        <IndicationsPage
          key={selectedCrew.astronautId}
          source={memberApi}
          crewLabel={`Crew: ${selectedCrew.username}`}
          sex={selectedCrew.sex}
          canLog={false}
          onBack={() => setSelectedCrew(null)}
          onChangePassword={openPassword}
          onLogout={logout}
          onSessionExpired={sessionExpired}
        />
      ) : (
        <AdminPage
          token={token}
          username={session.username}
          crewName={session.crewName}
          onOpenCrew={setSelectedCrew}
          onChangePassword={openPassword}
          onLogout={logout}
          onSessionExpired={sessionExpired}
        />
      )
  } else if (crewApi) {
    page = (
      <IndicationsPage
        source={crewApi}
        crewLabel={session.username}
        sex={session.sex}
        canLog
        onOpenTutorial={() => setTutorialOpen(true)}
        onChangePassword={openPassword}
        onLogout={logout}
        onSessionExpired={sessionExpired}
      />
    )
  }

  return (
    <>
      {page}
      {tutorialOpen && session && !session.isAdmin && !session.isSuperadmin && (
        <CrewTutorial onClose={closeTutorial} />
      )}
      {showPassword && (
        <ChangePasswordDialog
          token={token}
          onCancel={() => setShowPassword(false)}
          onDone={() => endSession('Password changed. Please log in again.')}
        />
      )}
    </>
  )
}

export default App
