"""Task success metrics and replay storage for NexusAI."""

from __future__ import annotations

import argparse
import json
import sqlite3
import time
from datetime import datetime, timezone
from pathlib import Path
from typing import Any


BASE_DIR = Path(__file__).parent
DB_PATH = BASE_DIR / "memory" / "memory.db"

FINAL_STATUSES = {"resolved", "assisted", "failed"}


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="seconds")


def ensure_task_tables() -> None:
    DB_PATH.parent.mkdir(parents=True, exist_ok=True)
    with sqlite3.connect(DB_PATH) as conn:
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS task_sessions (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                project_dir TEXT,
                prompt TEXT NOT NULL,
                command TEXT,
                status TEXT NOT NULL,
                started_at TEXT NOT NULL,
                finished_at TEXT,
                duration_s REAL,
                result_summary TEXT
            )
            """
        )
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS task_events (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                session_id INTEGER NOT NULL,
                event_type TEXT NOT NULL,
                payload_json TEXT NOT NULL,
                created_at TEXT NOT NULL,
                FOREIGN KEY(session_id) REFERENCES task_sessions(id)
            )
            """
        )
        conn.commit()


def start_session(prompt: str, *, project_dir: str = "", command: str = "") -> int:
    ensure_task_tables()
    with sqlite3.connect(DB_PATH) as conn:
        cur = conn.execute(
            """
            INSERT INTO task_sessions (project_dir, prompt, command, status, started_at)
            VALUES (?, ?, ?, ?, ?)
            """,
            (project_dir, prompt, command, "running", now_iso()),
        )
        conn.commit()
        return int(cur.lastrowid)


def log_event(session_id: int, event_type: str, payload: dict[str, Any]) -> None:
    ensure_task_tables()
    with sqlite3.connect(DB_PATH) as conn:
        conn.execute(
            """
            INSERT INTO task_events (session_id, event_type, payload_json, created_at)
            VALUES (?, ?, ?, ?)
            """,
            (session_id, event_type, json.dumps(payload, ensure_ascii=False), now_iso()),
        )
        conn.commit()


def finish_session(session_id: int, status: str, *, result_summary: str = "") -> None:
    if status not in FINAL_STATUSES:
        raise ValueError(f"Invalid final status: {status}")
    ensure_task_tables()
    finished = now_iso()
    with sqlite3.connect(DB_PATH) as conn:
        row = conn.execute("SELECT started_at FROM task_sessions WHERE id = ?", (session_id,)).fetchone()
        duration = None
        if row:
            try:
                started_ts = datetime.fromisoformat(row[0]).timestamp()
                duration = round(time.time() - started_ts, 2)
            except ValueError:
                duration = None
        conn.execute(
            """
            UPDATE task_sessions
            SET status = ?, finished_at = ?, duration_s = ?, result_summary = ?
            WHERE id = ?
            """,
            (status, finished, duration, result_summary, session_id),
        )
        conn.commit()


def task_success_summary(limit: int = 200) -> dict:
    ensure_task_tables()
    with sqlite3.connect(DB_PATH) as conn:
        rows = conn.execute(
            """
            SELECT status, COUNT(*)
            FROM (
                SELECT status FROM task_sessions
                WHERE status IN ('resolved', 'assisted', 'failed')
                ORDER BY id DESC
                LIMIT ?
            )
            GROUP BY status
            """,
            (limit,),
        ).fetchall()
    counts = {status: count for status, count in rows}
    resolved = int(counts.get("resolved", 0))
    assisted = int(counts.get("assisted", 0))
    failed = int(counts.get("failed", 0))
    total = resolved + assisted + failed
    return {
        "total": total,
        "resolved": resolved,
        "assisted": assisted,
        "failed": failed,
        "success_rate": round(resolved / total, 3) if total else 0.0,
        "assisted_success_rate": round((resolved + assisted) / total, 3) if total else 0.0,
        "failure_rate": round(failed / total, 3) if total else 0.0,
    }


def replay_session(session_id: int) -> dict:
    ensure_task_tables()
    with sqlite3.connect(DB_PATH) as conn:
        conn.row_factory = sqlite3.Row
        session = conn.execute("SELECT * FROM task_sessions WHERE id = ?", (session_id,)).fetchone()
        events = conn.execute(
            "SELECT event_type, payload_json, created_at FROM task_events WHERE session_id = ? ORDER BY id",
            (session_id,),
        ).fetchall()
    if not session:
        return {}
    return {
        "session": dict(session),
        "events": [
            {
                "event_type": row["event_type"],
                "payload": json.loads(row["payload_json"]),
                "created_at": row["created_at"],
            }
            for row in events
        ],
    }


def main() -> None:
    parser = argparse.ArgumentParser(description="NexusAI task metrics and replay.")
    sub = parser.add_subparsers(dest="cmd", required=True)
    sub.add_parser("summary")
    replay_cmd = sub.add_parser("replay")
    replay_cmd.add_argument("session_id", type=int)
    args = parser.parse_args()
    if args.cmd == "summary":
        print(json.dumps(task_success_summary(), ensure_ascii=False, indent=2))
    else:
        print(json.dumps(replay_session(args.session_id), ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
