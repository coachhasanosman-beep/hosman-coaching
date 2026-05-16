import { Routes, Route } from 'react-router-dom'
import BottomNav from '../../components/shared/BottomNav'
import HomePage       from './HomePage'
import ProgrammePage  from './ProgrammePage'
import SchedulePage   from './SchedulePage'
import SessionsPage   from './SessionsPage'
import MetricsPage    from './MetricsPage'
import SettingsPage   from './SettingsPage'

export default function ClientApp() {
  return (
    <div className="page">
      <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
        <Routes>
          <Route index        element={<HomePage />} />
          <Route path="programme" element={<ProgrammePage />} />
          <Route path="schedule"  element={<SchedulePage />} />
          <Route path="sessions"  element={<SessionsPage />} />
          <Route path="metrics"   element={<MetricsPage />} />
          <Route path="settings"  element={<SettingsPage />} />
        </Routes>
      </div>
      <BottomNav />
    </div>
  )
}
