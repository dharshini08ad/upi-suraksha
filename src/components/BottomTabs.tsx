import { NavLink } from 'react-router-dom'
import { IconAt, IconClock, IconHome, IconQr } from './Icons'

const TABS = [
  { to: '/', label: 'Home', Icon: IconHome },
  { to: '/scan', label: 'Scan', Icon: IconQr },
  { to: '/history', label: 'History', Icon: IconClock },
  { to: '/verify', label: 'Verify', Icon: IconAt },
]

export function BottomTabs() {
  return (
    <nav className="tabbar" aria-label="Primary">
      {TABS.map(({ to, label, Icon }) => (
        <NavLink
          key={to}
          to={to}
          end={to === '/'}
          className={({ isActive }) => `tabbar__tab${isActive ? ' is-active' : ''}`}
        >
          <Icon size={21} />
          <span>{label}</span>
        </NavLink>
      ))}
    </nav>
  )
}