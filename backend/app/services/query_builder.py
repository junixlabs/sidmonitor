"""Unified WHERE clause builder for ClickHouse queries with date validation."""

from datetime import datetime
from typing import Any, Dict, List, Optional, Tuple

from fastapi import HTTPException


def validate_date(value: Optional[str], param_name: str = "date") -> Optional[str]:
    """Validate ISO 8601 date string. Returns value if valid, raises 422 if invalid."""
    if value is None:
        return None
    try:
        datetime.fromisoformat(value.replace("Z", "+00:00"))
        return value
    except (ValueError, TypeError):
        raise HTTPException(
            status_code=422,
            detail=f"Invalid date format for {param_name}: {value}",
        )


# Status code category mappings (shared across logs, inbound, outbound)
STATUS_CODE_FILTERS = {
    "2xx": "status_code >= 200 AND status_code < 300",
    "3xx": "status_code >= 300 AND status_code < 400",
    "4xx": "status_code >= 400 AND status_code < 500",
    "5xx": "status_code >= 500",
    "error": "status_code >= 400",
    "success": "status_code >= 200 AND status_code < 400",
}


class WhereBuilder:
    """Chainable WHERE clause builder for ClickHouse queries.

    Usage:
        wb = WhereBuilder()
        wb.project(project_id).date_range(start_date, end_date).request_type(type)
        where, params = wb.build()          # "WHERE ..." or ""
        conds, params = wb.build_conditions()  # "..." or "1=1"
    """

    def __init__(self) -> None:
        self.conditions: List[str] = []
        self.params: Dict[str, Any] = {}

    def project(self, project_id: Optional[str]) -> "WhereBuilder":
        """Filter by project_id (toString comparison)."""
        if project_id:
            self.conditions.append("toString(project_id) = %(project_id)s")
            self.params["project_id"] = project_id
        return self

    def date_range(
        self,
        start_date: Optional[str] = None,
        end_date: Optional[str] = None,
        field: str = "timestamp",
        best_effort: bool = False,
    ) -> "WhereBuilder":
        """Filter by date range with validation.

        Args:
            field: Trusted column name — must not come from user input.
            best_effort: Use parseDateTimeBestEffort() for flexible ISO 8601 parsing.
        """
        if start_date:
            validate_date(start_date, "start_date")
            if best_effort:
                self.conditions.append(
                    f"{field} >= parseDateTimeBestEffort(%(start_date)s)"
                )
            else:
                self.conditions.append(f"{field} >= %(start_date)s")
            self.params["start_date"] = start_date
        if end_date:
            validate_date(end_date, "end_date")
            if best_effort:
                self.conditions.append(
                    f"{field} <= parseDateTimeBestEffort(%(end_date)s)"
                )
            else:
                self.conditions.append(f"{field} <= %(end_date)s")
            self.params["end_date"] = end_date
        return self

    def request_type(
        self, type_: Optional[str]
    ) -> "WhereBuilder":
        """Filter by request type (inbound/outbound) via is_outbound flag."""
        if type_ == "inbound":
            self.conditions.append("is_outbound = 0")
        elif type_ == "outbound":
            self.conditions.append("is_outbound = 1")
        return self

    def inbound_only(self) -> "WhereBuilder":
        """Restrict to inbound logs (is_outbound = 0)."""
        self.conditions.append("is_outbound = 0")
        return self

    def status_code(self, status: Optional[str]) -> "WhereBuilder":
        """Filter by status code category (2xx, 3xx, 4xx, 5xx, error, success)."""
        if not status:
            return self
        if status in STATUS_CODE_FILTERS:
            self.conditions.append(STATUS_CODE_FILTERS[status])
        else:
            raise HTTPException(
                status_code=422,
                detail=f"Invalid status filter: {status}. Valid values: {', '.join(STATUS_CODE_FILTERS)}",
            )
        return self

    def eq(
        self, field: str, value: Any, param_name: Optional[str] = None
    ) -> "WhereBuilder":
        """Add exact match condition: field = value."""
        if value is not None:
            key = param_name or field
            self.conditions.append(f"{field} = %({key})s")
            self.params[key] = value
        return self

    def like(
        self, field: str, value: Optional[str], param_name: Optional[str] = None
    ) -> "WhereBuilder":
        """Add LIKE condition with automatic % wrapping."""
        if value:
            key = param_name or field
            self.conditions.append(f"{field} LIKE %({key})s")
            self.params[key] = f"%{value}%"
        return self

    def user_search(self, user: Optional[str]) -> "WhereBuilder":
        """Search by user_id (exact) or user_name (LIKE)."""
        if user:
            self.conditions.append(
                "(user_id = %(user)s OR user_name LIKE %(user_pattern)s)"
            )
            self.params["user"] = user
            self.params["user_pattern"] = f"%{user}%"
        return self

    def not_empty(self, field: str) -> "WhereBuilder":
        """Require field IS NOT NULL AND != ''."""
        self.conditions.append(f"{field} IS NOT NULL AND {field} != ''")
        return self

    def raw(self, condition: str, **params: Any) -> "WhereBuilder":
        """Add a raw SQL condition with optional params.

        Warning: ``condition`` is interpolated directly into SQL.
        Only pass trusted, hardcoded strings — never user input.
        """
        self.conditions.append(condition)
        self.params.update(params)
        return self

    def build(self) -> Tuple[str, Dict[str, Any]]:
        """Return (where_clause, params). Empty string if no conditions."""
        if not self.conditions:
            return "", dict(self.params)
        return "WHERE " + " AND ".join(self.conditions), dict(self.params)

    def build_conditions(self) -> Tuple[str, Dict[str, Any]]:
        """Return (conditions_string, params). '1=1' if no conditions."""
        if not self.conditions:
            return "1=1", dict(self.params)
        return " AND ".join(self.conditions), dict(self.params)

    def build_and(self) -> Tuple[str, Dict[str, Any]]:
        """Return ('AND ...', params) for appending to existing WHERE. Empty if none."""
        if not self.conditions:
            return "", dict(self.params)
        return "AND " + " AND ".join(self.conditions), dict(self.params)
