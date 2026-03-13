import { Routes, Route } from 'react-router-dom'
import { Toaster } from 'sonner'
import { lazy, Suspense } from 'react'

import { AuthProvider } from './contexts/AuthContext'
import { ThemeProvider } from './contexts/ThemeContext'
import Layout from './components/Layout'
import AuthGuard from './components/guards/AuthGuard'
import ProjectLayout from './components/layouts/ProjectLayout'

// Lazy-loaded pages
const Dashboard = lazy(() => import('./pages/Dashboard'))
const Logs = lazy(() => import('./pages/Logs'))
const Login = lazy(() => import('./pages/Login'))
const Register = lazy(() => import('./pages/Register'))
const Settings = lazy(() => import('./pages/Settings'))
const Jobs = lazy(() => import('./pages/Jobs'))
const ScheduledTasks = lazy(() => import('./pages/ScheduledTasks'))
const Organizations = lazy(() => import('./pages/Organizations'))
const Projects = lazy(() => import('./pages/Projects'))
const GlobalDashboard = lazy(() => import('./pages/GlobalDashboard'))
const OutboundAPIs = lazy(() => import('./pages/OutboundAPIs'))
const InboundAPIs = lazy(() => import('./pages/InboundAPIs'))
const WhatsNew = lazy(() => import('./pages/WhatsNew'))

function PageLoader() {
  return (
    <div className="flex items-center justify-center py-12">
      <div className="text-text-muted">Loading...</div>
    </div>
  )
}

function AppRoutes() {
  return (
    <Suspense fallback={<PageLoader />}>
    <Routes>
      {/* Public routes */}
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />

      {/* Authenticated routes */}
      <Route element={<AuthGuard />}>
        {/* Global pages (no project context required) */}
        <Route path="/" element={<Layout><GlobalDashboard /></Layout>} />
        <Route path="/organizations" element={<Layout><Organizations /></Layout>} />
        <Route path="/whats-new" element={<Layout><WhatsNew /></Layout>} />
        <Route path="/:orgSlug/projects" element={<Projects />} />
        <Route path="/:orgSlug/projects/new" element={<Projects />} />

        {/* Project-scoped routes (URL-driven context) */}
        <Route path="/:orgSlug/:projectSlug" element={<ProjectLayout />}>
          <Route path="dashboard" element={<Dashboard />} />
          <Route path="logs" element={<Logs />} />
          <Route path="inbound-apis" element={<InboundAPIs />} />
          <Route path="outbound-apis" element={<OutboundAPIs />} />
          <Route path="jobs" element={<Jobs />} />
          <Route path="scheduled-tasks" element={<ScheduledTasks />} />
          <Route path="settings" element={<Settings />} />
        </Route>
      </Route>
    </Routes>
    </Suspense>
  )
}

function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <AppRoutes />
        <Toaster position="top-right" richColors />
      </AuthProvider>
    </ThemeProvider>
  )
}

export default App
