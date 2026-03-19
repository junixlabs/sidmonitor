# 005 — Distributed Trace Visualization

## Summary

Waterfall trace view that assembles request chains from existing `trace_id`, `span_id`, and `parent_request_id` fields already stored in `outbound_logs`. No new data collection is needed — this is a pure API + frontend feature that visualizes the distributed trace data already being captured.

## Motivation

SidMonitor's `outbound_logs` table already captures the building blocks for distributed tracing:

- `trace_id` (String, bloom_filter indexed)
- `span_id` (String)
- `parent_request_id` (String, bloom_filter indexed)

These fields link outbound calls back to their originating inbound request, forming a tree of related requests across services. Currently, this relationship is invisible in the UI — users can see individual requests but not the chain. A waterfall visualization would:

- Show the full request lifecycle: inbound → outbound calls → downstream service responses
- Identify which outbound call in a chain is the bottleneck
- Help developers understand service dependencies visually
- Leverage existing data with zero SDK changes

## Technical Design

### 1. Data Model — Trace Assembly

A trace is assembled by querying all events sharing the same `trace_id`:

```
Trace (trace_id = "abc-123")
├── Inbound Request (request_id = "req-1", from logs table)
│   ├── Outbound Call (parent_request_id = "req-1", to service-a)
│   │   └── [service-a's inbound request, if also instrumented]
│   ├── Outbound Call (parent_request_id = "req-1", to service-b)
│   └── Outbound Call (parent_request_id = "req-1", to service-c)
└── ...
```

Cross-project traces are possible if multiple projects share the same `trace_id` propagation. Queries should search across all projects within the same organization for complete traces.

### 2. API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/v1/traces/{trace_id}` | Assemble full trace tree for a given trace_id |
| `GET` | `/api/v1/traces/by-request/{request_id}` | Find trace by any participating request_id |
| `GET` | `/api/v1/traces/recent` | Recent traces with basic stats (span count, total duration) |

#### Trace Assembly Logic (`backend/app/services/trace_service.py`)

```python
async def assemble_trace(trace_id: str, org_id: UUID) -> TraceTree:
    # 1. Fetch all outbound_logs with this trace_id (across org projects)
    outbound_spans = await clickhouse.query(
        "SELECT * FROM outbound_logs WHERE trace_id = %(trace_id)s "
        "AND project_id IN %(project_ids)s "
        "ORDER BY timestamp",
        {"trace_id": trace_id, "project_ids": org_project_ids}
    )

    # 2. Fetch the root inbound request (if available)
    root_request_ids = {s.parent_request_id for s in outbound_spans if s.parent_request_id}
    inbound_logs = await clickhouse.query(
        "SELECT * FROM logs WHERE request_id IN %(ids)s",
        {"ids": list(root_request_ids)}
    )

    # 3. Build tree using parent_request_id relationships
    tree = build_span_tree(inbound_logs, outbound_spans)

    # 4. Calculate derived metrics
    tree.total_duration_ms = max(span.end_time for span in all_spans) - tree.root.start_time
    tree.critical_path = find_critical_path(tree)

    return tree
```

#### Response Schema

```python
class TraceSpan(BaseModel):
    span_id: str
    parent_id: Optional[str]
    type: Literal["inbound", "outbound"]
    service_name: str
    method: str
    url: str
    status_code: int
    start_time: datetime
    duration_ms: float
    is_error: bool
    project_id: Optional[UUID]         # which project this span belongs to
    children: list["TraceSpan"] = []

class TraceResponse(BaseModel):
    trace_id: str
    root_span: TraceSpan
    total_spans: int
    total_duration_ms: float
    services: list[str]                 # unique services involved
    has_errors: bool
```

### 3. Frontend — Trace Waterfall Component

New component: `frontend/src/components/traces/TraceWaterfall.tsx`

**Waterfall visualization:**
```
├─ GET /api/orders (200) ────────────────────────── 450ms
│  ├─ GET service-a/users/123 (200) ──────── 120ms
│  ├─ POST service-b/validate (200) ─── 45ms
│  └─ POST service-c/charge (500) ────────────── 280ms  ← ERROR
```

