import { NavLink } from 'react-router-dom'
import { ScrollText, Settings, Sparkles, Trophy } from 'lucide-react'

const TABS = [
  { to: '/', label: 'Today', Icon: Sparkles },
  { to: '/chores', label: 'Chores', Icon: ScrollText },
  { to: '/scores', label: 'Scores', Icon: Trophy },
  { to: '/settings', label: 'Settings', Icon: Settings },
]

export function Nav() {
  return (
    <nav className="nav" aria-label="Main">
      {TABS.map(({ to, label, Icon }) => (
        <NavLink key={to} to={to} end={to === '/'} className="nav__tab">
          <Icon size={20} strokeWidth={1.6} aria-hidden="true" />
          {label}
        </NavLink>
      ))}
    </nav>
  )
}
