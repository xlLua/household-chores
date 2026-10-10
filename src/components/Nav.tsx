import { NavLink } from 'react-router-dom'
import { History, ScrollText, Settings, Sparkles, Trophy } from 'lucide-react'

const TABS = [
  { to: '/', label: 'Vandaag', Icon: Sparkles },
  { to: '/chores', label: 'Taken', Icon: ScrollText },
  { to: '/history', label: 'Historie', Icon: History },
  { to: '/scores', label: 'Scores', Icon: Trophy },
  { to: '/settings', label: 'Instellingen', Icon: Settings },
]

export function Nav() {
  return (
    <nav className="nav" aria-label="Hoofdmenu">
      {TABS.map(({ to, label, Icon }) => (
        <NavLink key={to} to={to} end={to === '/'} className="nav__tab">
          <Icon size={20} strokeWidth={1.6} aria-hidden="true" />
          {label}
        </NavLink>
      ))}
    </nav>
  )
}