**Visual elements:**
- Horizontal bars proportional to duration, aligned to a shared timeline
- Color coding: green (success), red (error), yellow (slow)
- Nesting indicates parent-child relationship
- Hover tooltip: full URL, status code, duration, timestamps
- Click to expand: request/response headers, body (if captured)
- Critical path highlighting: the longest chain of sequential calls

**Span detail panel** (click on a span):
- Service name, method, full URL
- Status code, duration
- Request/response headers and body (if available)
- Link to the full request detail page in SidMonitor

### 4. Integration Points

**Inbound API detail page** (`frontend/src/pages/InboundAPIs.tsx` or detail component):
- If the request has outbound calls with a `trace_id`, show a "View Trace" button
- Clicking opens the trace waterfall for the associated trace

**Outbound API detail page**:
- Show parent request info and sibling outbound calls
- "View Full Trace" link

**Jobs detail page**:
- If a job triggers outbound calls with a trace_id, link to the trace view

### 5. Trace ID Propagation Enhancement (SDK)

While existing data already has `trace_id`, improve propagation in the SDK:

```php
// In OutboundCollector Guzzle middleware:
// Automatically inject trace_id into outgoing request headers
$request = $request->withHeader('X-Trace-Id', Observatory::traceId());
$request = $request->withHeader('X-Span-Id', Str::uuid()->toString());
$request = $request->withHeader('X-Parent-Span-Id', Observatory::currentSpanId());
```

This ensures downstream services (also running SidMonitor SDK) can link their inbound requests to the same trace.

## Files to Modify

| Layer | File | Change |
|-------|------|--------|
| Backend Service | `backend/app/services/trace_service.py` | New — trace assembly logic + tree building |
| Backend Model | `backend/app/models/traces.py` | New — TraceSpan, TraceResponse schemas |
| Backend API | `backend/app/api/traces.py` | New — trace endpoints |
| Backend API | `backend/app/main.py` | Register traces router |
| Frontend | `frontend/src/components/traces/TraceWaterfall.tsx` | New — waterfall visualization |
| Frontend | `frontend/src/components/traces/SpanBar.tsx` | New — individual span bar component |
| Frontend | `frontend/src/components/traces/SpanDetail.tsx` | New — span detail panel |
| Frontend | `frontend/src/pages/Traces.tsx` | New — trace list + detail page |
| Frontend | `frontend/src/hooks/useTraces.ts` | New — React Query hooks |
| Frontend | `frontend/src/api/client.ts` | Add traces API namespace |
| Frontend | `frontend/src/App.tsx` | Add trace route |
| SDK | `[laravel-observatory]src/Collectors/OutboundCollector.php` | Enhance trace header propagation |
| SDK | `[laravel-observatory]src/Observatory.php` | Add traceId() and currentSpanId() helpers |

## Implementation Steps

1. **Backend trace service** — trace assembly logic: fetch spans, build tree, calculate metrics
2. **Backend models** — Pydantic schemas for trace response
3. **API endpoints** — trace by ID, by request ID, recent traces list
4. **Frontend TraceWaterfall** — core visualization component with timeline, nesting, color coding
5. **Frontend SpanDetail** — detail panel for individual spans
6. **Frontend Traces page** — list of recent traces + detail view
7. **Integration** — "View Trace" links from inbound/outbound/job detail pages
8. **SDK enhancement** — improve trace header propagation in OutboundCollector
9. **Route + navigation** — add to App.tsx and sidebar
10. **Testing** — test tree assembly with various trace topologies (linear, fan-out, deep nesting)

## Effort Estimate

| Component | Estimate |
|-----------|----------|
| Trace assembly service + API | 1.5–2 days |
| TraceWaterfall component | 2–3 days |
| Span detail panel | 0.5–1 day |
| Traces page + integration links | 1 day |
| SDK trace propagation enhancement | 0.5 day |
| Testing | 1 day |
| **Total** | **6–8 days** |

## Notes

- This proposal has the highest value-to-effort ratio since it requires **no new data collection** — the fields already exist in `outbound_logs` and are indexed
- Cross-project traces (within the same org) are supported by design
- The waterfall component could be extracted as a reusable library component
- Future enhancement: OpenTelemetry trace format export for interop with Jaeger/Zipkin
