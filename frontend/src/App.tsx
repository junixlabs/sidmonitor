import { Routes, Route, useLocation } from 'react-router-dom'
import { Toaster } from 'sonner'
import { lazy, Suspense, useEffect } from 'react'

import { AuthProvider } from './contexts/AuthContext'
import { ThemeProvider } from './contexts/ThemeContext'
import ErrorBoundary from './components/ErrorBoundary'
import FeedbackWidget from './components/FeedbackWidget'
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
const Docs = lazy(() => import('./pages/Docs'))
const OrgSettings = lazy(() => import('./pages/OrgSettings'))
const UserSettings = lazy(() => import('./pages/UserSettings'))
const FeedbackPage = lazy(() => import('./pages/Feedback'))
const Endpoints = lazy(() => import('./pages/Endpoints'))
const EndpointDetail = lazy(() => import('./pages/EndpointDetail'))

function PageSkeleton() {
  return (
    <div className="p-6 space-y-6 animate-pulse">
      {/* Title skeleton */}
      <div className="space-y-2">
        <div className="h-7 bg-surface-tertiary rounded w-48" />
        <div className="h-4 bg-surface-tertiary rounded w-72" />
      </div>
      {/* Cards skeleton */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="h-28 bg-surface-tertiary rounded-lg" />
        ))}
      </div>
      {/* Table skeleton */}
      <div className="bg-surface-tertiary rounded-lg h-64" />
    </div>
  )
}

function ScrollToTop() {
  const { pathname } = useLocation()
  useEffect(() => {
    window.scrollTo(0, 0)
  }, [pathname])
  return null
}

function AppRoutes() {
  return (
    <>
    <ScrollToTop />
    <Suspense fallback={<PageSkeleton />}>
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
        <Route path="/docs" element={<Layout><Docs /></Layout>} />
        <Route path="/feedback" element={<Layout><FeedbackPage /></Layout>} />
        <Route path="/settings/account" element={<Layout><UserSettings /></Layout>} />
        <Route path="/:orgSlug/settings" element={<Layout><OrgSettings /></Layout>} />
        <Route path="/:orgSlug/projects" element={<Projects />} />
        <Route path="/:orgSlug/projects/new" element={<Projects />} />

        {/* Project-scoped routes (URL-driven context) */}
        <Route path="/:orgSlug/:projectSlug" element={<ProjectLayout />}>
          <Route path="dashboard" element={<Dashboard />} />
          <Route path="logs" element={<Logs />} />
          <Route path="inbound-apis" element={<InboundAPIs />} />
          <Route path="outbound-apis" element={<OutboundAPIs />} />
          <Route path="endpoints" element={<Endpoints />} />
          <Route path="endpoint-detail" element={<EndpointDetail />} />
          <Route path="jobs" element={<Jobs />} />
          <Route path="scheduled-tasks" element={<ScheduledTasks />} />
          <Route path="settings" element={<Settings />} />
        </Route>
      </Route>
    </Routes>
    </Suspense>
    </>
  )
}

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider>
        <AuthProvider>
          <AppRoutes />
          <FeedbackWidget />
          <Toaster position="top-right" richColors />
        </AuthProvider>
      </ThemeProvider>
    </ErrorBoundary>
  )
}

export default App
