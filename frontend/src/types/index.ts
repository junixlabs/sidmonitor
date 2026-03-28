export interface LogEntry {
  id: string
  request_id: string
  timestamp: string
  endpoint: string
  method: string
  status_code: number
  response_time_ms: number
  user_id?: string
  user_name?: string
  module?: string
  tags?: string[]
  is_outbound: boolean
  third_party_service?: string
}

export interface StatTrend {
  value: number
  is_positive: boolean
}

export interface DashboardStats {
  total_requests: number
  error_rate: number
  avg_response_time: number
  requests_per_minute: number
  total_requests_trend?: StatTrend
  error_rate_trend?: StatTrend
  avg_response_time_trend?: StatTrend
  requests_per_minute_trend?: StatTrend
}

export interface TopEndpoint {
  endpoint: string
  method: string
  request_count: number
  avg_response_time: number
  error_rate: number
  error_count: number
}

export interface ServiceHealth {
  service_name: string
  total_requests: number
  successful: number
  failed: number
  success_rate: number
  avg_response_time: number
}

export interface ModuleHealth {
  module_name: string
  total_requests: number
  success_count: number
  error_count: number
  success_rate: number
  avg_response_time: number
}

export interface TimeSeriesPoint {
  timestamp: string
  requests: number
  errors: number
}

export interface FilterParams {
  status?: string
  endpoint?: string
  module?: string
  user?: string
  request_id?: string
  start_date?: string
  end_date?: string
  page?: number
  page_size?: number
  is_outbound?: boolean
}

export interface PaginatedResponse<T> {
  data: T[]
  total: number
  page: number
  page_size: number
  total_pages: number
}

export interface TimeSeriesParams {
  start_date?: string
  end_date?: string
  interval?: 'minute' | 'hour' | 'day'
  module?: string
  endpoint?: string
}

export interface ProjectSettings {
  project_name: string
  dsn_host: string
  dsn_endpoint: string
  api_key_count: number
  api_key_preview?: string
}

export interface DSNInfo {
  format: string
  example: string
  host: string
  endpoint: string
  has_api_key: boolean
}

export interface DsnResponse {
  dsn: string
}

export interface ApiKey {
  id: string
  name: string
  prefix: string
  created_at: string
  last_used_at?: string
}

export interface ApiKeyCreateResponse {
  id: string
  name: string
  key: string
  prefix: string
  created_at: string
}

export interface ApiKeyListResponse {
  api_keys: ApiKey[]
}

// Multi-tenant types
export interface User {
  id: string
  email: string
  name: string
  avatar_url?: string
  created_at: string
}

export interface Organization {
  id: string
  name: string
  slug: string
  plan: string
  owner_id: string
  created_at: string
}

export interface OrganizationMember {
  id: string
  user_id: string
  user_email: string
  user_name: string
  role: 'owner' | 'admin' | 'member'
  joined_at?: string
}

export interface InviteMemberRequest {
  email: string
  role: 'owner' | 'admin' | 'member'
}

export interface MemberRoleUpdate {
  role: 'owner' | 'admin' | 'member'
}

export interface Project {
  id: string
  name: string
  slug: string
  platform: string
  environment: string
  dsn: string
  created_at: string
  created_by: string
}

export interface ProjectApiKey {
  id: string
  name: string
  key_prefix: string
  key?: string // Only returned on creation
  scopes: string[]
  created_at: string
  last_used_at?: string
}

export interface AuthResponse {
  access_token: string
  token_type: string
  user: User
}

export interface LoginCredentials {
  email: string
  password: string
}

export interface RegisterData {
  email: string
  password: string
  name: string
}

export interface UserUpdate {
  name?: string
  avatar_url?: string
}

// Dashboard tab types
export type DashboardTab = 'all' | 'inbound' | 'outbound'

export interface TabCounts {
  all: number
  inbound: number
  outbound: number
}

// Job monitoring types
export type JobStatus = 'started' | 'completed' | 'failed' | 'retrying'

