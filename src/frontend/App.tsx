import { BrowserRouter, Routes, Route, Navigate, NavLink } from 'react-router-dom'
import { LayoutDashboard, GitBranch, Settings, LogOut, LayoutTemplate, Activity } from 'lucide-react'
import Login from './pages/Login'
import Register from './pages/Register'
import Dashboard from './pages/Dashboard'
import PipelineEditor from './pages/PipelineEditor'
import RunHistory from './pages/RunHistory'
import SettingsPage from './pages/Settings'
import TemplatesPage from './pages/Templates'
import ActivityLogPage from './pages/ActivityLog'
import { useAuthStore } from './store/authStore'

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { accessToken } = useAuthStore()
  if (!accessToken) return <Navigate to="/login" replace />
  return <>{children}</>
}

function Sidebar() {
  const { logout } = useAuthStore()
  const navItems = [
    { to: '/', icon: LayoutDashboard, label: 'Dashboard' },
    { to: '/templates', icon: LayoutTemplate, label: 'Templates' },
    { to: '/activity', icon: Activity, label: 'Activity' },
    { to: '/settings', icon: Settings, label: 'Settings' },
  ]
  return (
    <aside className="w-64 min-h-screen bg-slate-800/50 border-r border-slate-700/50 flex flex-col">
      <div className="p-6 border-b border-slate-700/50">
        <h1 className="text-xl font-bold bg-gradient-to-r from-indigo-400 to-purple-400 bg-clip-text text-transparent">
          UI ETL Tool
        </h1>
        <p className="text-xs text-slate-500 mt-1">Visual Pipeline Builder</p>
      </div>
      <nav className="flex-1 p-4 space-y-1">
        {navItems.map(({ to, icon: Icon, label }) => (
          <NavLink
            key={to}
            to={to}
            end={to === '/'}
            className={({ isActive }) =>
              `flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all ${
                isActive
                  ? 'bg-indigo-500/20 text-indigo-400 border border-indigo-500/30'
                  : 'text-slate-400 hover:bg-slate-700/50 hover:text-slate-200'
              }`
            }
          >
            <Icon size={18} />
            {label}
          </NavLink>
        ))}
      </nav>
      <div className="p-4 border-t border-slate-700/50">
        <button
          onClick={logout}
          className="flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium text-slate-400 hover:bg-red-500/10 hover:text-red-400 transition-all w-full"
        >
          <LogOut size={18} />
          Logout
        </button>
      </div>
    </aside>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route
          path="/*"
          element={
            <ProtectedRoute>
              <div className="flex min-h-screen bg-slate-900">
                <Sidebar />
                <main className="flex-1 overflow-auto">
                  <Routes>
                    <Route path="/" element={<Dashboard />} />
                    <Route path="/settings" element={<SettingsPage />} />
                    <Route path="/templates" element={<TemplatesPage />} />
                    <Route path="/activity" element={<ActivityLogPage />} />
                    <Route path="/pipelines/new" element={<PipelineEditor />} />
                    <Route path="/pipelines/:id" element={<PipelineEditor />} />
                    <Route path="/pipelines/:id/runs" element={<RunHistory />} />
                  </Routes>
                </main>
              </div>
            </ProtectedRoute>
          }
        />
      </Routes>
    </BrowserRouter>
  )
}
