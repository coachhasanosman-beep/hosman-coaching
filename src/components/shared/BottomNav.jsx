import { useNavigate, useLocation } from 'react-router-dom'

const items = [
  { path: '/app',          label: 'Home',      icon: 'ti-home' },
  { path: '/app/programme',label: 'Programme', icon: 'ti-list-check' },
  { path: '/app/schedule', label: 'Schedule',  icon: 'ti-calendar' },
  { path: '/app/sessions', label: 'Sessions',  icon: 'ti-ticket' },
  { path: '/app/metrics',  label: 'Metrics',   icon: 'ti-chart-line' },
]

export default function BottomNav() {
  const navigate = useNavigate()
  const { pathname } = useLocation()

  return (
    <nav className="bottom-nav">
      {items.map(item => {
        const active = pathname === item.path || (item.path !== '/app' && pathname.startsWith(item.path))
        return (
          <button key={item.path} className={`nav-item ${active ? 'active' : ''}`}
            onClick={() => navigate(item.path)}>
            <i className={`ti ${item.icon}`} aria-hidden="true" />
            <span>{item.label}</span>
          </button>
        )
      })}
    </nav>
  )
}