export interface JobLog {
  job_id: string
  job_uuid: string
  project_id: string
  timestamp: string
  job_class: string
  job_name: string
  queue_name: string
  connection: string
  status: JobStatus
  started_at: string
  completed_at?: string
  duration_ms?: number
  payload?: string
  attempt_number: number
  max_attempts: number
  exception_class?: string
  exception_message?: string
  exception_trace?: string
  user_id?: string
  memory_usage_mb?: number
}

export interface QueueHealth {
  queue_name: string
  total_executions: number
  success_count: number
  failure_count: number
  avg_duration_ms: number
}

export interface JobClassHealth {
  job_class: string
  total_executions: number
  success_count: number
  failure_count: number
  avg_duration_ms: number
}

export interface RecentFailure {
  job_id: string
  job_class: string
  timestamp: string
  exception_message: string
}

export interface JobStats {
  total_executions: number
  success_count: number
  failure_count: number
  retrying_count: number
  pending_count: number
  cancelled_count: number
  timeout_count: number
  success_rate: number
  avg_duration_ms: number
  p50_duration_ms: number
  p95_duration_ms: number
  p99_duration_ms: number
  by_queue: QueueHealth[]
  by_job_class: JobClassHealth[]
  recent_failures: RecentFailure[]
}

export interface JobTimelinePoint {
  timestamp: string
  total: number
  success: number
  failed: number
  retrying: number
  pending: number
  cancelled: number
  timeout: number
}

export interface JobFilterParams {
  project_id?: string
  queue_name?: string
  job_class?: string
  status?: JobStatus
  start_date?: string
  end_date?: string
  page?: number
  page_size?: number
}

export interface JobSummary {
  job_class: string
  job_name: string
  total_executions: number
  success_count: number
  failure_count: number
  success_rate: number
  avg_duration_ms: number
  last_run_at?: string
  last_status?: JobStatus
}

// Error Analytics types
export interface ErrorCategory {
  count: number
  percentage: number
}

export interface StatusCodeBreakdown {
  status_code: number
  count: number
  percentage: number
  description: string
}

export interface ErrorBreakdown {
  total_errors: number
  client_errors_4xx: ErrorCategory
  server_errors_5xx: ErrorCategory
  by_status_code: StatusCodeBreakdown[]
}

export interface ErrorEndpointStatus {
  status_code: number
  count: number
}

export interface ErrorEndpoint {
  endpoint: string
  method: string
  total_requests: number
  error_count: number
  error_rate: number
  top_errors: ErrorEndpointStatus[]
}

export interface ErrorTimelinePoint {
  timestamp: string
  total_errors: number
  errors_4xx: number
  errors_5xx: number
}

// Scheduled task types
export type ScheduledTaskStatus = 'scheduled' | 'running' | 'completed' | 'failed' | 'skipped' | 'missed'

export interface ScheduledTaskLog {
  task_id: string
  project_id: string
  timestamp: string
  command: string
  description?: string
  expression: string
  timezone: string
  status: ScheduledTaskStatus
  scheduled_at: string
  started_at?: string
  completed_at?: string
  duration_ms?: number
  exit_code?: number
  output?: string
  error_message?: string
  error_trace?: string
  without_overlapping: boolean
  mutex_name?: string
  expected_run_time: string
  delay_ms?: number
}

export interface CommandHealth {
  command: string
  total_executions: number
  success_count: number
  failure_count: number
  missed_count: number
  avg_duration_ms: number
  avg_delay_ms: number
}

export interface ScheduledTaskFailure {
  task_id: string
  command: string
  timestamp: string
  error_message?: string
}

export interface MissedTask {
  task_id: string
  command: string
  scheduled_at: string
  delay_ms: number
}

export interface ScheduledTaskStats {
  total_executions: number
  success_count: number
  failure_count: number
  missed_count: number
  success_rate: number
  avg_duration_ms: number
  avg_delay_ms: number
  by_command: CommandHealth[]
  recent_failures: ScheduledTaskFailure[]
  missed_tasks: MissedTask[]
}

export interface ScheduledTaskFilterParams {
  project_id?: string
  command?: string
  status?: ScheduledTaskStatus
  start_date?: string
  end_date?: string
  page?: number
  page_size?: number
}

// Global Dashboard types
export interface ProjectStats {
  project_id: string
  project_name: string
  total_requests: number
  error_rate: number
  avg_response_time: number
  health_status: 'healthy' | 'warning' | 'critical'
}

