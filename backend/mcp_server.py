"""
SidMonitor MCP Server — per-project server for AI Agents.

Each instance is scoped to a single project via its API key.
All tools automatically query data for that project only.

Usage:
    SIDMONITOR_API_KEY=smk_xxx python mcp_server.py

Or in Claude Code / MCP client config:
    {
      "mcpServers": {
        "sidmonitor": {
          "command": "python",
          "args": ["mcp_server.py"],
          "env": { "SIDMONITOR_API_KEY": "smk_your_key_here" }
        }
      }
    }
"""
import asyncio
import hashlib
import json
import os
import sys
import uuid
from datetime import datetime, timezone

sys.path.insert(0, os.path.dirname(__file__))

from mcp.server import Server
from mcp.server.stdio import stdio_server
from mcp.types import TextContent, Tool

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from app.config import get_settings
from app.models.database import (
    ApiKey,
    AuditLog,
    Feedback,
    Organization,
    Project,
    User,
)

settings = get_settings()
engine = create_async_engine(settings.database_url, pool_pre_ping=True, pool_size=3)
SessionLocal = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)


# ---------------------------------------------------------------------------
# Project context — resolved once at startup from API key
# ---------------------------------------------------------------------------

class ProjectContext:
    """Holds the resolved project/org info for this MCP server instance."""
    project_id: str = ""
    project_name: str = ""
    project_slug: str = ""
    org_id: str = ""
    org_name: str = ""
    org_slug: str = ""
    platform: str = ""
    environment: str = ""

    def summary(self) -> str:
        return (
            f"Project: {self.project_name} ({self.project_slug})\n"
            f"Organization: {self.org_name} ({self.org_slug})\n"
            f"Platform: {self.platform} | Env: {self.environment}\n"
            f"Project ID: {self.project_id}"
        )


ctx = ProjectContext()


async def resolve_project_from_api_key(api_key_raw: str) -> None:
    """Validate the API key and populate the global project context."""
    key_hash = hashlib.sha256(api_key_raw.encode()).hexdigest()

    async with SessionLocal() as db:
        result = await db.execute(
            select(ApiKey).where(ApiKey.key_hash == key_hash, ApiKey.revoked_at.is_(None))
        )
        api_key = result.scalar_one_or_none()
        if not api_key:
            print("ERROR: Invalid or revoked SIDMONITOR_API_KEY", file=sys.stderr)
            sys.exit(1)

        if api_key.expires_at and api_key.expires_at < datetime.now(timezone.utc):
            print("ERROR: SIDMONITOR_API_KEY has expired", file=sys.stderr)
            sys.exit(1)

        result = await db.execute(select(Project).where(Project.id == api_key.project_id))
        project = result.scalar_one_or_none()
        if not project:
            print("ERROR: Project not found for this API key", file=sys.stderr)
            sys.exit(1)

        result = await db.execute(select(Organization).where(Organization.id == project.organization_id))
        org = result.scalar_one_or_none()

        ctx.project_id = str(project.id)
        ctx.project_name = project.name
        ctx.project_slug = project.slug
        ctx.platform = project.platform
        ctx.environment = project.environment
        ctx.org_id = str(org.id) if org else ""
        ctx.org_name = org.name if org else ""
        ctx.org_slug = org.slug if org else ""

    print(f"MCP server ready for project: {ctx.project_name} ({ctx.project_slug})", file=sys.stderr)


# ---------------------------------------------------------------------------
# MCP Server
# ---------------------------------------------------------------------------

server = Server("sidmonitor")

