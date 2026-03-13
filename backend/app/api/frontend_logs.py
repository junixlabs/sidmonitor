"""Frontend error logging endpoint - logs to file for debugging."""
import json
import os
from datetime import datetime
from fastapi import APIRouter, Query

from app.models.frontend_logs import (
    FrontendLogEntry,
    FrontendLogResponse,
    FrontendLogsListResponse,
    FrontendLogsClearResponse,
)

router = APIRouter()

# Log file path — use /tmp in containers for write access
LOG_DIR = os.environ.get('FRONTEND_LOG_DIR', os.path.join(os.path.dirname(__file__), '..', '..', 'data'))
LOG_FILE = os.path.join(LOG_DIR, 'frontend-errors.log')


@router.post("/v1/frontend-logs", response_model=FrontendLogResponse, summary="Log frontend error")
async def log_frontend_error(entry: FrontendLogEntry):
    """Log a frontend error or event to file for debugging."""
    # Ensure log directory exists
    os.makedirs(LOG_DIR, exist_ok=True)

    # Format log entry
    log_line = {
        "received_at": datetime.utcnow().isoformat(),
        **entry.model_dump()
    }

    # Append to log file
    with open(LOG_FILE, 'a') as f:
        f.write(json.dumps(log_line) + '\n')

    return FrontendLogResponse(status="logged")


@router.get("/v1/frontend-logs", response_model=FrontendLogsListResponse, summary="Get frontend logs")
async def get_frontend_logs(
    limit: int = Query(100, ge=1, le=1000, description="Maximum number of log entries to return"),
):
    """Get recent frontend logs, ordered by time (most recent last)."""
    if not os.path.exists(LOG_FILE):
        return FrontendLogsListResponse(logs=[])

    logs = []
    with open(LOG_FILE, 'r') as f:
        for line in f:
            if line.strip():
                try:
                    logs.append(json.loads(line))
                except json.JSONDecodeError:
                    pass

    # Return last N logs
    return FrontendLogsListResponse(logs=logs[-limit:])


@router.delete("/v1/frontend-logs", response_model=FrontendLogsClearResponse, summary="Clear frontend logs")
async def clear_frontend_logs():
    """Clear all stored frontend logs."""
    if os.path.exists(LOG_FILE):
        os.remove(LOG_FILE)
    return FrontendLogsClearResponse(status="cleared")