export interface GlobalDashboardStats {
  total_projects: number
  total_requests: number
  overall_error_rate: number
  projects: ProjectStats[]
  most_active_projects: ProjectStats[]
}

// Traffic pattern types
export interface TrafficByMethod {
  method: string
  count: number
  percentage: number
  avg_response_time: number
  error_rate: number
}

export interface PeakHourStats {
  hour: number
  avg_requests: number
  peak_requests: number
  avg_response_time: number
}

export interface TrafficByDay {
  day_of_week: number
  day_name: string
  avg_requests: number
  peak_requests: number
}

export interface ThroughputTimeline {
  timestamp: string
  requests_per_minute: number
}

export interface ThroughputStats {
  avg_requests_per_minute: number
  peak_requests_per_minute: number
  avg_requests_per_second: number
  timeline: ThroughputTimeline[]
}

// Performance Percentiles types
export interface PerformancePercentiles {
  p50: number
  p75: number
  p90: number
  p95: number
  p99: number
  max: number
  min: number
  avg: number
  total_requests: number
}

export interface SlowEndpoint {
  endpoint: string
  method: string
  avg_response_time: number
  p95_response_time: number
  request_count: number
}

export interface SlowRequestsSummary {
  total_requests: number
  slow_count: number
  slow_percentage: number
  slowest_endpoints: SlowEndpoint[]
}

export interface PerformanceTimelinePoint {
  timestamp: string
  p50: number
  p95: number
  p99: number
  avg: number
}

// User Analytics types
export interface UserStats {
  user_id: string
  user_name?: string
  total_requests: number
  error_count: number
  error_rate: number
  avg_response_time: number
}

export interface UserActivityPoint {
  timestamp: string
  requests: number
  errors: number
}

export interface UserWithErrors {
  user_id: string
  user_name?: string
  total_requests: number
  error_count: number
  error_rate: number
}

// Outbound API Monitoring types
export interface OutboundLog {
  id: string
  project_id: string
  request_id: string
  parent_request_id: string
  trace_id: string
  span_id: string
  timestamp: string
  service_name: string
  target_host: string
  target_url: string
  method: string
  status_code: number
  latency_ms: number
  is_success: boolean
  request_size: number
  response_size: number
  error_message: string
  error_code: string
  retry_count: number
  module: string
  user_id: string
  tags: string[]
}

export interface OutboundLogDetail extends OutboundLog {
  request_headers: string
  response_headers: string
  request_body: string
  response_body: string
  metadata: string
}

export interface OutboundLogFilterParams {
  project_id?: string
  service_name?: string
  target_host?: string
  method?: string
  status?: string
  trace_id?: string
  start_date?: string
  end_date?: string
  page?: number
  page_size?: number
}

export interface OutboundStats {
  total_requests: number
  success_count: number
  failure_count: number
  success_rate: number
  avg_latency_ms: number
  p95_latency_ms: number
  services_count: number
  timeout_count: number
  total_retries: number
}

export interface OutboundServiceHealth {
  service_name: string
  total_requests: number
  success_count: number
  failure_count: number
  success_rate: number
  avg_latency_ms: number
  p95_latency_ms: number
  error_rate: number
}

export interface OutboundHostHealth {
  target_host: string
  total_requests: number
  success_count: number
  failure_count: number
  success_rate: number
  avg_latency_ms: number
}

export interface OutboundEndpointStats {
  endpoint_pattern: string
  method: string
  total_requests: number
  success_count: number
  failure_count: number
  success_rate: number
  error_rate: number
  avg_latency_ms: number
  p95_latency_ms: number
  p99_latency_ms: number
  avg_request_size: number
  avg_response_size: number
}

// Inbound API Monitoring types
export interface InboundLog {
  id: string
  request_id: string
  timestamp: string
  endpoint: string
  method: string
  status_code: number
  response_time_ms: number
  user_id?: string
  user_name?: string
  module?: string
  tags: string[]
}

export interface InboundLogDetail extends InboundLog {
  request_body?: string
  response_body?: string
}

