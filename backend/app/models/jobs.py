from datetime import datetime
from typing import Optional

from pydantic import BaseModel, Field


class JobLogEntry(BaseModel):
    """Log entry for Laravel queue job execution."""
    job_id: str = Field(..., description="Unique job identifier")
    job_uuid: Optional[str] = Field(None, description="Laravel job UUID")
    job_class: str = Field(..., description="Job class name (e.g., App\\Jobs\\ProcessPayment)")
    job_name: str = Field(..., description="Human-readable job name")
    queue_name: str = Field(default="default", description="Queue name")
    connection: str = Field(default="sync", description="Queue connection")
    status: str = Field(..., description="Job status: pending, running, success, completed, failed, cancelled, timeout, retrying")
    started_at: datetime = Field(..., description="Job start timestamp")
    completed_at: Optional[datetime] = Field(None, description="Job completion timestamp")
    duration_ms: Optional[int] = Field(None, ge=0, description="Execution duration in milliseconds")
    payload: Optional[str] = Field(None, description="Job payload JSON string")
    attempt_number: int = Field(default=1, ge=1, description="Current attempt number")
    max_attempts: int = Field(default=1, ge=1, description="Maximum retry attempts")
    exception_class: Optional[str] = Field(None, description="Exception class on failure")
    exception_message: Optional[str] = Field(None, description="Exception message on failure")
    exception_trace: Optional[str] = Field(None, description="Stack trace on failure")
    user_id: Optional[str] = Field(None, description="User ID who triggered the job")
    memory_usage_mb: Optional[float] = Field(None, ge=0, description="Memory usage in MB")
    metadata: Optional[dict] = Field(default_factory=dict, description="Additional metadata")


class ScheduledTaskLogEntry(BaseModel):
    """Log entry for Laravel scheduled task execution."""
    task_id: str = Field(..., description="Unique task execution identifier")
    command: str = Field(..., description="Artisan command signature")
    description: Optional[str] = Field(None, description="Task description")
    expression: str = Field(..., description="Cron expression")
    timezone: str = Field(default="UTC", description="Task timezone")
    status: str = Field(..., description="Task status: scheduled, running, completed, failed, skipped, missed")
    scheduled_at: datetime = Field(..., description="When task was scheduled to run")
    started_at: Optional[datetime] = Field(None, description="Actual start timestamp")
    completed_at: Optional[datetime] = Field(None, description="Completion timestamp")
    duration_ms: Optional[int] = Field(None, ge=0, description="Execution duration in milliseconds")
    exit_code: Optional[int] = Field(None, description="Command exit code")
    output: Optional[str] = Field(None, description="Command output (truncated)")
    error_message: Optional[str] = Field(None, description="Error message on failure")
    error_trace: Optional[str] = Field(None, description="Error stack trace")
    without_overlapping: bool = Field(default=False, description="Whether overlap prevention is enabled")
    mutex_name: Optional[str] = Field(None, description="Mutex name for overlap prevention")
    expected_run_time: datetime = Field(..., description="Expected run time based on schedule")
    delay_ms: Optional[int] = Field(None, description="Delay from expected run time")
    metadata: Optional[dict] = Field(default_factory=dict, description="Additional metadata")


class BatchJobIngestRequest(BaseModel):
    """Batch request for ingesting job and scheduled task logs."""
    job_logs: list[JobLogEntry] = Field(default_factory=list, description="Job log entries")
    scheduled_task_logs: list[ScheduledTaskLogEntry] = Field(default_factory=list, description="Scheduled task entries")


class JobIngestResponse(BaseModel):
    """Response for job/task ingest operations."""
    success: bool = Field(..., description="Whether the ingest operation succeeded")
    message: str = Field(..., description="Human-readable result message")
    ingested_count: int = Field(0, description="Number of entries successfully ingested")


# Query response models

