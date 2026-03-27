import { useState, useEffect, useRef, useCallback } from 'react'
import {
  BookOpen,
  Rocket,
  Code2,
  Server,
  Settings,
  Briefcase,
  Clock,
  ArrowRight,
  Inbox,
  Copy,
  Check,
  ChevronRight,
  ChevronDown,
  Info,
  AlertTriangle,
  Zap,
  Bot,
  MessageSquarePlus,
  Shield,
  ExternalLink,
  Search,
  List,
  X,
} from 'lucide-react'
import { useCopyToClipboard } from '@/hooks/useCopyToClipboard'

/* ─── Reusable sub-components ─── */

function CodeBlock({ code, lang, id }: { code: string; lang?: string; id: string }) {
  const { copiedField, copy } = useCopyToClipboard()
  return (
    <div className="relative group rounded-lg overflow-hidden border border-border-primary">
      {lang && (
        <div className="flex items-center justify-between px-4 py-1.5 bg-surface-tertiary border-b border-border-primary">
          <span className="text-[11px] font-medium text-text-muted uppercase tracking-wider">{lang}</span>
        </div>
      )}
      <pre className="bg-[#0d1117] dark:bg-[#0a0e17] p-4 overflow-x-auto text-[13px] leading-relaxed">
        <code className="text-[#c9d1d9] font-mono">{code}</code>
      </pre>
      <button
        onClick={() => copy(code, id)}
        className="absolute top-2 right-2 p-1.5 rounded-md bg-white/10 hover:bg-white/20 opacity-0 group-hover:opacity-100 transition-opacity"
        title="Copy"
      >
        {copiedField === id ? (
          <Check className="w-3.5 h-3.5 text-green-400" />
        ) : (
          <Copy className="w-3.5 h-3.5 text-gray-400" />
        )}
      </button>
    </div>
  )
}

function Callout({ type = 'info', children }: { type?: 'info' | 'warning' | 'tip'; children: React.ReactNode }) {
  const styles = {
    info: { bg: 'bg-status-info/8', border: 'border-status-info/25', icon: <Info className="w-4 h-4 text-status-info flex-shrink-0 mt-0.5" />, label: 'Note' },
    warning: { bg: 'bg-status-warning/8', border: 'border-status-warning/25', icon: <AlertTriangle className="w-4 h-4 text-status-warning flex-shrink-0 mt-0.5" />, label: 'Warning' },
    tip: { bg: 'bg-status-success/8', border: 'border-status-success/25', icon: <Zap className="w-4 h-4 text-status-success flex-shrink-0 mt-0.5" />, label: 'Tip' },
  }
  const s = styles[type]
  return (
    <div className={`flex gap-3 p-4 rounded-lg border ${s.bg} ${s.border}`}>
      {s.icon}
      <div className="text-sm text-text-secondary leading-relaxed">{children}</div>
    </div>
  )
}

function Heading({ id, children }: { id: string; children: React.ReactNode }) {
  return (
    <h3 id={id} className="text-base font-semibold text-text-primary mt-8 mb-3 scroll-mt-20 flex items-center gap-2">
      {children}
    </h3>
  )
}

function SubHeading({ id, children }: { id: string; children: React.ReactNode }) {
  return (
    <h4 id={id} className="text-sm font-semibold text-text-primary mt-6 mb-2 scroll-mt-20">
      {children}
    </h4>
  )
}

function Para({ children }: { children: React.ReactNode }) {
  return <p className="text-sm text-text-secondary leading-relaxed mb-4">{children}</p>
}

function InlineCode({ children }: { children: React.ReactNode }) {
  return (
    <code className="px-1.5 py-0.5 rounded bg-surface-tertiary text-accent text-[13px] font-mono">
      {children}
    </code>
  )
}

/* ─── Table of Contents data ─── */

interface TocItem {
  id: string
  label: string
  icon: React.ReactNode
  children?: { id: string; label: string }[]
}

const tocItems: TocItem[] = [
  {
    id: 'quick-start',
    label: 'Quick Start',
    icon: <Rocket className="w-4 h-4" />,
    children: [
      { id: 'qs-install', label: 'Install SDK' },
      { id: 'qs-configure', label: 'Configure' },
      { id: 'qs-verify', label: 'Verify' },
    ],
  },
  {
    id: 'laravel-sdk',
    label: 'Laravel SDK',
    icon: <Code2 className="w-4 h-4" />,
    children: [
      { id: 'laravel-install', label: 'Installation' },
      { id: 'laravel-config', label: 'Configuration' },
      { id: 'laravel-service-mapping', label: 'Service Mapping' },
      { id: 'laravel-excluded', label: 'Exclusions' },
    ],
  },
  {
    id: 'inbound',
    label: 'Inbound Monitoring',
    icon: <Inbox className="w-4 h-4" />,
    children: [
      { id: 'inbound-how', label: 'How It Works' },
      { id: 'inbound-filter', label: 'Filtering' },
      { id: 'inbound-body', label: 'Body Recording' },
    ],
  },
  {
    id: 'outbound',
    label: 'Outbound Monitoring',
    icon: <ArrowRight className="w-4 h-4" />,
    children: [
      { id: 'outbound-how', label: 'How It Works' },
      { id: 'outbound-services', label: 'Service Detection' },
      { id: 'outbound-tracing', label: 'Request Tracing' },
    ],
  },
  {
    id: 'jobs',
    label: 'Jobs & Queues',
    icon: <Briefcase className="w-4 h-4" />,
    children: [
      { id: 'jobs-tracking', label: 'Job Tracking' },
      { id: 'jobs-failures', label: 'Failure Monitoring' },
    ],
  },
  {
    id: 'scheduled-tasks',
    label: 'Scheduled Tasks',
    icon: <Clock className="w-4 h-4" />,
    children: [
      { id: 'tasks-tracking', label: 'Task Tracking' },
      { id: 'tasks-missed', label: 'Missed Runs' },
    ],
  },
  {
    id: 'feedback',
    label: 'Feedback System',
    icon: <MessageSquarePlus className="w-4 h-4" />,
    children: [
      { id: 'feedback-widget', label: 'Widget' },
      { id: 'feedback-admin', label: 'Admin Page' },
      { id: 'feedback-api', label: 'REST API' },
    ],
  },
  {
    id: 'mcp',
    label: 'MCP Server',
    icon: <Bot className="w-4 h-4" />,
    children: [
      { id: 'mcp-overview', label: 'Overview' },
      { id: 'mcp-setup', label: 'Setup' },
      { id: 'mcp-tools', label: 'Available Tools' },
    ],
  },
  {
    id: 'api-reference',
    label: 'API Reference',
    icon: <Server className="w-4 h-4" />,
    children: [
      { id: 'api-auth', label: 'Authentication' },
      { id: 'api-ingest', label: 'Ingest Endpoints' },
      { id: 'api-query', label: 'Query Endpoints' },
    ],
  },
  {
    id: 'configuration',
    label: 'Configuration',
    icon: <Settings className="w-4 h-4" />,
    children: [
      { id: 'env-vars', label: 'Environment Variables' },
      { id: 'retention', label: 'Data Retention' },
      { id: 'circuit-breaker', label: 'Circuit Breaker' },
    ],
  },
]

