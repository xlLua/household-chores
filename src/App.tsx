import { BrowserRouter, Route, Routes, useLocation } from 'react-router-dom'
import { AuthProvider, useAuth } from './lib/auth'
import { isConfigured } from './lib/supabase'
import { BoardProvider } from './hooks/BoardProvider'
import { Nav } from './components/Nav'
import { Backdrop, type BackdropName } from './components/Backdrop'
import { SignIn } from './components/SignIn'
import { SetupNeeded } from './components/SetupNeeded'
import { Today } from './routes/Today'
import { Chores } from './routes/Chores'
import { Leaderboard } from './routes/Leaderboard'
import { SettingsPage } from './routes/Settings'

const BACKDROPS: Record<string, BackdropName> = {
  '/chores': 'broom',
  '/scores': 'laurel',
  '/settings': 'key',
}

function Shell() {
  const { pathname } = useLocation()
  return (
    <div className="app">
      <Backdrop name={BACKDROPS[pathname] ?? 'sun'} />
      <Routes>
        <Route path="/" element={<Today />} />
        <Route path="/chores" element={<Chores />} />
        <Route path="/scores" element={<Leaderboard />} />
        <Route path="/settings" element={<SettingsPage />} />
        <Route path="*" element={<Today />} />
      </Routes>
      <Nav />
    </div>
  )
}

function Gate() {
  const { session, loading } = useAuth()

  if (loading) {
    return (
      <div className="center-pad">
        <div className="spinner" role="status" aria-label="Laden" />
      </div>
    )
  }
  if (!session) return <SignIn />
  return (
    <BoardProvider>
      <Shell />
    </BoardProvider>
  )
}

export default function App() {
  if (!isConfigured) {
    return (
      <>
        <div className="grain" />
        <SetupNeeded />
      </>
    )
  }
  return (
    <BrowserRouter>
      <AuthProvider>
        <div className="grain" />
        <Gate />
      </AuthProvider>
    </BrowserRouter>
  )
}
