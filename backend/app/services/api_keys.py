"""SQLite-based API Key Service for managing API keys."""

import hashlib
import secrets
import sqlite3
import uuid
from contextlib import contextmanager
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Optional

# Database file location — uses /app/data in containers (created with appuser ownership in Dockerfile)
import os
_default_db_dir = os.environ.get("APP_DATA_DIR", str(Path(__file__).parent.parent.parent / "data"))
DB_PATH = Path(_default_db_dir) / "api_keys.db"


@dataclass
class ApiKey:
    """API Key model."""
    id: str
    name: str
    key_prefix: str
    created_at: str
    last_used_at: Optional[str] = None
    revoked_at: Optional[str] = None


def _ensure_db_directory():
    """Ensure the data directory exists."""
    DB_PATH.parent.mkdir(parents=True, exist_ok=True)


@contextmanager
def get_db_connection():
    """Get a database connection with context manager."""
    _ensure_db_directory()
    conn = sqlite3.connect(str(DB_PATH))
    conn.row_factory = sqlite3.Row
    try:
        yield conn
    finally:
        conn.close()


def init_db():
    """Initialize the database schema."""
    with get_db_connection() as conn:
        conn.execute("""
            CREATE TABLE IF NOT EXISTS api_keys (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                key_hash TEXT NOT NULL,
                key_prefix TEXT NOT NULL,
                created_at TEXT DEFAULT CURRENT_TIMESTAMP,
                last_used_at TEXT,
                revoked_at TEXT
            )
        """)
        conn.commit()


def _hash_key(key: str) -> str:
    """Hash an API key using SHA-256."""
    return hashlib.sha256(key.encode()).hexdigest()


def _generate_api_key() -> tuple[str, str]:
    """Generate a new API key and return (full_key, prefix)."""
    # Generate a 32-byte random key and encode as hex (64 chars)
    raw_key = secrets.token_hex(32)
    # Format: smk_<random>
    full_key = f"smk_{raw_key}"
    # Prefix for display: smk_<first 8 chars>...
    prefix = f"smk_{raw_key[:8]}..."
    return full_key, prefix


def create_api_key(name: str) -> tuple[ApiKey, str]:
    """
    Create a new API key.

    Returns a tuple of (ApiKey, full_key_value).
    The full key is only returned once at creation time.
    """
    init_db()

    key_id = str(uuid.uuid4())
    full_key, prefix = _generate_api_key()
    key_hash = _hash_key(full_key)
    created_at = datetime.now(timezone.utc).isoformat() + "Z"

    with get_db_connection() as conn:
        conn.execute(
            """
            INSERT INTO api_keys (id, name, key_hash, key_prefix, created_at)
            VALUES (?, ?, ?, ?, ?)
            """,
            (key_id, name, key_hash, prefix, created_at)
        )
        conn.commit()

    api_key = ApiKey(
        id=key_id,
        name=name,
        key_prefix=prefix,
        created_at=created_at,
    )

    return api_key, full_key


def list_api_keys() -> list[ApiKey]:
    """List all non-revoked API keys."""
    init_db()

    with get_db_connection() as conn:
        cursor = conn.execute(
            """
            SELECT id, name, key_prefix, created_at, last_used_at, revoked_at
            FROM api_keys
            WHERE revoked_at IS NULL
            ORDER BY created_at DESC
            """
        )
        rows = cursor.fetchall()

    return [
        ApiKey(
            id=row["id"],
            name=row["name"],
            key_prefix=row["key_prefix"],
            created_at=row["created_at"],
            last_used_at=row["last_used_at"],
            revoked_at=row["revoked_at"],
        )
        for row in rows
    ]


def get_api_key(key_id: str) -> Optional[ApiKey]:
    """Get a single API key by ID."""
    init_db()

    with get_db_connection() as conn:
        cursor = conn.execute(
            """
            SELECT id, name, key_prefix, created_at, last_used_at, revoked_at
            FROM api_keys
            WHERE id = ? AND revoked_at IS NULL
            """,
            (key_id,)
        )
        row = cursor.fetchone()

    if not row:
        return None

    return ApiKey(
        id=row["id"],
        name=row["name"],
        key_prefix=row["key_prefix"],
        created_at=row["created_at"],
        last_used_at=row["last_used_at"],
        revoked_at=row["revoked_at"],
    )


def revoke_api_key(key_id: str) -> bool:
    """Revoke an API key. Returns True if successful."""
    init_db()

    revoked_at = datetime.now(timezone.utc).isoformat() + "Z"

    with get_db_connection() as conn:
        cursor = conn.execute(
            """
            UPDATE api_keys
            SET revoked_at = ?
            WHERE id = ? AND revoked_at IS NULL
            """,
            (revoked_at, key_id)
        )
        conn.commit()
        return cursor.rowcount > 0


def verify_api_key(key: str) -> bool:
    """
    Verify if an API key is valid.

    Returns True if the key exists and is not revoked.
    Also updates last_used_at timestamp.
    """
    init_db()

    key_hash = _hash_key(key)

    with get_db_connection() as conn:
        cursor = conn.execute(
            """
            SELECT id FROM api_keys
            WHERE key_hash = ? AND revoked_at IS NULL
            """,
            (key_hash,)
        )
        row = cursor.fetchone()

        if row:
            # Update last_used_at
            last_used_at = datetime.now(timezone.utc).isoformat() + "Z"
            conn.execute(
                """
                UPDATE api_keys SET last_used_at = ? WHERE id = ?
                """,
                (last_used_at, row["id"])
            )
            conn.commit()
            return True

    return False


def get_api_key_count() -> int:
    """Get count of active (non-revoked) API keys."""
    init_db()

    with get_db_connection() as conn:
        cursor = conn.execute(
            """
            SELECT COUNT(*) as count FROM api_keys
            WHERE revoked_at IS NULL
            """
        )
        row = cursor.fetchone()
        return row["count"] if row else 0


def get_first_api_key_preview() -> Optional[str]:
    """Get the prefix of the first active API key for display."""
    init_db()

    with get_db_connection() as conn:
        cursor = conn.execute(
            """
            SELECT key_prefix FROM api_keys
            WHERE revoked_at IS NULL
            ORDER BY created_at ASC
            LIMIT 1
            """
        )
        row = cursor.fetchone()
        return row["key_prefix"] if row else None
