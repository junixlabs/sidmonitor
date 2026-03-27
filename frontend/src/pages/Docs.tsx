import {
  BookOpen,
  Rocket,
  Server,
  Code2,
  Settings,
  BarChart3,
  ExternalLink,
  Terminal,
  Briefcase,
  Clock,
  ArrowRight,
  Inbox,
} from 'lucide-react'

interface DocSection {
  title: string
  description: string
  icon: React.ReactNode
  links: { label: string; anchor: string }[]
}

const sections: DocSection[] = [
  {
    title: 'Getting Started',
    description: 'Set up SidMonitor and start monitoring your application in minutes.',
    icon: <Rocket className="w-5 h-5" />,
    links: [
      { label: 'Quick Start Guide', anchor: '#quick-start' },
      { label: 'Create a Project', anchor: '#create-project' },
      { label: 'Generate API Key', anchor: '#api-key' },
    ],
  },
  {
    title: 'Laravel SDK',
    description: 'Install and configure the Laravel Observatory package.',
    icon: <Code2 className="w-5 h-5" />,
    links: [
      { label: 'Installation', anchor: '#laravel-install' },
      { label: 'Configuration', anchor: '#laravel-config' },
      { label: 'Service Mapping', anchor: '#service-mapping' },
    ],
  },
  {
    title: 'Inbound Monitoring',
    description: 'Track incoming HTTP requests, response times, and error rates.',
    icon: <Inbox className="w-5 h-5" />,
    links: [
      { label: 'How It Works', anchor: '#inbound-how' },
      { label: 'Filtering & Exclusions', anchor: '#inbound-filter' },
      { label: 'Body Recording', anchor: '#inbound-body' },
    ],
  },
  {
    title: 'Outbound Monitoring',
    description: 'Monitor external API calls, latency, and third-party service health.',
    icon: <ArrowRight className="w-5 h-5" />,
    links: [
      { label: 'Guzzle Integration', anchor: '#outbound-guzzle' },
      { label: 'Service Detection', anchor: '#outbound-services' },
      { label: 'Tracing & Request IDs', anchor: '#outbound-tracing' },
    ],
  },
  {
    title: 'Jobs & Queues',
    description: 'Track queue job execution, failures, and performance.',
    icon: <Briefcase className="w-5 h-5" />,
    links: [
      { label: 'Job Tracking', anchor: '#jobs-tracking' },
      { label: 'Failure Monitoring', anchor: '#jobs-failures' },
      { label: 'Payload Recording', anchor: '#jobs-payload' },
    ],
  },
  {
    title: 'Scheduled Tasks',
    description: 'Monitor cron job execution, duration, and missed runs.',
    icon: <Clock className="w-5 h-5" />,
    links: [
      { label: 'Task Tracking', anchor: '#tasks-tracking' },
      { label: 'Output Logging', anchor: '#tasks-output' },
      { label: 'Overlap Detection', anchor: '#tasks-overlap' },
    ],
  },
  {
    title: 'Dashboard & Analytics',
    description: 'Understand your dashboard metrics and time-series data.',
    icon: <BarChart3 className="w-5 h-5" />,
    links: [
      { label: 'Dashboard Overview', anchor: '#dashboard' },
      { label: 'Time Range Filters', anchor: '#time-range' },
      { label: 'Exporting Data', anchor: '#export' },
    ],
  },
  {
    title: 'API Reference',
    description: 'REST API endpoints for ingestion and querying.',
    icon: <Server className="w-5 h-5" />,
    links: [
      { label: 'Authentication', anchor: '#api-auth' },
      { label: 'Ingest Endpoints', anchor: '#api-ingest' },
      { label: 'Query Endpoints', anchor: '#api-query' },
    ],
  },
  {
    title: 'Configuration',
    description: 'Advanced settings, environment variables, and tuning.',
    icon: <Settings className="w-5 h-5" />,
    links: [
      { label: 'Environment Variables', anchor: '#env-vars' },
      { label: 'Data Retention', anchor: '#retention' },
      { label: 'Circuit Breaker', anchor: '#circuit-breaker' },
    ],
  },
]

const quickStartSteps = [
  {
    step: 1,
    title: 'Install the SDK',
    code: 'composer require junixlabs/laravel-observatory',
  },
  {
    step: 2,
    title: 'Publish the config',
    code: 'php artisan vendor:publish --tag=observatory-config',
  },
  {
    step: 3,
    title: 'Set your API key',
    code: `# .env
OBSERVATORY_ENABLED=true
OBSERVATORY_EXPORTER=sidmonitor
SIDMONITOR_API_KEY=your-api-key-here
SIDMONITOR_ENDPOINT=https://your-sidmonitor-host`,
  },
  {
    step: 4,
    title: 'Deploy and monitor',
    code: '# Requests, jobs, and tasks are automatically tracked',
  },
]

export default function Docs() {
  return (
    <div className="max-w-4xl mx-auto py-8 px-4">
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-1">
          <BookOpen className="w-6 h-6 text-accent" />
          <h1 className="text-2xl font-bold text-text-primary">
            Help & Documentation
          </h1>
        </div>
        <p className="text-sm text-text-muted">
          Everything you need to set up, configure, and get the most out of SidMonitor.
        </p>
      </div>

      {/* Quick Start */}
      <section id="quick-start" className="mb-10">
        <h2 className="text-lg font-semibold text-text-primary mb-4 flex items-center gap-2">
          <Terminal className="w-5 h-5 text-accent" />
          Quick Start
        </h2>
        <div className="space-y-4">
          {quickStartSteps.map((s) => (
            <div key={s.step} className="rounded-lg border border-border-primary bg-surface p-4">
              <div className="flex items-center gap-3 mb-2">
                <span className="w-6 h-6 rounded-full bg-accent text-white text-xs font-bold flex items-center justify-center flex-shrink-0">
                  {s.step}
                </span>
                <span className="text-sm font-medium text-text-primary">{s.title}</span>
              </div>
              <pre className="text-xs bg-background rounded-md p-3 overflow-x-auto text-text-secondary">
                <code>{s.code}</code>
              </pre>
            </div>
          ))}
        </div>
      </section>

      {/* Documentation sections grid */}
      <section className="mb-10">
        <h2 className="text-lg font-semibold text-text-primary mb-4">
          Documentation
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {sections.map((section) => (
            <div
              key={section.title}
              className="rounded-lg border border-border-primary bg-surface p-4 hover:border-accent/50 transition-colors"
            >
              <div className="flex items-center gap-2 mb-2">
                <span className="text-accent">{section.icon}</span>
                <h3 className="text-sm font-semibold text-text-primary">{section.title}</h3>
              </div>
              <p className="text-xs text-text-muted mb-3">{section.description}</p>
              <ul className="space-y-1">
                {section.links.map((link) => (
                  <li key={link.anchor}>
                    <a
                      href={link.anchor}
                      className="text-xs text-accent hover:underline"
                    >
                      {link.label}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </section>

      {/* Help links */}
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
    </div>
  )
}