TOOLS = [
    Tool(
        name="get_project_info",
        description="Get info about the current project (name, org, platform, environment).",
        inputSchema={"type": "object", "properties": {}},
    ),
    Tool(
        name="get_stats",
        description="Get dashboard stats: total requests, error rate, avg/p95 response time.",
        inputSchema={
            "type": "object",
            "properties": {
                "time_range": {
                    "type": "string",
                    "enum": ["1h", "24h", "7d", "30d"],
                    "default": "24h",
                    "description": "Time range for stats",
                },
            },
        },
    ),
    Tool(
        name="get_errors",
        description="Get error summary: count by status code with sample endpoints.",
        inputSchema={
            "type": "object",
            "properties": {
                "time_range": {
                    "type": "string",
                    "enum": ["1h", "24h", "7d", "30d"],
                    "default": "24h",
                },
                "limit": {"type": "integer", "default": 20},
            },
        },
    ),
    Tool(
        name="get_slow_endpoints",
        description="Get slowest endpoints by average response time.",
        inputSchema={
            "type": "object",
            "properties": {
                "time_range": {
                    "type": "string",
                    "enum": ["1h", "24h", "7d", "30d"],
                    "default": "24h",
                },
                "limit": {"type": "integer", "default": 10},
            },
        },
    ),
    Tool(
        name="get_top_endpoints",
        description="Get most-called endpoints by request count.",
        inputSchema={
            "type": "object",
            "properties": {
                "time_range": {
                    "type": "string",
                    "enum": ["1h", "24h", "7d", "30d"],
                    "default": "24h",
                },
                "limit": {"type": "integer", "default": 10},
            },
        },
    ),
    Tool(
        name="get_outbound_health",
        description="Get health of external API calls (outbound): success rate, latency by service.",
        inputSchema={
            "type": "object",
            "properties": {
                "time_range": {
                    "type": "string",
                    "enum": ["1h", "24h", "7d", "30d"],
                    "default": "24h",
                },
            },
        },
    ),
    Tool(
        name="get_recent_failures",
        description="Get recent failed requests (4xx/5xx) with endpoint and timestamp.",
        inputSchema={
            "type": "object",
            "properties": {
                "time_range": {
                    "type": "string",
                    "enum": ["1h", "24h", "7d", "30d"],
                    "default": "1h",
                },
                "limit": {"type": "integer", "default": 20},
            },
        },
    ),
    Tool(
        name="get_job_stats",
        description="Get background job stats: success/failure rate, avg duration, by queue and job class.",
        inputSchema={
            "type": "object",
            "properties": {
                "time_range": {
                    "type": "string",
                    "enum": ["1h", "24h", "7d", "30d"],
                    "default": "24h",
                },
            },
        },
    ),
    Tool(
        name="get_audit_logs",
        description="Get recent audit log entries for this project's organization.",
        inputSchema={
            "type": "object",
            "properties": {
                "limit": {"type": "integer", "default": 20},
            },
        },
    ),
    Tool(
        name="submit_feedback",
        description="Submit a bug report, feature request, or feedback for this project.",
        inputSchema={
            "type": "object",
            "properties": {
                "title": {"type": "string", "description": "Short summary"},
                "description": {"type": "string", "description": "Detailed description"},
                "category": {
                    "type": "string",
                    "enum": ["bug", "feature", "improvement", "question", "other"],
                },
                "priority": {
                    "type": "string",
                    "enum": ["low", "medium", "high", "critical"],
                    "default": "medium",
                },
            },
            "required": ["title", "description", "category"],
        },
    ),
    Tool(
        name="list_feedback",
        description="List feedback entries for this project.",
        inputSchema={
            "type": "object",
            "properties": {
                "status": {"type": "string", "enum": ["open", "in_progress", "resolved", "closed"]},
                "category": {"type": "string", "enum": ["bug", "feature", "improvement", "question", "other"]},
                "limit": {"type": "integer", "default": 20},
            },
        },
    ),
    Tool(
        name="update_feedback_status",
        description="Update the status of a feedback entry.",
        inputSchema={
            "type": "object",
            "properties": {
                "feedback_id": {"type": "string", "description": "Feedback UUID"},
                "status": {"type": "string", "enum": ["open", "in_progress", "resolved", "closed"]},
            },
            "required": ["feedback_id", "status"],
        },
    ),
]


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _hours(tr: str) -> int:
    return {"1h": 1, "24h": 24, "7d": 168, "30d": 720}.get(tr, 24)


def _ch():
    import clickhouse_connect
    return clickhouse_connect.get_client(
        host=settings.clickhouse_host,
        port=int(settings.clickhouse_port),
        username=settings.clickhouse_user,
        password=settings.clickhouse_password,
        database=settings.clickhouse_database,
        connect_timeout=10,
        send_receive_timeout=30,
    )


def _json(data) -> str:
    return json.dumps(data, indent=2, default=str)