/* ─── Table of Contents Component ─── */

function TableOfContents({
  activeId,
  onNavigate,
  items,
}: {
  activeId: string
  onNavigate: (id: string) => void
  items?: TocItem[]
}) {
  const displayItems = items || tocItems
  const [expanded, setExpanded] = useState<Set<string>>(new Set(tocItems.map((t) => t.id)))

  const toggle = (id: string) => {
    setExpanded((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  return (
    <nav className="space-y-0.5">
      {displayItems.map((item) => {
        const isActive = activeId === item.id || item.children?.some((c) => c.id === activeId)
        const isExpanded = expanded.has(item.id)

        return (
          <div key={item.id}>
            <button
              onClick={() => {
                toggle(item.id)
                onNavigate(item.id)
              }}
              className={`w-full flex items-center gap-2 px-2.5 py-1.5 rounded-md text-left text-[13px] font-medium transition-colors ${
                isActive
                  ? 'text-accent bg-accent/8'
                  : 'text-text-secondary hover:text-text-primary hover:bg-surface-tertiary'
              }`}
            >
              <span className={isActive ? 'text-accent' : 'text-text-muted'}>{item.icon}</span>
              <span className="flex-1 truncate">{item.label}</span>
              {item.children && (
                <span className="text-text-muted">
                  {isExpanded ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
                </span>
              )}
            </button>
            {item.children && isExpanded && (
              <div className="ml-4 pl-3 border-l border-border-subtle space-y-0.5 mt-0.5 mb-1">
                {item.children.map((child) => (
                  <button
                    key={child.id}
                    onClick={() => onNavigate(child.id)}
                    className={`w-full text-left px-2.5 py-1 rounded-md text-[12px] transition-colors ${
                      activeId === child.id
                        ? 'text-accent font-medium'
                        : 'text-text-muted hover:text-text-secondary'
                    }`}
                  >
                    {child.label}
                  </button>
                ))}
              </div>
            )}
          </div>
        )
      })}
    </nav>
  )
}

/* ─── Mobile TOC ─── */

function MobileToc({ activeId, onNavigate }: { activeId: string; onNavigate: (id: string) => void }) {
  const [open, setOpen] = useState(false)

  return (
    <div className="xl:hidden mb-6">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 px-3 py-2 w-full rounded-lg border border-border-primary bg-surface text-sm text-text-secondary hover:bg-surface-secondary transition-colors"
      >
        <List className="w-4 h-4" />
        <span className="flex-1 text-left">On this page</span>
        {open ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
      </button>
      {open && (
        <div className="mt-2 p-3 rounded-lg border border-border-primary bg-surface">
          <TableOfContents
            activeId={activeId}
            onNavigate={(id) => {
              onNavigate(id)
              setOpen(false)
            }}
          />
        </div>
      )}
    </div>
  )
}

/* ─── Main Page ─── */

export default function Docs() {
  const [activeId, setActiveId] = useState('quick-start')
  const [search, setSearch] = useState('')
  const contentRef = useRef<HTMLDivElement>(null)
  const currentHost = typeof window !== 'undefined' ? window.location.origin : 'https://your-sidmonitor-host'

  // Scrollspy: track which section is in view
  useEffect(() => {
    const allIds = tocItems.flatMap((t) => [t.id, ...(t.children?.map((c) => c.id) || [])])

    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)
        if (visible.length > 0) {
          setActiveId(visible[0].target.id)
        }
      },
      { rootMargin: '-80px 0px -60% 0px', threshold: 0 }
    )

    allIds.forEach((id) => {
      const el = document.getElementById(id)
      if (el) observer.observe(el)
    })

    return () => observer.disconnect()
  }, [])

  const scrollTo = useCallback((id: string) => {
    const el = document.getElementById(id)
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }
  }, [])

  // Search filtering
  const searchLower = search.toLowerCase()
  const filteredToc = search
    ? tocItems.filter(
        (t) =>
          t.label.toLowerCase().includes(searchLower) ||
          t.children?.some((c) => c.label.toLowerCase().includes(searchLower))
      )
    : tocItems

  return (
    <div className="max-w-7xl mx-auto py-8 px-4">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <div className="flex items-center justify-center w-9 h-9 rounded-lg bg-accent/10">
            <BookOpen className="w-5 h-5 text-accent" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-text-primary">Documentation</h1>
            <p className="text-sm text-text-muted">
              Everything you need to set up, configure, and monitor your applications.
            </p>
          </div>
        </div>
      </div>

      {/* Mobile TOC */}
      <MobileToc activeId={activeId} onNavigate={scrollTo} />

      <div className="flex gap-8">
        {/* Sidebar TOC — desktop only */}
        <aside className="hidden xl:block w-56 flex-shrink-0">
          <div className="sticky top-20">
            <div className="relative mb-3">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-text-muted" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search docs..."
                className="w-full pl-8 pr-7 py-1.5 text-xs rounded-md border border-border-primary bg-surface text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-1 focus:ring-accent focus:border-accent"
              />
              {search && (
                <button onClick={() => setSearch('')} className="absolute right-2 top-1/2 -translate-y-1/2">
                  <X className="w-3 h-3 text-text-muted hover:text-text-primary" />
                </button>
              )}
            </div>
            <TableOfContents
              activeId={activeId}
              onNavigate={scrollTo}
              items={filteredToc}
            />
          </div>
        </aside>

        {/* Main Content */}
        <main ref={contentRef} className="flex-1 min-w-0">
          {/* ══════════════════════════════════════════
              QUICK START
             ══════════════════════════════════════════ */}
          <section id="quick-start" className="scroll-mt-20 mb-14">
            <div className="flex items-center gap-2.5 mb-4">
              <Rocket className="w-5 h-5 text-accent" />
              <h2 className="text-lg font-bold text-text-primary">Quick Start</h2>
            </div>
            <Para>Get SidMonitor running with your Laravel application in under 5 minutes.</Para>

            <div id="qs-install" className="scroll-mt-20" />
            <SubHeading id="qs-install-h">1. Install the SDK</SubHeading>
            <CodeBlock lang="bash" id="qs-1" code="composer require junixlabs/laravel-observatory" />

            <div id="qs-configure" className="scroll-mt-20" />
            <SubHeading id="qs-configure-h">2. Publish & Configure</SubHeading>
            <CodeBlock lang="bash" id="qs-2" code="php artisan vendor:publish --tag=observatory-config" />
            <div className="mt-3" />
            <CodeBlock
              lang="env"
              id="qs-3"
              code={`# .env
OBSERVATORY_ENABLED=true
OBSERVATORY_EXPORTER=sidmonitor
SIDMONITOR_API_KEY=your-api-key-here
SIDMONITOR_ENDPOINT=${currentHost}`}
            />

            <div id="qs-verify" className="scroll-mt-20" />
            <SubHeading id="qs-verify-h">3. Verify</SubHeading>
            <Para>
              Send a test request to your app, then check the <strong className="text-text-primary">Dashboard</strong> page.
              Data should appear within a few seconds.
            </Para>
            <Callout type="tip">
              Generate an API key from <strong>Project Settings → API Keys</strong> tab. Each project has its own
              key — don't share keys across projects.
            </Callout>
          </section>

          {/* ══════════════════════════════════════════
              LARAVEL SDK
             ══════════════════════════════════════════ */}
          <section id="laravel-sdk" className="scroll-mt-20 mb-14">
            <div className="flex items-center gap-2.5 mb-4">
              <Code2 className="w-5 h-5 text-accent" />
              <h2 className="text-lg font-bold text-text-primary">Laravel SDK</h2>
            </div>
            <Para>
              The <InlineCode>junixlabs/laravel-observatory</InlineCode> package automatically monitors inbound HTTP
              requests, outbound API calls, queue jobs, scheduled tasks, and exceptions. Supports Laravel 9+ (PHP 8.0+).
            </Para>

            <Heading id="laravel-install">Installation</Heading>
            <CodeBlock lang="bash" id="l-install" code="composer require junixlabs/laravel-observatory" />
            <Para>
              The package auto-discovers its service provider. No manual registration needed.
            </Para>

            <Heading id="laravel-config">Configuration</Heading>
            <Para>Publish the configuration file:</Para>
            <CodeBlock lang="bash" id="l-config" code="php artisan vendor:publish --tag=observatory-config" />
            <Para>
              This creates <InlineCode>config/observatory.php</InlineCode>. Key options:
            </Para>
            <div className="overflow-x-auto mb-4">
              <table className="w-full text-sm border border-border-primary rounded-lg overflow-hidden">
                <thead>
                  <tr className="bg-surface-secondary">
                    <th className="px-4 py-2.5 text-left text-xs font-semibold text-text-muted uppercase tracking-wider">Option</th>
                    <th className="px-4 py-2.5 text-left text-xs font-semibold text-text-muted uppercase tracking-wider">Default</th>
                    <th className="px-4 py-2.5 text-left text-xs font-semibold text-text-muted uppercase tracking-wider">Description</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border-subtle">
                  <tr><td className="px-4 py-2 font-mono text-xs text-accent">enabled</td><td className="px-4 py-2 text-text-muted text-xs">true</td><td className="px-4 py-2 text-text-secondary text-xs">Enable/disable all monitoring</td></tr>
                  <tr><td className="px-4 py-2 font-mono text-xs text-accent">exporter</td><td className="px-4 py-2 text-text-muted text-xs">sidmonitor</td><td className="px-4 py-2 text-text-secondary text-xs">Exporter driver (sidmonitor, log, null)</td></tr>
                  <tr><td className="px-4 py-2 font-mono text-xs text-accent">api_key</td><td className="px-4 py-2 text-text-muted text-xs">—</td><td className="px-4 py-2 text-text-secondary text-xs">Project API key from SidMonitor</td></tr>
                  <tr><td className="px-4 py-2 font-mono text-xs text-accent">endpoint</td><td className="px-4 py-2 text-text-muted text-xs">—</td><td className="px-4 py-2 text-text-secondary text-xs">SidMonitor backend URL</td></tr>
                  <tr><td className="px-4 py-2 font-mono text-xs text-accent">buffer_size</td><td className="px-4 py-2 text-text-muted text-xs">100</td><td className="px-4 py-2 text-text-secondary text-xs">Max entries buffered before flush</td></tr>
                  <tr><td className="px-4 py-2 font-mono text-xs text-accent">slow_threshold_ms</td><td className="px-4 py-2 text-text-muted text-xs">1000</td><td className="px-4 py-2 text-text-secondary text-xs">Slow request threshold (ms)</td></tr>
                  <tr><td className="px-4 py-2 font-mono text-xs text-accent">record_body</td><td className="px-4 py-2 text-text-muted text-xs">false</td><td className="px-4 py-2 text-text-secondary text-xs">Record request/response body</td></tr>
                </tbody>
              </table>
            </div>

            <Heading id="laravel-service-mapping">Service Mapping</Heading>
            <Para>
              The SDK auto-detects common third-party services from outbound request URLs (Stripe, AWS, Twilio, etc.).
              You can add custom mappings:
            </Para>
            <CodeBlock
              lang="php"
              id="l-svc"
              code={`// config/observatory.php
'service_mapping' => [
    'api.internal-service.com' => 'internal-api',
    '*.stripe.com' => 'stripe',
    'sqs.*.amazonaws.com' => 'aws-sqs',
],`}
            />

            <Heading id="laravel-excluded">Exclusions</Heading>
            <Para>Exclude specific routes or hosts from monitoring:</Para>
            <CodeBlock
              lang="php"
              id="l-exclude"
              code={`'excluded_paths' => [
    'health',
    'telescope/*',
    '_debugbar/*',
],

'excluded_hosts' => [
    'localhost',
    '127.0.0.1',
],`}
            />
          </section>

          {/* ══════════════════════════════════════════
              INBOUND MONITORING
             ══════════════════════════════════════════ */}
          <section id="inbound" className="scroll-mt-20 mb-14">
            <div className="flex items-center gap-2.5 mb-4">
              <Inbox className="w-5 h-5 text-accent" />
              <h2 className="text-lg font-bold text-text-primary">Inbound Monitoring</h2>
            </div>
            <Para>
              Tracks every incoming HTTP request to your application — method, URL, status code, response time,
              memory usage, user info, and exceptions.
            </Para>

            <Heading id="inbound-how">How It Works</Heading>
            <Para>
              The SDK registers a global middleware that captures request/response data. On each request:
            </Para>
            <ul className="list-disc ml-5 mb-4 space-y-1 text-sm text-text-secondary">
              <li>Records method, URL, status code, IP, user agent</li>
              <li>Measures response time and peak memory usage</li>
              <li>Captures authenticated user ID (if available)</li>
              <li>Logs unhandled exceptions with stack traces</li>
              <li>Buffers entries and flushes asynchronously to SidMonitor</li>
            </ul>

            <Heading id="inbound-filter">Filtering & Exclusions</Heading>
            <Para>
              Exclude health checks, debugging tools, or high-volume endpoints from monitoring
              using <InlineCode>excluded_paths</InlineCode> in your config. Patterns support wildcards.
            </Para>
            <CodeBlock
              lang="php"
              id="in-filter"
              code={`'excluded_paths' => [
    'health',          // Exact match
    'api/health/*',    // Wildcard
    'telescope/*',     // Telescope routes
    '_debugbar/*',     // Debug bar
],`}
            />

            <Heading id="inbound-body">Body Recording</Heading>
            <Para>
              Enable <InlineCode>record_body</InlineCode> to capture request and response bodies.
              Bodies are truncated at 16KB. Sensitive fields (<InlineCode>password</InlineCode>,{' '}
              <InlineCode>token</InlineCode>, <InlineCode>secret</InlineCode>) are automatically redacted.
            </Para>
            <Callout type="warning">
              Body recording increases storage usage significantly. Enable only in development or for specific debugging.
            </Callout>
          </section>

          {/* ══════════════════════════════════════════
              OUTBOUND MONITORING
             ══════════════════════════════════════════ */}
          <section id="outbound" className="scroll-mt-20 mb-14">
            <div className="flex items-center gap-2.5 mb-4">
              <ArrowRight className="w-5 h-5 text-accent" />
              <h2 className="text-lg font-bold text-text-primary">Outbound Monitoring</h2>
            </div>
            <Para>
              Monitors all HTTP calls your application makes to external APIs — latency, error rates, and
              service health at a glance.
            </Para>

            <Heading id="outbound-how">How It Works</Heading>
            <Para>
              The SDK hooks into Laravel's HTTP client (Guzzle). On Laravel 10.14+, it uses the built-in
              client events. For older versions, it falls back to a Guzzle middleware. Each outbound request records:
            </Para>
            <ul className="list-disc ml-5 mb-4 space-y-1 text-sm text-text-secondary">
              <li>Target URL, method, status code</li>
              <li>Latency (ms), request/response size</li>
              <li>Parent request ID for correlation</li>
              <li>Error code and message on failure</li>
              <li>Auto-detected service name</li>
            </ul>

            <Heading id="outbound-services">Service Detection</Heading>
            <Para>
              Common services are auto-detected by hostname (Stripe, AWS, Twilio, SendGrid, etc.).
              Custom services can be added via <InlineCode>service_mapping</InlineCode> config. The dashboard
              groups outbound requests by service for health monitoring.
            </Para>

            <Heading id="outbound-tracing">Request Tracing</Heading>
            <Para>
              Each outbound request includes a <InlineCode>parent_request_id</InlineCode> linking it to the inbound
              request that triggered it. This enables end-to-end tracing across your request lifecycle.
            </Para>
          </section>

          {/* ══════════════════════════════════════════
              JOBS & QUEUES
             ══════════════════════════════════════════ */}
          <section id="jobs" className="scroll-mt-20 mb-14">
            <div className="flex items-center gap-2.5 mb-4">
              <Briefcase className="w-5 h-5 text-accent" />
              <h2 className="text-lg font-bold text-text-primary">Jobs & Queues</h2>
            </div>
            <Para>
              Track queue job execution, measure performance, and detect failures in real time.
            </Para>

            <Heading id="jobs-tracking">Job Tracking</Heading>
            <Para>
              The SDK listens to Laravel's queue events and captures:
            </Para>
            <ul className="list-disc ml-5 mb-4 space-y-1 text-sm text-text-secondary">
              <li>Job class name, queue name, connection</li>
              <li>Execution duration and memory usage</li>
              <li>Status: completed, failed, or released</li>
              <li>Attempt count and max tries</li>
              <li>Payload data (when enabled)</li>
            </ul>

            <Heading id="jobs-failures">Failure Monitoring</Heading>
            <Para>
              Failed jobs are highlighted in the Jobs dashboard with exception details and stack traces.
              Use the <strong className="text-text-primary">Recent Failures</strong> widget to quickly identify
              recurring issues.
            </Para>
            <Callout type="info">
              Job payload recording is disabled by default. Enable <InlineCode>record_job_payload</InlineCode> in
              your config to capture payloads for debugging.
            </Callout>
          </section>

          {/* ══════════════════════════════════════════
              SCHEDULED TASKS
             ══════════════════════════════════════════ */}
          <section id="scheduled-tasks" className="scroll-mt-20 mb-14">
            <div className="flex items-center gap-2.5 mb-4">
              <Clock className="w-5 h-5 text-accent" />
              <h2 className="text-lg font-bold text-text-primary">Scheduled Tasks</h2>
            </div>
            <Para>
              Monitor cron job execution, detect missed runs, and track task duration over time.
            </Para>

            <Heading id="tasks-tracking">Task Tracking</Heading>
            <Para>
              The SDK hooks into Laravel's scheduler and records:
            </Para>
            <ul className="list-disc ml-5 mb-4 space-y-1 text-sm text-text-secondary">
              <li>Command/closure name and expression (cron schedule)</li>
              <li>Start time, end time, and duration</li>
              <li>Exit code and output (truncated)</li>
              <li>Memory usage and status (finished, failed, skipped)</li>
            </ul>

            <Heading id="tasks-missed">Missed Runs</Heading>
            <Para>
              SidMonitor detects tasks that were expected to run (based on their cron expression) but didn't
              execute. These appear in the <strong className="text-text-primary">Missed Tasks</strong> section of
              the Scheduler dashboard.
            </Para>
            <Callout type="tip">
              If a task is configured with <InlineCode>withoutOverlapping()</InlineCode>, skipped runs due to
              overlap are recorded as "skipped" rather than "missed."
            </Callout>
          </section>

          {/* ══════════════════════════════════════════
              FEEDBACK SYSTEM
             ══════════════════════════════════════════ */}
          <section id="feedback" className="scroll-mt-20 mb-14">
            <div className="flex items-center gap-2.5 mb-4">
              <MessageSquarePlus className="w-5 h-5 text-accent" />
              <h2 className="text-lg font-bold text-text-primary">Feedback System</h2>
            </div>
            <Para>
              Built-in bug reporting and feature requests. Users can submit feedback directly from the app,
              and admins can manage it from the Feedback page.
            </Para>

            <Heading id="feedback-widget">Widget</Heading>
            <Para>
              The floating feedback button appears in the bottom-right corner on every page. Click it to open
              a slide-out panel where you can:
            </Para>
            <ul className="list-disc ml-5 mb-4 space-y-1 text-sm text-text-secondary">
              <li>Select a category: Bug, Feature Request, Improvement, Question, Other</li>
              <li>Set priority: Low, Medium, High, Critical</li>
              <li>Provide a title and detailed description</li>
              <li>Current page URL is auto-captured</li>
            </ul>

            <Heading id="feedback-admin">Admin Page</Heading>
            <Para>
              Access the admin page via <strong className="text-text-primary">Feedback</strong> in the sidebar.
              Features include:
            </Para>
            <ul className="list-disc ml-5 mb-4 space-y-1 text-sm text-text-secondary">
              <li>Filter by status (Open, In Progress, Resolved, Closed) and category</li>
              <li>Expand entries to see full details</li>
              <li>Update status with one click</li>
              <li>Delete resolved or duplicate entries</li>
              <li>Pagination for large volumes</li>
            </ul>

            <Heading id="feedback-api">REST API</Heading>
            <Para>The Feedback API supports full CRUD operations:</Para>
            <div className="overflow-x-auto mb-4">
              <table className="w-full text-sm border border-border-primary rounded-lg overflow-hidden">
                <thead>
                  <tr className="bg-surface-secondary">
                    <th className="px-4 py-2.5 text-left text-xs font-semibold text-text-muted uppercase tracking-wider">Method</th>
                    <th className="px-4 py-2.5 text-left text-xs font-semibold text-text-muted uppercase tracking-wider">Endpoint</th>
                    <th className="px-4 py-2.5 text-left text-xs font-semibold text-text-muted uppercase tracking-wider">Description</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border-subtle">
                  <tr><td className="px-4 py-2 font-mono text-xs text-status-success">POST</td><td className="px-4 py-2 font-mono text-xs text-text-primary">/api/feedback</td><td className="px-4 py-2 text-text-secondary text-xs">Submit new feedback</td></tr>
                  <tr><td className="px-4 py-2 font-mono text-xs text-status-info">GET</td><td className="px-4 py-2 font-mono text-xs text-text-primary">/api/feedback</td><td className="px-4 py-2 text-text-secondary text-xs">List feedback (paginated, filterable)</td></tr>
                  <tr><td className="px-4 py-2 font-mono text-xs text-status-warning">PATCH</td><td className="px-4 py-2 font-mono text-xs text-text-primary">{'/api/feedback/{id}'}</td><td className="px-4 py-2 text-text-secondary text-xs">Update feedback status/priority</td></tr>
                  <tr><td className="px-4 py-2 font-mono text-xs text-status-error">DELETE</td><td className="px-4 py-2 font-mono text-xs text-text-primary">{'/api/feedback/{id}'}</td><td className="px-4 py-2 text-text-secondary text-xs">Delete feedback entry</td></tr>
                </tbody>
              </table>
            </div>
          </section>

          {/* ══════════════════════════════════════════
              MCP SERVER
             ══════════════════════════════════════════ */}
          <section id="mcp" className="scroll-mt-20 mb-14">
            <div className="flex items-center gap-2.5 mb-4">
              <Bot className="w-5 h-5 text-accent" />
              <h2 className="text-lg font-bold text-text-primary">MCP Server</h2>
            </div>
            <Para>
              Integrate SidMonitor with AI agents (Claude, Cursor, etc.) via the Model Context Protocol.
              Each MCP server instance is scoped to a single project via API key — no need to pass project IDs.
            </Para>

            <Heading id="mcp-overview">Overview</Heading>
            <Para>
              The MCP server provides 12 tools that let AI agents query your project's monitoring data,
              submit feedback, and analyze performance — all auto-scoped to the project identified by the API key.
            </Para>

            <Heading id="mcp-setup">Setup</Heading>
            <Para>
              Install MCP dependencies (separate from main backend to avoid conflicts):
            </Para>
            <CodeBlock lang="bash" id="mcp-install" code="pip install -r requirements-mcp.txt" />
            <Para>
              Add to your MCP client config (e.g. <InlineCode>claude_desktop_config.json</InlineCode>):
            </Para>
            <CodeBlock
              lang="json"
              id="mcp-config"
              code={`{
  "mcpServers": {
    "sidmonitor": {
      "command": "python",
      "args": ["mcp_server.py"],
      "cwd": "/path/to/sidmonitor/backend",
      "env": {
        "SIDMONITOR_API_KEY": "smk_your_project_api_key",
        "DATABASE_URL": "postgresql+asyncpg://user:pass@localhost:5432/sidmonitor",
        "CLICKHOUSE_HOST": "localhost",
        "CLICKHOUSE_PORT": "8123"
      }
    }
  }
}`}
            />
            <Callout type="info">
              The <InlineCode>SIDMONITOR_API_KEY</InlineCode> determines which project the MCP server has access to.
              Use a separate API key per project.
            </Callout>

            <Heading id="mcp-tools">Available Tools</Heading>
            <div className="overflow-x-auto mb-4">
              <table className="w-full text-sm border border-border-primary rounded-lg overflow-hidden">
                <thead>
                  <tr className="bg-surface-secondary">
                    <th className="px-4 py-2.5 text-left text-xs font-semibold text-text-muted uppercase tracking-wider">Tool</th>
                    <th className="px-4 py-2.5 text-left text-xs font-semibold text-text-muted uppercase tracking-wider">Description</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border-subtle">
                  <tr><td className="px-4 py-2 font-mono text-xs text-accent">get_project_info</td><td className="px-4 py-2 text-text-secondary text-xs">Project details (name, platform, org)</td></tr>
                  <tr><td className="px-4 py-2 font-mono text-xs text-accent">get_stats</td><td className="px-4 py-2 text-text-secondary text-xs">Overview stats (requests, errors, p95 latency)</td></tr>
                  <tr><td className="px-4 py-2 font-mono text-xs text-accent">get_errors</td><td className="px-4 py-2 text-text-secondary text-xs">Recent errors with stack traces</td></tr>
                  <tr><td className="px-4 py-2 font-mono text-xs text-accent">get_slow_endpoints</td><td className="px-4 py-2 text-text-secondary text-xs">Slowest endpoints by avg latency</td></tr>
                  <tr><td className="px-4 py-2 font-mono text-xs text-accent">get_top_endpoints</td><td className="px-4 py-2 text-text-secondary text-xs">Most-hit endpoints by request count</td></tr>
                  <tr><td className="px-4 py-2 font-mono text-xs text-accent">get_outbound_health</td><td className="px-4 py-2 text-text-secondary text-xs">External service health summary</td></tr>
                  <tr><td className="px-4 py-2 font-mono text-xs text-accent">get_recent_failures</td><td className="px-4 py-2 text-text-secondary text-xs">Recent 5xx errors and failures</td></tr>
                  <tr><td className="px-4 py-2 font-mono text-xs text-accent">get_job_stats</td><td className="px-4 py-2 text-text-secondary text-xs">Queue job performance summary</td></tr>
                  <tr><td className="px-4 py-2 font-mono text-xs text-accent">get_audit_logs</td><td className="px-4 py-2 text-text-secondary text-xs">Recent audit log entries</td></tr>
                  <tr><td className="px-4 py-2 font-mono text-xs text-accent">submit_feedback</td><td className="px-4 py-2 text-text-secondary text-xs">Submit bug report or feature request</td></tr>
                  <tr><td className="px-4 py-2 font-mono text-xs text-accent">list_feedback</td><td className="px-4 py-2 text-text-secondary text-xs">List feedback entries with filters</td></tr>
                  <tr><td className="px-4 py-2 font-mono text-xs text-accent">update_feedback_status</td><td className="px-4 py-2 text-text-secondary text-xs">Update feedback status</td></tr>
                </tbody>
              </table>
            </div>
          </section>

          {/* ══════════════════════════════════════════
              API REFERENCE
             ══════════════════════════════════════════ */}
          <section id="api-reference" className="scroll-mt-20 mb-14">
            <div className="flex items-center gap-2.5 mb-4">
              <Server className="w-5 h-5 text-accent" />
              <h2 className="text-lg font-bold text-text-primary">API Reference</h2>
            </div>
            <Para>
              SidMonitor exposes REST endpoints for SDK ingestion and data querying. All endpoints
              are prefixed with <InlineCode>/api</InlineCode>.
            </Para>

            <Heading id="api-auth">Authentication</Heading>
            <Para>Two authentication methods are used:</Para>
            <div className="space-y-3 mb-4">
              <div className="rounded-lg border border-border-primary bg-surface p-4">
                <div className="flex items-center gap-2 mb-1.5">
                  <Shield className="w-4 h-4 text-accent" />
                  <span className="text-sm font-semibold text-text-primary">JWT Bearer Token</span>
                  <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-status-info/15 text-status-info">Frontend</span>
                </div>
                <p className="text-xs text-text-secondary">
                  Used by the dashboard UI. Obtain via <InlineCode>POST /api/auth/login</InlineCode>. Pass
                  as <InlineCode>Authorization: Bearer &lt;token&gt;</InlineCode>.
                </p>
              </div>
              <div className="rounded-lg border border-border-primary bg-surface p-4">
                <div className="flex items-center gap-2 mb-1.5">
                  <Shield className="w-4 h-4 text-accent" />
                  <span className="text-sm font-semibold text-text-primary">API Key</span>
                  <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-status-success/15 text-status-success">SDK / MCP</span>
                </div>
                <p className="text-xs text-text-secondary">
                  Used by SDKs and MCP server. Pass as <InlineCode>X-API-Key: smk_...</InlineCode> header.
                  Keys are scoped to a project and support granular permissions.
                </p>
              </div>
            </div>

            <Heading id="api-ingest">Ingest Endpoints</Heading>
            <Para>SDKs use these endpoints to push monitoring data:</Para>
            <div className="overflow-x-auto mb-4">
              <table className="w-full text-sm border border-border-primary rounded-lg overflow-hidden">
                <thead>
                  <tr className="bg-surface-secondary">
                    <th className="px-4 py-2.5 text-left text-xs font-semibold text-text-muted uppercase tracking-wider">Method</th>
                    <th className="px-4 py-2.5 text-left text-xs font-semibold text-text-muted uppercase tracking-wider">Endpoint</th>
                    <th className="px-4 py-2.5 text-left text-xs font-semibold text-text-muted uppercase tracking-wider">Description</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border-subtle">
                  <tr><td className="px-4 py-2 font-mono text-xs text-status-success">POST</td><td className="px-4 py-2 font-mono text-xs text-text-primary">/api/ingest</td><td className="px-4 py-2 text-text-secondary text-xs">Single inbound log entry</td></tr>
                  <tr><td className="px-4 py-2 font-mono text-xs text-status-success">POST</td><td className="px-4 py-2 font-mono text-xs text-text-primary">/api/ingest/batch</td><td className="px-4 py-2 text-text-secondary text-xs">Batch inbound + outbound entries</td></tr>
                  <tr><td className="px-4 py-2 font-mono text-xs text-status-success">POST</td><td className="px-4 py-2 font-mono text-xs text-text-primary">/api/ingest/job</td><td className="px-4 py-2 text-text-secondary text-xs">Single job log entry</td></tr>
                  <tr><td className="px-4 py-2 font-mono text-xs text-status-success">POST</td><td className="px-4 py-2 font-mono text-xs text-text-primary">/api/ingest/scheduled-task</td><td className="px-4 py-2 text-text-secondary text-xs">Single scheduled task entry</td></tr>
                  <tr><td className="px-4 py-2 font-mono text-xs text-status-success">POST</td><td className="px-4 py-2 font-mono text-xs text-text-primary">/api/ingest/jobs/batch</td><td className="px-4 py-2 text-text-secondary text-xs">Batch jobs + scheduled tasks</td></tr>
                </tbody>
              </table>
            </div>
            <Callout type="info">
              All ingest endpoints require the <InlineCode>ingest:write</InlineCode> scope on the API key.
            </Callout>

            <Heading id="api-query">Query Endpoints</Heading>
            <Para>Dashboard and analytics endpoints (JWT auth required):</Para>
            <div className="overflow-x-auto mb-4">
              <table className="w-full text-sm border border-border-primary rounded-lg overflow-hidden">
                <thead>
                  <tr className="bg-surface-secondary">
                    <th className="px-4 py-2.5 text-left text-xs font-semibold text-text-muted uppercase tracking-wider">Group</th>
                    <th className="px-4 py-2.5 text-left text-xs font-semibold text-text-muted uppercase tracking-wider">Endpoints</th>
                    <th className="px-4 py-2.5 text-left text-xs font-semibold text-text-muted uppercase tracking-wider">Description</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border-subtle">
                  <tr><td className="px-4 py-2 text-xs font-medium text-text-primary">Dashboard</td><td className="px-4 py-2 font-mono text-xs text-text-muted">/api/stats/dashboard/*</td><td className="px-4 py-2 text-text-secondary text-xs">Overview stats, health, timeline</td></tr>
                  <tr><td className="px-4 py-2 text-xs font-medium text-text-primary">Traffic</td><td className="px-4 py-2 font-mono text-xs text-text-muted">/api/stats/traffic/*</td><td className="px-4 py-2 text-text-secondary text-xs">Throughput, peak hours, methods</td></tr>
                  <tr><td className="px-4 py-2 text-xs font-medium text-text-primary">Performance</td><td className="px-4 py-2 font-mono text-xs text-text-muted">/api/stats/performance/*</td><td className="px-4 py-2 text-text-secondary text-xs">Percentiles, slow endpoints, modules</td></tr>
                  <tr><td className="px-4 py-2 text-xs font-medium text-text-primary">Errors</td><td className="px-4 py-2 font-mono text-xs text-text-muted">/api/stats/errors/*</td><td className="px-4 py-2 text-text-secondary text-xs">Error rates, top errors, timeline</td></tr>
                  <tr><td className="px-4 py-2 text-xs font-medium text-text-primary">Users</td><td className="px-4 py-2 font-mono text-xs text-text-muted">/api/stats/users/*</td><td className="px-4 py-2 text-text-secondary text-xs">User activity, error-prone users</td></tr>
                  <tr><td className="px-4 py-2 text-xs font-medium text-text-primary">Logs</td><td className="px-4 py-2 font-mono text-xs text-text-muted">/api/logs, /api/inbound/*</td><td className="px-4 py-2 text-text-secondary text-xs">Log listing, filtering, details</td></tr>
                  <tr><td className="px-4 py-2 text-xs font-medium text-text-primary">Outbound</td><td className="px-4 py-2 font-mono text-xs text-text-muted">/api/outbound/*</td><td className="px-4 py-2 text-text-secondary text-xs">Outbound requests, service stats</td></tr>
                  <tr><td className="px-4 py-2 text-xs font-medium text-text-primary">Jobs</td><td className="px-4 py-2 font-mono text-xs text-text-muted">/api/v1/jobs/*</td><td className="px-4 py-2 text-text-secondary text-xs">Job listing, stats, failures</td></tr>
                </tbody>
              </table>
            </div>
          </section>

          {/* ══════════════════════════════════════════
              CONFIGURATION
             ══════════════════════════════════════════ */}
          <section id="configuration" className="scroll-mt-20 mb-14">
            <div className="flex items-center gap-2.5 mb-4">
              <Settings className="w-5 h-5 text-accent" />
              <h2 className="text-lg font-bold text-text-primary">Configuration</h2>
            </div>
            <Para>
              Environment variables and advanced settings for the SidMonitor backend.
            </Para>

            <Heading id="env-vars">Environment Variables</Heading>
            <div className="overflow-x-auto mb-4">
              <table className="w-full text-sm border border-border-primary rounded-lg overflow-hidden">
                <thead>
                  <tr className="bg-surface-secondary">
                    <th className="px-4 py-2.5 text-left text-xs font-semibold text-text-muted uppercase tracking-wider">Variable</th>
                    <th className="px-4 py-2.5 text-left text-xs font-semibold text-text-muted uppercase tracking-wider">Required</th>
                    <th className="px-4 py-2.5 text-left text-xs font-semibold text-text-muted uppercase tracking-wider">Description</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border-subtle">
                  <tr><td className="px-4 py-2 font-mono text-xs text-accent">DATABASE_URL</td><td className="px-4 py-2 text-xs text-status-error">Yes</td><td className="px-4 py-2 text-text-secondary text-xs">PostgreSQL connection string</td></tr>
                  <tr><td className="px-4 py-2 font-mono text-xs text-accent">JWT_SECRET_KEY</td><td className="px-4 py-2 text-xs text-status-error">Yes</td><td className="px-4 py-2 text-text-secondary text-xs">Secret for JWT token signing</td></tr>
                  <tr><td className="px-4 py-2 font-mono text-xs text-accent">CLICKHOUSE_HOST</td><td className="px-4 py-2 text-xs text-status-error">Yes</td><td className="px-4 py-2 text-text-secondary text-xs">ClickHouse server hostname</td></tr>
                  <tr><td className="px-4 py-2 font-mono text-xs text-accent">CLICKHOUSE_PORT</td><td className="px-4 py-2 text-xs text-text-muted">No</td><td className="px-4 py-2 text-text-secondary text-xs">ClickHouse HTTP port (default: 8123)</td></tr>
                  <tr><td className="px-4 py-2 font-mono text-xs text-accent">CLICKHOUSE_DATABASE</td><td className="px-4 py-2 text-xs text-text-muted">No</td><td className="px-4 py-2 text-text-secondary text-xs">ClickHouse database (default: sidmonitor)</td></tr>
                  <tr><td className="px-4 py-2 font-mono text-xs text-accent">CORS_ORIGINS</td><td className="px-4 py-2 text-xs text-text-muted">No</td><td className="px-4 py-2 text-text-secondary text-xs">Allowed origins (comma-separated)</td></tr>
                  <tr><td className="px-4 py-2 font-mono text-xs text-accent">POSTGRES_PASSWORD</td><td className="px-4 py-2 text-xs text-status-error">Yes</td><td className="px-4 py-2 text-text-secondary text-xs">PostgreSQL password</td></tr>
                </tbody>
              </table>
            </div>

            <Heading id="retention">Data Retention</Heading>
            <Para>
              ClickHouse tables use TTL (Time-to-Live) for automatic data expiration:
            </Para>
            <div className="overflow-x-auto mb-4">
              <table className="w-full text-sm border border-border-primary rounded-lg overflow-hidden">
                <thead>
                  <tr className="bg-surface-secondary">
                    <th className="px-4 py-2.5 text-left text-xs font-semibold text-text-muted uppercase tracking-wider">Table</th>
                    <th className="px-4 py-2.5 text-left text-xs font-semibold text-text-muted uppercase tracking-wider">Default TTL</th>
                    <th className="px-4 py-2.5 text-left text-xs font-semibold text-text-muted uppercase tracking-wider">Notes</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border-subtle">
                  <tr><td className="px-4 py-2 font-mono text-xs text-text-primary">logs</td><td className="px-4 py-2 text-xs text-text-secondary">90 days</td><td className="px-4 py-2 text-text-muted text-xs">Inbound HTTP requests</td></tr>
                  <tr><td className="px-4 py-2 font-mono text-xs text-text-primary">outbound_logs</td><td className="px-4 py-2 text-xs text-text-secondary">90 days</td><td className="px-4 py-2 text-text-muted text-xs">Outbound API calls</td></tr>
                  <tr><td className="px-4 py-2 font-mono text-xs text-text-primary">job_logs</td><td className="px-4 py-2 text-xs text-text-secondary">90 days</td><td className="px-4 py-2 text-text-muted text-xs">Queue job executions</td></tr>
                  <tr><td className="px-4 py-2 font-mono text-xs text-text-primary">scheduled_task_logs</td><td className="px-4 py-2 text-xs text-text-secondary">90 days</td><td className="px-4 py-2 text-text-muted text-xs">Scheduled task runs</td></tr>
                  <tr><td className="px-4 py-2 font-mono text-xs text-text-primary">*_stats_*</td><td className="px-4 py-2 text-xs text-text-secondary">180 days</td><td className="px-4 py-2 text-text-muted text-xs">Materialized views (aggregated)</td></tr>
                </tbody>
              </table>
            </div>
            <Callout type="tip">
              TTL values can be customized in the ClickHouse table definitions
              under <InlineCode>clickhouse/init/</InlineCode>.
            </Callout>

            <Heading id="circuit-breaker">Circuit Breaker</Heading>
            <Para>
              The Laravel SDK includes a circuit breaker to prevent cascading failures when SidMonitor is unreachable.
            </Para>
            <div className="overflow-x-auto mb-4">
              <table className="w-full text-sm border border-border-primary rounded-lg overflow-hidden">
                <thead>
                  <tr className="bg-surface-secondary">
                    <th className="px-4 py-2.5 text-left text-xs font-semibold text-text-muted uppercase tracking-wider">Setting</th>
                    <th className="px-4 py-2.5 text-left text-xs font-semibold text-text-muted uppercase tracking-wider">Default</th>
                    <th className="px-4 py-2.5 text-left text-xs font-semibold text-text-muted uppercase tracking-wider">Description</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border-subtle">
                  <tr><td className="px-4 py-2 font-mono text-xs text-accent">failure_threshold</td><td className="px-4 py-2 text-xs text-text-muted">5</td><td className="px-4 py-2 text-text-secondary text-xs">Consecutive failures before opening circuit</td></tr>
                  <tr><td className="px-4 py-2 font-mono text-xs text-accent">cooldown_seconds</td><td className="px-4 py-2 text-xs text-text-muted">60</td><td className="px-4 py-2 text-text-secondary text-xs">Wait time before retrying after circuit opens</td></tr>
                  <tr><td className="px-4 py-2 font-mono text-xs text-accent">max_buffer_size</td><td className="px-4 py-2 text-xs text-text-muted">500</td><td className="px-4 py-2 text-text-secondary text-xs">Max buffered entries (trimmed on overflow)</td></tr>
                </tbody>
              </table>
            </div>
            <Para>
              When the circuit is open, new entries are silently dropped until the cooldown expires and a
              probe request succeeds. This ensures your application performance is never affected by SidMonitor downtime.
            </Para>
          </section>

          {/* ══════════════════════════════════════════
              HELP LINKS
             ══════════════════════════════════════════ */}
          <section className="rounded-lg border border-border-primary bg-surface p-6">
            <h2 className="text-sm font-semibold text-text-primary mb-3">Need more help?</h2>
            <div className="flex flex-wrap gap-4">
              <a
                href="https://github.com/junixlabs/sidmonitor"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-sm text-accent hover:underline"
              >
                GitHub Repository
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
              <a
                href="https://github.com/junixlabs/laravel-observatory"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-sm text-accent hover:underline"
              >
                Laravel SDK
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
              <a
                href="https://github.com/junixlabs/sidmonitor/issues"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-sm text-accent hover:underline"
              >
                Report an Issue
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
            </div>
          </section>
        </main>
      </div>
    </div>
  )
}
