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

export interface DashboardStats {
  total_requests: number
  error_rate: number
  avg_response_time: number
  requests_per_minute: number
}

export interface FilterParams {
  status?: string
  endpoint?: string
  module?: string
  user?: string
  start_date?: string
  end_date?: string
  page?: number
  page_size?: number
}

export interface PaginatedResponse<T> {
  data: T[]
  total: number
  page: number
  page_size: number
  total_pages: number
}
