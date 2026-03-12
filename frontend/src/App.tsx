import { Routes, Route, Navigate } from 'react-router-dom'
import { Toaster } from 'sonner'
import { lazy, Suspense, ReactNode } from 'react'

import { AuthProvider, useAuth } from './contexts/AuthContext'
import { ThemeProvider } from './contexts/ThemeContext'
import Layout from './components/Layout'

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

// Protected route wrapper
function ProtectedRoute({ children }: { children: ReactNode }) {
  const { isAuthenticated } = useAuth()

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />
  }

  return <>{children}</>
}

// Route that requires org/project context
function ProjectRoute({ children }: { children: ReactNode }) {
  const { isAuthenticated, currentProject } = useAuth()

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />
  }

  if (!currentProject) {
    return <Navigate to="/organizations" replace />
  }

  return <>{children}</>
}

function AppRoutes() {
  return (
    <Suspense fallback={<PageLoader />}>
    <Routes>
      {/* Public routes */}
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />

      {/* Protected routes - organization/project selection */}
      <Route
        path="/organizations"
        element={
          <ProtectedRoute>
            <Layout><Organizations /></Layout>
          </ProtectedRoute>
        }
      />
      {/* Global Dashboard is default landing page */}
      <Route
        path="/"
        element={
          <ProtectedRoute>
            <Layout><GlobalDashboard /></Layout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/:orgSlug/projects"
        element={
          <ProtectedRoute>
            <Projects />
          </ProtectedRoute>
        }
      />
      <Route
        path="/:orgSlug/projects/new"
        element={
          <ProtectedRoute>
            <Projects />
          </ProtectedRoute>
        }
      />

      {/* Protected routes - require project context */}
      <Route
        path="/dashboard"
        element={
          <ProjectRoute>
            <Layout><Dashboard /></Layout>
          </ProjectRoute>
        }
      />
      <Route
        path="/logs"
        element={
          <ProjectRoute>
            <Layout><Logs /></Layout>
          </ProjectRoute>
        }
      />
      <Route
        path="/inbound-apis"
        element={
          <ProjectRoute>
            <Layout><InboundAPIs /></Layout>
          </ProjectRoute>
        }
      />
      <Route
        path="/jobs"
        element={
          <ProjectRoute>
            <Layout><Jobs /></Layout>
          </ProjectRoute>
        }
      />
      <Route
        path="/scheduled-tasks"
        element={
          <ProjectRoute>
            <Layout><ScheduledTasks /></Layout>
          </ProjectRoute>
        }
      />
      <Route
        path="/outbound-apis"
        element={
          <ProjectRoute>
            <Layout><OutboundAPIs /></Layout>
          </ProjectRoute>
        }
      />
      <Route
        path="/settings"
        element={
          <ProjectRoute>
            <Layout><Settings /></Layout>
          </ProjectRoute>
        }
      />
      <Route
        path="/whats-new"
        element={
          <ProtectedRoute>
            <Layout><WhatsNew /></Layout>
          </ProtectedRoute>
        }
      />
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