class JobExecution(BaseModel):
    """Job execution record for query responses."""
    job_id: str = Field(..., description="Unique job identifier")
    job_uuid: str = Field(..., description="Laravel job UUID")
    project_id: str = Field(..., description="Project UUID that owns this job")
    timestamp: str = Field(..., description="Job start timestamp (YYYY-MM-DD HH:MM:SS)")
    job_class: str = Field(..., description="Fully qualified job class name")
    job_name: str = Field(..., description="Human-readable job name")
    queue_name: str = Field(..., description="Queue name (e.g., default, high, low)")
    connection: str = Field(..., description="Queue connection driver (e.g., redis, database, sync)")
    status: str = Field(..., description="Job status: started, completed, failed, retrying")
    started_at: str = Field(..., description="Job start timestamp (YYYY-MM-DD HH:MM:SS)")
    completed_at: Optional[str] = Field(None, description="Job completion timestamp, null if still running")
    duration_ms: Optional[int] = Field(None, description="Execution duration in milliseconds")
    payload: Optional[str] = Field(None, description="Job payload as JSON string")
    attempt_number: int = Field(..., description="Current attempt number (starts at 1)")
    max_attempts: int = Field(..., description="Maximum number of retry attempts configured")
    exception_class: Optional[str] = Field(None, description="Exception class name on failure")
    exception_message: Optional[str] = Field(None, description="Exception message on failure")
    exception_trace: Optional[str] = Field(None, description="Stack trace on failure")
    user_id: Optional[str] = Field(None, description="User ID who triggered the job")
    memory_usage_mb: Optional[float] = Field(None, description="Peak memory usage in megabytes")


class JobQueueStats(BaseModel):
    """Statistics for a specific queue."""
    queue_name: str = Field(..., description="Queue name")
    total_executions: int = Field(..., description="Total job executions in this queue")
    success_count: int = Field(..., description="Number of successful executions")
    failure_count: int = Field(..., description="Number of failed executions")
    avg_duration_ms: float = Field(..., description="Average execution duration in milliseconds")


class JobClassStats(BaseModel):
    """Statistics for a specific job class."""
    job_class: str = Field(..., description="Fully qualified job class name")
    total_executions: int = Field(..., description="Total executions of this job class")
    success_count: int = Field(..., description="Number of successful executions")
    failure_count: int = Field(..., description="Number of failed executions")
    avg_duration_ms: float = Field(..., description="Average execution duration in milliseconds")


class RecentFailure(BaseModel):
    """Recent job failure information."""
    job_id: str = Field(..., description="Failed job identifier")
    job_class: str = Field(..., description="Failed job class name")
    timestamp: str = Field(..., description="Failure timestamp (YYYY-MM-DD HH:MM:SS)")
    exception_message: str = Field(..., description="Exception message")


class JobHealthStats(BaseModel):
    """Overall job health statistics for a project within a timeframe."""
    total_executions: int = Field(..., description="Total job executions")
    success_count: int = Field(..., description="Number of successful executions")
    failure_count: int = Field(..., description="Number of failed executions")
    retrying_count: int = Field(..., description="Number of jobs currently retrying")
    pending_count: int = Field(0, description="Number of pending jobs")
    cancelled_count: int = Field(0, description="Number of cancelled jobs")
    timeout_count: int = Field(0, description="Number of timed-out jobs")
    success_rate: float = Field(..., description="Success rate percentage (0-100)")
    avg_duration_ms: float = Field(..., description="Average execution duration in milliseconds")
    p50_duration_ms: float = Field(0.0, description="50th percentile (median) duration in milliseconds")
    p95_duration_ms: float = Field(..., description="95th percentile duration in milliseconds")
    p99_duration_ms: float = Field(0.0, description="99th percentile duration in milliseconds")
    by_queue: list[JobQueueStats] = Field(..., description="Statistics broken down by queue")
    by_job_class: list[JobClassStats] = Field(..., description="Statistics broken down by job class")
    recent_failures: list[RecentFailure] = Field(..., description="Most recent job failures")


