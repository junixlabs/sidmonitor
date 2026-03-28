"""
Pydantic models for statistics and dashboard response schemas.
"""
from typing import Optional

from pydantic import BaseModel, Field


class StatTrend(BaseModel):
    """Trend indicator comparing current period to previous period."""
    value: float = Field(..., description="Percentage change from previous period")
    is_positive: bool = Field(..., description="Whether the trend direction is positive (true = improving)")


class DashboardStats(BaseModel):
    """Main dashboard statistics overview for a project."""
    total_requests: int = Field(..., description="Total number of requests in the selected period")
    error_rate: float = Field(..., description="Error rate percentage (0-100)")
    avg_response_time: float = Field(..., description="Average response time in milliseconds")
    requests_per_minute: float = Field(..., description="Average requests per minute")
    total_requests_trend: Optional[StatTrend] = Field(None, description="Trend comparison for total requests vs previous period")
    error_rate_trend: Optional[StatTrend] = Field(None, description="Trend comparison for error rate vs previous period")
    avg_response_time_trend: Optional[StatTrend] = Field(None, description="Trend comparison for avg response time vs previous period")
    requests_per_minute_trend: Optional[StatTrend] = Field(None, description="Trend comparison for requests per minute vs previous period")


class TimeSeriesData(BaseModel):
    """Single data point in a time series."""
    timestamp: str = Field(..., description="Time bucket timestamp (ISO format)")
    value: float = Field(..., description="Metric value at this time point")


class EndpointStats(BaseModel):
    """Statistics for a specific API endpoint."""
    endpoint: str = Field(..., description="Endpoint path pattern")
    method: str = Field(..., description="HTTP method (GET, POST, etc.)")
    request_count: int = Field(..., description="Total number of requests")
    avg_response_time: float = Field(..., description="Average response time in milliseconds")
    error_rate: float = Field(..., description="Error rate percentage (0-100)")
    error_count: int = Field(..., description="Total number of error responses (4xx/5xx)")


class ServiceHealth(BaseModel):
    """Health status of an external service (outbound)."""
    service_name: str = Field(..., description="Third-party service name")
    total_requests: int = Field(..., description="Total outbound requests to this service")
    successful: int = Field(..., description="Number of successful requests")
    failed: int = Field(..., description="Number of failed requests")
    success_rate: float = Field(..., description="Success rate percentage (0-100)")
    avg_response_time: float = Field(..., description="Average latency in milliseconds")


class TimeSeriesPoint(BaseModel):
    """Time series point with request and error counts."""
    timestamp: str = Field(..., description="Time bucket timestamp (ISO format)")
    requests: int = Field(..., description="Number of requests in this time bucket")
    errors: int = Field(..., description="Number of errors in this time bucket")


class RequestCounts(BaseModel):
    """Breakdown of request counts by direction."""
    all: int = Field(..., description="Total requests (inbound + outbound)")
    inbound: int = Field(..., description="Inbound requests count")
    outbound: int = Field(..., description="Outbound requests count")


class ModuleHealth(BaseModel):
    """Health status of an application module."""
    module_name: str = Field(..., description="Application module name")
    total_requests: int = Field(..., description="Total requests handled by this module")
    success_count: int = Field(..., description="Number of successful requests (2xx/3xx)")
    error_count: int = Field(..., description="Number of error requests (4xx/5xx)")
    success_rate: float = Field(..., description="Success rate percentage (0-100)")
    avg_response_time: float = Field(..., description="Average response time in milliseconds")


class ProjectStats(BaseModel):
    """Statistics summary for a single project (used in global dashboard)."""
    project_id: str = Field(..., description="Project UUID")
    project_name: str = Field(..., description="Project display name")
    total_requests: int = Field(..., description="Total requests in the period")
    error_rate: float = Field(..., description="Error rate percentage (0-100)")
    avg_response_time: float = Field(..., description="Average response time in milliseconds")
    health_status: str = Field(..., description="Health status: 'healthy', 'warning', or 'critical'")


class GlobalDashboardStats(BaseModel):
    """Global dashboard showing overview across all projects."""
    total_projects: int = Field(..., description="Total number of monitored projects")
    total_requests: int = Field(..., description="Total requests across all projects")
    overall_error_rate: float = Field(..., description="Weighted error rate across all projects (0-100)")
    projects: list[ProjectStats] = Field(..., description="Per-project statistics")
    most_active_projects: list[ProjectStats] = Field(..., description="Top projects by request volume")