export interface InboundLogFilterParams {
  project_id?: string
  module?: string
  endpoint?: string
  method?: string
  status?: string
  user_id?: string
  request_id?: string
  start_date?: string
  end_date?: string
  page?: number
  page_size?: number
}

export interface InboundStats {
  total_requests: number
  success_count: number
  error_count: number
  success_rate: number
  avg_response_time_ms: number
  p95_response_time_ms: number
  modules_count: number
}

export interface InboundModuleHealth {
  module: string  // Backend returns 'module' not 'module_name'
  total_requests: number
  success_count: number
  error_count: number  // Backend returns 'error_count' not 'failure_count'
  success_rate: number
  error_rate: number
  avg_response_time_ms: number
  p95_response_time_ms: number
}

// Audit log types
export interface AuditLogEntry {
  id: string
  org_id: string
  actor_id?: string
  actor_type: string
  actor_name?: string
  actor_email?: string
  action: string
  target_type?: string
  target_id?: string
  metadata?: Record<string, unknown>
  ip_address?: string
  created_at: string
}

export interface AuditLogListResponse {
  items: AuditLogEntry[]
  total: number
  page: number
  per_page: number
}

export interface InboundEndpointStats {
  endpoint_pattern: string  // Backend returns 'endpoint_pattern' not 'endpoint'
  method: string
  total_requests: number
  success_count: number
  error_count: number  // Backend returns 'error_count'
  success_rate: number
  error_rate: number
  avg_response_time_ms: number
  p95_response_time_ms: number
  p99_response_time_ms: number
}

// Feedback types
export type FeedbackCategory = 'bug' | 'feature' | 'improvement' | 'question' | 'other'
export type FeedbackPriority = 'low' | 'medium' | 'high' | 'critical'
export type FeedbackStatus = 'open' | 'in_progress' | 'resolved' | 'closed'

export interface FeedbackEntry {
  id: string
  org_id?: string
  project_id?: string
  user_id?: string
  user_name?: string
  user_email?: string
  category: FeedbackCategory
  title: string
  description: string
  priority: FeedbackPriority
  status: FeedbackStatus
  page_url?: string
  user_agent?: string
  screenshot_url?: string
  metadata?: Record<string, unknown>
  resolved_at?: string
  created_at: string
  updated_at: string
}

export interface FeedbackCreateData {
  category: FeedbackCategory
  title: string
  description: string
  priority?: FeedbackPriority
  page_url?: string
  metadata?: Record<string, unknown>
}

export interface FeedbackListResponse {
  items: FeedbackEntry[]
  total: number
  page: number
  per_page: number
}

// Endpoint Detail types
export interface EndpointDetailSummary {
  endpoint: string
  method: string
  request_count: number
  error_count: number
  error_rate: number
  avg_response_time: number
  p50_response_time: number
  p95_response_time: number
  p99_response_time: number
  requests_per_minute: number
}

export interface EndpointStatusCodeCount {
  status_code: number
  count: number
  percentage: number
}

export interface EndpointRecentError {
  request_id: string
  timestamp: string
  status_code: number
  response_time_ms: number
  user_id: string
  user_name: string
}

export interface EndpointDetail {
  summary: EndpointDetailSummary
  timeseries: TimeSeriesPoint[]
  latency_timeline: PerformanceTimelinePoint[]
  status_codes: EndpointStatusCodeCount[]
  recent_errors: EndpointRecentError[]
}

// Error Grouping types
export interface ErrorGroupInstance {
  request_id: string
  timestamp: string
  response_time_ms: number
  user_id: string
  user_name: string
}

export interface ErrorGroup {
  endpoint: string
  method: string
  status_code: number
  status_description: string
  count: number
  first_seen: string
  last_seen: string
  avg_response_time: number
  affected_users: number
  recent_instances: ErrorGroupInstance[]
}

export interface ErrorGroupsResponse {
  total_errors: number
  total_groups: number
  client_errors: number
  server_errors: number
  groups: ErrorGroup[]
}

// Saved Views types
export interface SavedView {
  id: string
  project_id: string
  user_id: string
  name: string
  filters: FilterParams
  color?: string
  is_default: boolean
  created_at: string
  updated_at: string
}