# ---------------------------------------------------------------------------
# Tool handlers
# ---------------------------------------------------------------------------

async def handle_get_project_info(args: dict) -> str:
    return ctx.summary()


async def handle_get_stats(args: dict) -> str:
    hours = _hours(args.get("time_range", "24h"))
    try:
        ch = _ch()
        r = ch.query(f"""
            SELECT
                count() as total_requests,
                countIf(status_code >= 400) * 100.0 / greatest(count(), 1) as error_rate,
                avg(response_time_ms) as avg_response_time,
                quantile(0.95)(response_time_ms) as p95_response_time,
                count() / {hours} as requests_per_hour
            FROM api_logs
            WHERE project_id = %(pid)s AND timestamp >= now() - INTERVAL {hours} HOUR
        """, parameters={"pid": ctx.project_id})
        row = r.first_row if r.row_count > 0 else [0, 0, 0, 0, 0]
        return _json({
            "total_requests": int(row[0]),
            "error_rate_pct": round(float(row[1]), 2),
            "avg_response_time_ms": round(float(row[2]), 2),
            "p95_response_time_ms": round(float(row[3]), 2),
            "requests_per_hour": round(float(row[4]), 2),
        })
    except Exception as e:
        return _json({"error": str(e)})


async def handle_get_errors(args: dict) -> str:
    hours = _hours(args.get("time_range", "24h"))
    limit = args.get("limit", 20)
    try:
        ch = _ch()
        r = ch.query(f"""
            SELECT status_code, count() as cnt, any(endpoint) as sample_endpoint, any(method) as method
            FROM api_logs
            WHERE project_id = %(pid)s AND status_code >= 400
              AND timestamp >= now() - INTERVAL {hours} HOUR
            GROUP BY status_code ORDER BY cnt DESC LIMIT {int(limit)}
        """, parameters={"pid": ctx.project_id})
        errors = [{"status_code": int(row[0]), "count": int(row[1]), "sample_endpoint": f"{row[3]} {row[2]}"} for row in r.result_rows]
        return _json({"total_error_types": len(errors), "errors": errors})
    except Exception as e:
        return _json({"error": str(e)})


async def handle_get_slow_endpoints(args: dict) -> str:
    hours = _hours(args.get("time_range", "24h"))
    limit = args.get("limit", 10)
    try:
        ch = _ch()
        r = ch.query(f"""
            SELECT endpoint, method, count() as cnt,
                   avg(response_time_ms) as avg_ms,
                   quantile(0.95)(response_time_ms) as p95_ms
            FROM api_logs
            WHERE project_id = %(pid)s AND timestamp >= now() - INTERVAL {hours} HOUR
            GROUP BY endpoint, method HAVING cnt >= 5
            ORDER BY avg_ms DESC LIMIT {int(limit)}
        """, parameters={"pid": ctx.project_id})
        return _json([{
            "endpoint": f"{row[1]} {row[0]}",
            "requests": int(row[2]),
            "avg_ms": round(float(row[3]), 1),
            "p95_ms": round(float(row[4]), 1),
        } for row in r.result_rows])
    except Exception as e:
        return _json({"error": str(e)})


async def handle_get_top_endpoints(args: dict) -> str:
    hours = _hours(args.get("time_range", "24h"))
    limit = args.get("limit", 10)
    try:
        ch = _ch()
        r = ch.query(f"""
            SELECT endpoint, method, count() as cnt,
                   avg(response_time_ms) as avg_ms,
                   countIf(status_code >= 400) * 100.0 / count() as error_rate
            FROM api_logs
            WHERE project_id = %(pid)s AND timestamp >= now() - INTERVAL {hours} HOUR
            GROUP BY endpoint, method ORDER BY cnt DESC LIMIT {int(limit)}
        """, parameters={"pid": ctx.project_id})
        return _json([{
            "endpoint": f"{row[1]} {row[0]}",
            "requests": int(row[2]),
            "avg_ms": round(float(row[3]), 1),
            "error_rate_pct": round(float(row[4]), 2),
        } for row in r.result_rows])
    except Exception as e:
        return _json({"error": str(e)})