class JobTimelinePoint(BaseModel):
    """Time-series point for job executions."""
    timestamp: str = Field(..., description="Time bucket timestamp (ISO format)")
    total: int = Field(..., description="Total job executions in this time bucket")
    success: int = Field(..., description="Successful executions")
    failed: int = Field(..., description="Failed executions")
    retrying: int = Field(..., description="Retrying executions")
    pending: int = Field(0, description="Pending executions")
    cancelled: int = Field(0, description="Cancelled executions")
    timeout: int = Field(0, description="Timed-out executions")


class ScheduledTaskExecution(BaseModel):
    """Scheduled task execution record for query responses."""
    task_id: str = Field(..., description="Unique task execution identifier")
    project_id: str = Field(..., description="Project UUID that owns this task")
    timestamp: str = Field(..., description="Task scheduled timestamp (YYYY-MM-DD HH:MM:SS)")
    command: str = Field(..., description="Artisan command signature")
    description: str = Field(..., description="Task description")
    expression: str = Field(..., description="Cron expression (e.g., '* * * * *')")
    timezone: str = Field(..., description="Task timezone (e.g., 'UTC')")
    status: str = Field(..., description="Task status: completed, failed, skipped, missed")
    scheduled_at: str = Field(..., description="Scheduled run time (YYYY-MM-DD HH:MM:SS)")
    started_at: Optional[str] = Field(None, description="Actual start time, null if not started")
    completed_at: Optional[str] = Field(None, description="Completion time, null if not completed")
    duration_ms: Optional[int] = Field(None, description="Execution duration in milliseconds")
    exit_code: Optional[int] = Field(None, description="Command exit code (0 = success)")
    output: str = Field(..., description="Command stdout output (may be truncated)")
    error_message: str = Field(..., description="Error message on failure")
    error_trace: str = Field(..., description="Error stack trace on failure")
    without_overlapping: bool = Field(..., description="Whether overlap prevention is enabled")
    mutex_name: str = Field(..., description="Mutex name for overlap prevention")
    expected_run_time: str = Field(..., description="Expected run time based on cron schedule")
    delay_ms: Optional[int] = Field(None, description="Delay from expected run time in milliseconds")


class ScheduledTaskCommandStats(BaseModel):
    """Statistics for a specific scheduled command."""
    command: str = Field(..., description="Artisan command signature")
    total_executions: int = Field(..., description="Total executions of this command")
    success_count: int = Field(..., description="Number of successful executions")
    failure_count: int = Field(..., description="Number of failed executions")
    missed_count: int = Field(..., description="Number of missed executions")
    avg_delay_ms: float = Field(..., description="Average delay from scheduled time in milliseconds")


class ScheduledTaskFailure(BaseModel):
    """Recent scheduled task failure information."""
    task_id: str = Field(..., description="Failed task identifier")
    command: str = Field(..., description="Failed command signature")
    timestamp: str = Field(..., description="Failure timestamp (YYYY-MM-DD HH:MM:SS)")
    error_message: str = Field(..., description="Error message")


class MissedTask(BaseModel):
    """Missed scheduled task information."""
    task_id: str = Field(..., description="Missed task identifier")
    command: str = Field(..., description="Missed command signature")
    scheduled_at: str = Field(..., description="When the task was supposed to run")
    delay_ms: int = Field(..., description="How late the task was in milliseconds")


class ScheduledTaskHealthStats(BaseModel):
    """Overall scheduled task health statistics for a project."""
    total_executions: int = Field(..., description="Total task executions")
    success_count: int = Field(..., description="Number of successful executions")
    failure_count: int = Field(..., description="Number of failed executions")
    missed_count: int = Field(..., description="Number of missed executions")
    success_rate: float = Field(..., description="Success rate percentage (0-100)")
    avg_delay_ms: float = Field(..., description="Average delay from scheduled time in milliseconds")
    avg_duration_ms: float = Field(..., description="Average execution duration in milliseconds")
    by_command: list[ScheduledTaskCommandStats] = Field(..., description="Statistics broken down by command")
    recent_failures: list[ScheduledTaskFailure] = Field(..., description="Most recent task failures")
    missed_tasks: list[MissedTask] = Field(..., description="Recently missed tasks")
