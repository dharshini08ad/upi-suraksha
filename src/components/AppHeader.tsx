import { useEffect, useState } from 'react'
import { NavLink, Link, useLocation } from 'react-router-dom'
import { ChipBar, Emblem, Flag } from './Emblem'
import { IconClose, IconMenu } from './Icons'
import { BRAND } from '../lib/brand'
import { useSession } from '../state/session'

const NAV = [
  { to: '/', label: 'Home', end: true },
  { to: '/scan', label: 'Scan QR', end: false },
  { to: '/link', label: 'Check Payment Link', end: false },
  { to: '/upi', label: 'Verify UPI ID', end: false },
]

export function AppHeader() {
  const [open, setOpen] = useState(false)
  const { pathname } = useLocation()
  const { input, analysis, reset } = useSession()
  const hasSession = Boolean(input || analysis)

  useEffect(() => {
    setOpen(false)
  }, [pathname])

  return (
    <header className="masthead">
      <div className="utilbar">
        <div className="container utilbar__inner">
          <span className="utilbar__org">
            <Flag width={24} />
            <strong>{BRAND.operator}</strong>
            <span className="utilbar__divider" aria-hidden="true">
              |
            </span>
            <span>{BRAND.programme}</span>
          </span>
          <span className="utilbar__meta">
            <span>Simulated wallet</span>
            <span className="utilbar__divider" aria-hidden="true">
              |
            </span>
            <span className="mono">Helpline 1930</span>
          </span>
        </div>
      </div>

      <div className="container masthead__inner">
        <Link to="/" className="brand">
          <Emblem />
          <span className="brand__text">
            <span className="brand__name">
              {BRAND.name} <em>{BRAND.nameLocal}</em>
            </span>
            <span className="brand__sub">{BRAND.tagline}</span>
          </span>
        </Link>

        <button
          type="button"
          className="btn btn--quiet nav-toggle"
          aria-expanded={open}
          aria-controls="primary-nav"
          onClick={() => setOpen((v) => !v)}
        >
          {open ? <IconClose /> : <IconMenu />}
          Menu
        </button>

        <nav id="primary-nav" className={`nav${open ? '' : ' is-collapsed'}`} aria-label="Primary">
          {NAV.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) => `nav__link${isActive ? ' is-active' : ''}`}
            >
              {item.label}
            </NavLink>
          ))}
          {hasSession ? (
            <button type="button" className="nav__link nav__link--reset" onClick={reset}>
              Start over
            </button>
          ) : null}
        </nav>
      </div>

      <ChipBar className="masthead__chips" />
    </header>
  )
}
