"""Ingestion API endpoints for receiving logs from SDKs."""

import logging
import secrets
from typing import Optional, Union

from fastapi import APIRouter, Depends, Header, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import get_settings
from app.database import get_db
from app.models.database import Project
from app.models.ingest import (
    BatchIngestRequest,
    InboundLogEntry,
    IngestResponse,
)
from app.models.outbound import OutboundLogEntry
from app.models.jobs import (
    BatchJobIngestRequest,
    JobIngestResponse,
    JobLogEntry,
    ScheduledTaskLogEntry,
)
from app.services import api_keys as api_keys_service
from app.services import ingest_service
from app.services import projects as projects_service

router = APIRouter()
logger = logging.getLogger(__name__)


async def verify_api_key_and_get_project(
    x_api_key: str = Header(..., alias="X-API-Key"),
    db: AsyncSession = Depends(get_db)
) -> Project:
    """Verify API key and return the associated project."""
    # Try PostgreSQL-stored keys (multi-tenant system)
    project = await projects_service.verify_api_key(x_api_key, db)
    if project:
        return project

    # Fallback: SQLite-stored keys
    if api_keys_service.verify_api_key(x_api_key):
        return None

    # Fallback: env-based keys
    settings = get_settings()
    for valid_key in settings.ingest_api_keys_list:
        if valid_key and secrets.compare_digest(x_api_key, valid_key):
            return None

    raise HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Invalid API key",
    )


@router.post("/ingest", response_model=IngestResponse)
async def ingest_single_log(
    entry: Union[InboundLogEntry, OutboundLogEntry],
    project: Optional[Project] = Depends(verify_api_key_and_get_project),
):
    """Ingest a single log entry (inbound or outbound)."""
    try:
        project_id = project.id if project else None
        if isinstance(entry, OutboundLogEntry):
            ingest_service.insert_outbound_log(entry, project_id)
        else:
            ingest_service.insert_inbound_log(entry, project_id)

        return IngestResponse(
            success=True,
            message="Log entry ingested successfully",
            ingested_count=1,
        )
    except Exception as e:
        logger.exception("Error ingesting log entry")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error ingesting log entry: {str(e)}",
        )


@router.post("/ingest/batch", response_model=IngestResponse)
async def ingest_batch_logs(
    batch: BatchIngestRequest,
    project: Optional[Project] = Depends(verify_api_key_and_get_project),
):
    """Ingest multiple log entries in a batch."""
    try:
        project_id = project.id if project else None
        total = 0

        total += ingest_service.insert_inbound_logs_batch(batch.inbound_logs, project_id)
        total += ingest_service.insert_outbound_logs_batch(batch.outbound_logs, project_id)

        return IngestResponse(
            success=True,
            message=f"Batch ingested successfully ({total} entries)",
            ingested_count=total,
        )
    except Exception as e:
        logger.exception("Error ingesting batch")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error ingesting batch: {str(e)}",
        )


# ============================================
# Job and Scheduled Task Ingest Endpoints
# ============================================

@router.post("/ingest/jobs", response_model=JobIngestResponse)
async def ingest_jobs(
    entry: JobLogEntry,
    project: Optional[Project] = Depends(verify_api_key_and_get_project),
):
    """Ingest a single job log entry."""
    try:
        project_id = project.id if project else None
        ingest_service.insert_job_log(entry, project_id)

        return JobIngestResponse(
            success=True,
            message="Job log entry ingested successfully",
            ingested_count=1,
        )
    except Exception as e:
        logger.exception("Error ingesting job log entry")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error ingesting job log entry: {str(e)}",
        )


@router.post("/ingest/scheduled-tasks", response_model=JobIngestResponse)
async def ingest_scheduled_tasks(
    entry: ScheduledTaskLogEntry,
    project: Optional[Project] = Depends(verify_api_key_and_get_project),
):
    """Ingest a single scheduled task log entry."""
    try:
        project_id = project.id if project else None
        ingest_service.insert_scheduled_task_log(entry, project_id)

        return JobIngestResponse(
            success=True,
            message="Scheduled task log entry ingested successfully",
            ingested_count=1,
        )
    except Exception as e:
        logger.exception("Error ingesting scheduled task log entry")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error ingesting scheduled task log entry: {str(e)}",
        )


@router.post("/ingest/jobs/batch", response_model=JobIngestResponse)
async def ingest_jobs_batch(
    batch: BatchJobIngestRequest,
    project: Optional[Project] = Depends(verify_api_key_and_get_project),
):
    """Ingest multiple job and scheduled task log entries in a batch."""
    try:
        project_id = project.id if project else None
        total = 0

        total += ingest_service.insert_job_logs_batch(batch.job_logs, project_id)
        total += ingest_service.insert_scheduled_task_logs_batch(batch.scheduled_task_logs, project_id)

        return JobIngestResponse(
            success=True,
            message=f"Batch ingested successfully ({total} entries)",
            ingested_count=total,
        )
    except Exception as e:
        logger.exception("Error ingesting batch")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error ingesting batch: {str(e)}",
        )
