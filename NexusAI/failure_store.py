"""Store real generation failures for future gold dataset creation."""

from __future__ import annotations

import sqlite3
from datetime import datetime, timezone
from pathlib import Path


BASE_DIR = Path(__file__).parent
DB_PATH = BASE_DIR / "memory" / "memory.db"


def ensure_failures_table() -> None:
    DB_PATH.parent.mkdir(parents=True, exist_ok=True)
    with sqlite3.connect(DB_PATH) as conn:
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS failures (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                prompt TEXT NOT NULL,
                bad_response TEXT NOT NULL,
                failure_type TEXT NOT NULL,
                corrected_response TEXT,
                task_type TEXT,
                created_at TEXT NOT NULL
            )
            """
        )
        conn.commit()


def add_failure(
    *,
    prompt: str,
    bad_response: str,
    failure_type: str,
    task_type: str = "",
    corrected_response: str = "",
) -> None:
    ensure_failures_table()
    with sqlite3.connect(DB_PATH) as conn:
        conn.execute(
            """
            INSERT INTO failures (prompt, bad_response, failure_type, corrected_response, task_type, created_at)
            VALUES (?, ?, ?, ?, ?, ?)
            """,
            (
                prompt,
                bad_response,
                failure_type,
                corrected_response,
                task_type,
                datetime.now(timezone.utc).isoformat(timespec="seconds"),
            ),
        )
        conn.commit()