async def handle_get_outbound_health(args: dict) -> str:
    hours = _hours(args.get("time_range", "24h"))
    try:
        ch = _ch()
        r = ch.query(f"""
            SELECT service_name, count() as cnt,
                   countIf(is_success = 1) as ok,
                   avg(latency_ms) as avg_ms,
                   quantile(0.95)(latency_ms) as p95_ms
            FROM outbound_api_logs
            WHERE project_id = %(pid)s AND timestamp >= now() - INTERVAL {hours} HOUR
            GROUP BY service_name ORDER BY cnt DESC
        """, parameters={"pid": ctx.project_id})
        return _json([{
            "service": row[0],
            "requests": int(row[1]),
            "success_rate_pct": round(int(row[2]) * 100.0 / max(int(row[1]), 1), 2),
            "avg_latency_ms": round(float(row[3]), 1),
            "p95_latency_ms": round(float(row[4]), 1),
        } for row in r.result_rows])
    except Exception as e:
        return _json({"error": str(e)})


async def handle_get_recent_failures(args: dict) -> str:
    hours = _hours(args.get("time_range", "1h"))
    limit = args.get("limit", 20)
    try:
        ch = _ch()
        r = ch.query(f"""
            SELECT timestamp, method, endpoint, status_code, response_time_ms, user_id
            FROM api_logs
            WHERE project_id = %(pid)s AND status_code >= 400
              AND timestamp >= now() - INTERVAL {hours} HOUR
            ORDER BY timestamp DESC LIMIT {int(limit)}
        """, parameters={"pid": ctx.project_id})
        return _json([{
            "time": str(row[0]),
            "request": f"{row[1]} {row[2]}",
            "status": int(row[3]),
            "response_time_ms": round(float(row[4]), 1),
            "user_id": row[5] or None,
        } for row in r.result_rows])
    except Exception as e:
        return _json({"error": str(e)})


async def handle_get_job_stats(args: dict) -> str:
    hours = _hours(args.get("time_range", "24h"))
    try:
        ch = _ch()
        r = ch.query(f"""
            SELECT
                count() as total,
                countIf(status = 'completed') as ok,
                countIf(status = 'failed') as failed,
                avg(duration_ms) as avg_ms,
                quantile(0.95)(duration_ms) as p95_ms
            FROM job_logs
            WHERE project_id = %(pid)s AND timestamp >= now() - INTERVAL {hours} HOUR
        """, parameters={"pid": ctx.project_id})
        row = r.first_row if r.row_count > 0 else [0, 0, 0, 0, 0]

        # By job class
        r2 = ch.query(f"""
            SELECT job_class, count() as cnt,
                   countIf(status = 'completed') as ok,
                   countIf(status = 'failed') as failed,
                   avg(duration_ms) as avg_ms
            FROM job_logs
            WHERE project_id = %(pid)s AND timestamp >= now() - INTERVAL {hours} HOUR
            GROUP BY job_class ORDER BY cnt DESC LIMIT 15
        """, parameters={"pid": ctx.project_id})

        return _json({
            "total": int(row[0]),
            "completed": int(row[1]),
            "failed": int(row[2]),
            "success_rate_pct": round(int(row[1]) * 100.0 / max(int(row[0]), 1), 2),
            "avg_duration_ms": round(float(row[3]), 1),
            "p95_duration_ms": round(float(row[4]), 1),
            "by_class": [{
                "job_class": r[0], "total": int(r[1]), "completed": int(r[2]),
                "failed": int(r[3]), "avg_ms": round(float(r[4]), 1),
            } for r in r2.result_rows],
        })
    except Exception as e:
        return _json({"error": str(e)})


async def handle_get_audit_logs(args: dict) -> str:
    if not ctx.org_id:
        return _json({"error": "No organization associated with this project"})
    limit = args.get("limit", 20)
    async with SessionLocal() as db:
        result = await db.execute(
            select(AuditLog)
            .where(AuditLog.org_id == uuid.UUID(ctx.org_id))
            .order_by(AuditLog.created_at.desc())
            .limit(limit)
        )
        entries = result.scalars().all()

        # Enrich with actor names
        actor_ids = {e.actor_id for e in entries if e.actor_id}
        actors = {}
        if actor_ids:
            r = await db.execute(select(User).where(User.id.in_(actor_ids)))
            actors = {u.id: u.name for u in r.scalars().all()}

        return _json([{
            "time": e.created_at.isoformat(),
            "action": e.action,
            "actor": actors.get(e.actor_id, e.actor_type),
            "target": f"{e.target_type}:{e.target_id}" if e.target_type else None,
        } for e in entries])