class UserStats(BaseModel):
    """Statistics for a specific user's activity."""
    user_id: str = Field(..., description="User identifier")
    user_name: str = Field(..., description="User display name")
    total_requests: int = Field(..., description="Total requests by this user")
    error_count: int = Field(..., description="Number of error responses for this user")
    error_rate: float = Field(..., description="User's error rate percentage (0-100)")
    avg_response_time: float = Field(..., description="Average response time for this user's requests in milliseconds")


class UserActivityPoint(BaseModel):
    """Time series point for user activity."""
    timestamp: str = Field(..., description="Time bucket timestamp (ISO format)")
    requests: int = Field(..., description="Number of requests in this time bucket")
    errors: int = Field(..., description="Number of errors in this time bucket")


class UserWithErrors(BaseModel):
    """User with highest error rates."""
    user_id: str = Field(..., description="User identifier")
    user_name: str = Field(..., description="User display name")
    total_requests: int = Field(..., description="Total requests by this user")
    error_count: int = Field(..., description="Number of error responses")
    error_rate: float = Field(..., description="Error rate percentage (0-100)")


class PerformancePercentiles(BaseModel):
    """Response time distribution percentiles."""
    p50: float = Field(..., description="50th percentile (median) response time in milliseconds")
    p75: float = Field(..., description="75th percentile response time in milliseconds")
    p90: float = Field(..., description="90th percentile response time in milliseconds")
    p95: float = Field(..., description="95th percentile response time in milliseconds")
    p99: float = Field(..., description="99th percentile response time in milliseconds")
    max: float = Field(..., description="Maximum response time in milliseconds")
    min: float = Field(..., description="Minimum response time in milliseconds")
    avg: float = Field(..., description="Average response time in milliseconds")
    total_requests: int = Field(..., description="Total number of requests analyzed")


class SlowestEndpoint(BaseModel):
    """Endpoint with the slowest average response time."""
    endpoint: str = Field(..., description="Endpoint path pattern")
    method: str = Field(..., description="HTTP method")
    avg_response_time: float = Field(..., description="Average response time in milliseconds")
    p95_response_time: float = Field(..., description="95th percentile response time in milliseconds")
    request_count: int = Field(..., description="Number of requests")


class SlowRequestsSummary(BaseModel):
    """Summary of slow requests (exceeding a threshold)."""
    total_requests: int = Field(..., description="Total number of requests analyzed")
    slow_count: int = Field(..., description="Number of requests exceeding the slow threshold")
    slow_percentage: float = Field(..., description="Percentage of slow requests (0-100)")
    slowest_endpoints: list[SlowestEndpoint] = Field(..., description="Endpoints with the slowest response times")


class PerformanceTimelinePoint(BaseModel):
    """Time series point with response time percentiles."""
    timestamp: str = Field(..., description="Time bucket timestamp (ISO format)")
    p50: float = Field(..., description="50th percentile response time in milliseconds")
    p95: float = Field(..., description="95th percentile response time in milliseconds")
    p99: float = Field(..., description="99th percentile response time in milliseconds")
    avg: float = Field(..., description="Average response time in milliseconds")


class ErrorCategory(BaseModel):
    """Error count and percentage for a category (4xx or 5xx)."""
    count: int = Field(..., description="Number of errors in this category")
    percentage: float = Field(..., description="Percentage of total errors (0-100)")


class StatusCodeBreakdown(BaseModel):
    """Breakdown of a specific HTTP status code."""
    status_code: int = Field(..., description="HTTP status code")
    count: int = Field(..., description="Number of responses with this status code")
    percentage: float = Field(..., description="Percentage of total errors (0-100)")
    description: str = Field(..., description="Human-readable status code description")


class ErrorBreakdown(BaseModel):
    """Detailed breakdown of errors by category and status code."""
    total_errors: int = Field(..., description="Total number of error responses")
    client_errors_4xx: ErrorCategory = Field(..., description="Client error (4xx) statistics")
    server_errors_5xx: ErrorCategory = Field(..., description="Server error (5xx) statistics")
    by_status_code: list[StatusCodeBreakdown] = Field(..., description="Per-status-code breakdown")


class ErrorEndpointStatus(BaseModel):
    """Status code count for an error-prone endpoint."""
    status_code: int = Field(..., description="HTTP status code")
    count: int = Field(..., description="Number of responses with this status code")


class ErrorEndpoint(BaseModel):
    """Endpoint with error statistics."""
    endpoint: str = Field(..., description="Endpoint path pattern")
    method: str = Field(..., description="HTTP method")
    total_requests: int = Field(..., description="Total requests to this endpoint")
    error_count: int = Field(..., description="Number of error responses (4xx/5xx)")
    error_rate: float = Field(..., description="Error rate percentage (0-100)")
    top_errors: list[ErrorEndpointStatus] = Field(..., description="Most common error status codes")


