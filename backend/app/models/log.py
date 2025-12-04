from pydantic import BaseModel
from typing import Optional, Generic, TypeVar
from datetime import datetime

T = TypeVar("T")


class LogEntry(BaseModel):
    id: str
    request_id: str
    timestamp: str
    endpoint: str
    method: str
    status_code: int
    response_time_ms: float
    user_id: Optional[str] = None
    user_name: Optional[str] = None
    module: Optional[str] = None
    tags: Optional[list[str]] = None
    is_outbound: bool = False
    third_party_service: Optional[str] = None
    request_body: Optional[str] = None
    response_body: Optional[str] = None


class PaginatedResponse(BaseModel, Generic[T]):
    data: list
    total: int
    page: int
    page_size: int
    total_pages: int