async def handle_submit_feedback(args: dict) -> str:
    async with SessionLocal() as db:
        fb = Feedback(
            org_id=uuid.UUID(ctx.org_id) if ctx.org_id else None,
            project_id=uuid.UUID(ctx.project_id),
            category=args["category"],
            title=args["title"],
            description=args["description"],
            priority=args.get("priority", "medium"),
            extra_data={"source": "mcp_agent", "project_slug": ctx.project_slug},
        )
        db.add(fb)
        await db.commit()
        await db.refresh(fb)
        return _json({
            "id": str(fb.id),
            "title": fb.title,
            "status": fb.status,
            "created_at": fb.created_at.isoformat(),
        })


async def handle_list_feedback(args: dict) -> str:
    async with SessionLocal() as db:
        query = (
            select(Feedback)
            .where(Feedback.project_id == uuid.UUID(ctx.project_id))
            .order_by(Feedback.created_at.desc())
        )
        if args.get("status"):
            query = query.where(Feedback.status == args["status"])
        if args.get("category"):
            query = query.where(Feedback.category == args["category"])
        query = query.limit(args.get("limit", 20))

        result = await db.execute(query)
        items = result.scalars().all()
        return _json([{
            "id": str(fb.id),
            "title": fb.title,
            "category": fb.category,
            "priority": fb.priority,
            "status": fb.status,
            "description": fb.description[:200] + ("..." if len(fb.description) > 200 else ""),
            "created_at": fb.created_at.isoformat(),
        } for fb in items])


async def handle_update_feedback_status(args: dict) -> str:
    feedback_id = uuid.UUID(args["feedback_id"])
    new_status = args["status"]
    async with SessionLocal() as db:
        result = await db.execute(select(Feedback).where(Feedback.id == feedback_id))
        fb = result.scalar_one_or_none()
        if not fb:
            return _json({"error": "Feedback not found"})
        fb.status = new_status
        if new_status == "resolved":
            fb.resolved_at = datetime.now(timezone.utc)
        await db.commit()
        return _json({"id": str(fb.id), "status": fb.status, "updated": True})


HANDLERS = {
    "get_project_info": handle_get_project_info,
    "get_stats": handle_get_stats,
    "get_errors": handle_get_errors,
    "get_slow_endpoints": handle_get_slow_endpoints,
    "get_top_endpoints": handle_get_top_endpoints,
    "get_outbound_health": handle_get_outbound_health,
    "get_recent_failures": handle_get_recent_failures,
    "get_job_stats": handle_get_job_stats,
    "get_audit_logs": handle_get_audit_logs,
    "submit_feedback": handle_submit_feedback,
    "list_feedback": handle_list_feedback,
    "update_feedback_status": handle_update_feedback_status,
}


# ---------------------------------------------------------------------------
# MCP hooks
# ---------------------------------------------------------------------------

@server.list_tools()
async def list_tools() -> list[Tool]:
    return TOOLS


@server.call_tool()
async def call_tool(name: str, arguments: dict) -> list[TextContent]:
    handler = HANDLERS.get(name)
    if not handler:
        return [TextContent(type="text", text=f"Unknown tool: {name}")]
    try:
        result = await handler(arguments)
        return [TextContent(type="text", text=result)]
    except Exception as e:
        return [TextContent(type="text", text=f"Error: {e}")]


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

async def main():
    api_key = os.environ.get("SIDMONITOR_API_KEY")
    if not api_key:
        print("ERROR: SIDMONITOR_API_KEY environment variable is required.", file=sys.stderr)
        print("Get your API key from: Project Settings > API Keys", file=sys.stderr)
        sys.exit(1)

    await resolve_project_from_api_key(api_key)

    async with stdio_server() as (read_stream, write_stream):
        await server.run(read_stream, write_stream, server.create_initialization_options())


if __name__ == "__main__":
    asyncio.run(main())