class ErrorTimelinePoint(BaseModel):
    """Time series point with error counts by category."""
    timestamp: str = Field(..., description="Time bucket timestamp (ISO format)")
    total_errors: int = Field(..., description="Total errors in this time bucket")
    errors_4xx: int = Field(..., description="Client errors (4xx) in this time bucket")
    errors_5xx: int = Field(..., description="Server errors (5xx) in this time bucket")


class TrafficByMethod(BaseModel):
    """Traffic statistics grouped by HTTP method."""
    method: str = Field(..., description="HTTP method (GET, POST, PUT, DELETE, etc.)")
    count: int = Field(..., description="Number of requests with this method")
    percentage: float = Field(..., description="Percentage of total traffic (0-100)")
    avg_response_time: float = Field(..., description="Average response time in milliseconds")
    error_rate: float = Field(..., description="Error rate percentage (0-100)")


class PeakHourStats(BaseModel):
    """Traffic statistics for a specific hour of the day."""
    hour: int = Field(..., description="Hour of the day (0-23)")
    avg_requests: float = Field(..., description="Average number of requests in this hour")
    peak_requests: int = Field(..., description="Maximum number of requests recorded in this hour")
    avg_response_time: float = Field(..., description="Average response time during this hour in milliseconds")


class TrafficByDay(BaseModel):
    """Traffic statistics for a specific day of the week."""
    day_of_week: int = Field(..., description="Day of the week (0=Sunday, 6=Saturday)")
    day_name: str = Field(..., description="Day name (e.g., 'Monday')")
    avg_requests: float = Field(..., description="Average number of requests on this day")
    peak_requests: int = Field(..., description="Maximum number of requests recorded on this day")


class ThroughputTimeline(BaseModel):
    """Time series point for throughput measurement."""
    timestamp: str = Field(..., description="Time bucket timestamp (ISO format)")
    requests_per_minute: float = Field(..., description="Requests per minute at this time point")


class ThroughputStats(BaseModel):
    """Throughput statistics with timeline."""
    avg_requests_per_minute: float = Field(..., description="Average requests per minute over the period")
    peak_requests_per_minute: float = Field(..., description="Peak requests per minute observed")
    avg_requests_per_second: float = Field(..., description="Average requests per second over the period")
    timeline: list[ThroughputTimeline] = Field(..., description="Throughput over time")


class EndpointDetailSummary(BaseModel):
    """Summary statistics for a specific endpoint."""
    endpoint: str = Field(..., description="Endpoint path pattern")
    method: str = Field(..., description="HTTP method")
    request_count: int = Field(..., description="Total number of requests")
    error_count: int = Field(..., description="Total error responses (4xx/5xx)")
    error_rate: float = Field(..., description="Error rate percentage (0-100)")
    avg_response_time: float = Field(..., description="Average response time in milliseconds")
    p50_response_time: float = Field(..., description="50th percentile response time in ms")
    p95_response_time: float = Field(..., description="95th percentile response time in ms")
    p99_response_time: float = Field(..., description="99th percentile response time in ms")
    requests_per_minute: float = Field(..., description="Average RPM")


class EndpointStatusCodeCount(BaseModel):
    """Status code distribution for an endpoint."""
    status_code: int = Field(..., description="HTTP status code")
    count: int = Field(..., description="Number of responses")
    percentage: float = Field(..., description="Percentage of total (0-100)")


class EndpointRecentError(BaseModel):
    """A recent error log entry for an endpoint."""
    request_id: str = Field(..., description="Request ID")
    timestamp: str = Field(..., description="Timestamp (ISO format)")
    status_code: int = Field(..., description="HTTP status code")
    response_time_ms: float = Field(..., description="Response time in ms")
    user_id: str = Field("", description="User ID if available")
    user_name: str = Field("", description="User name if available")


class EndpointDetail(BaseModel):
    """Complete detail view for a single endpoint."""
    summary: EndpointDetailSummary = Field(..., description="Summary statistics")
    timeseries: list[TimeSeriesPoint] = Field(..., description="Request/error counts over time")
    latency_timeline: list[PerformanceTimelinePoint] = Field(..., description="Latency percentiles over time")
    status_codes: list[EndpointStatusCodeCount] = Field(..., description="Status code distribution")
    recent_errors: list[EndpointRecentError] = Field(..., description="Recent error samples")
