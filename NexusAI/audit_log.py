"""Audit log for NexusAI controlled autonomy (v0.3 Step 1).

Appends newline-delimited JSON events to NexusAI/memory/audit_log.jsonl.
Secret values are redacted before writing.

Supported event types
---------------------
task_created, plan_created, approval_required, approval_granted,
approval_rejected, changes_requested, task_cancelled, task_completed,
task_failed, snapshot_created, step_execution_started, patch_applied,
command_executed, rollback_started, rollback_completed,
step_execution_failed
"""

from __future__ import annotations

import json
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

_MEMORY_DIR = Path(__file__).parent / "memory"
_LOG_FILE = _MEMORY_DIR / "audit_log.jsonl"

# Keys whose values will be redacted in audit log entries
_SECRET_KEYS: frozenset[str] = frozenset(
    {
        "token",
        "secret",
        "password",
        "api_key",
        "private_key",
        "credential",
        "authorization",
        "access_token",
        "refresh_token",
    }
)

ALLOWED_EVENT_TYPES: frozenset[str] = frozenset(
    {
        "task_created",
        "plan_created",
        "approval_required",
        "approval_granted",
        "approval_rejected",
        "changes_requested",
        "task_cancelled",
        "task_completed",
        "task_failed",
        "snapshot_created",
        "step_execution_started",
        "patch_applied",
        "command_executed",
        "rollback_started",
        "rollback_completed",
        "step_execution_failed",
    }
)


def _sanitise(obj: Any, _depth: int = 0) -> Any:
    """Recursively redact secret values in dicts."""
    if _depth > 10:
        return obj
    if isinstance(obj, dict):
        return {
            k: "****" if k.lower() in _SECRET_KEYS else _sanitise(v, _depth + 1)
            for k, v in obj.items()
        }
    if isinstance(obj, list):
        return [_sanitise(item, _depth + 1) for item in obj]
    return obj


def log_event(
    event_type: str,
    *,
    task_id: str | None = None,
    step_id: str | None = None,
    details: dict[str, Any] | None = None,
) -> dict[str, Any]:
    """Append an event to the audit log.

    ``details`` values are sanitised before writing – secret keys are
    replaced with ``"****"``.
    Returns the log entry dict (useful for testing).
    """
    if event_type not in ALLOWED_EVENT_TYPES:
        raise ValueError(
            f"Unknown event type: {event_type!r}. Allowed: {sorted(ALLOWED_EVENT_TYPES)}"
        )
    entry: dict[str, Any] = {
        "event_type": event_type,
        "timestamp": datetime.now(tz=timezone.utc).isoformat(),
    }
    if task_id is not None:
        entry["task_id"] = task_id
    if step_id is not None:
        entry["step_id"] = step_id
    if details:
        entry["details"] = _sanitise(details)
    _write_entry(entry)
    return entry


def _write_entry(entry: dict[str, Any]) -> None:
    _MEMORY_DIR.mkdir(parents=True, exist_ok=True)
    with _LOG_FILE.open("a", encoding="utf-8") as fh:
        fh.write(json.dumps(entry, ensure_ascii=False) + "\n")


def list_events(task_id: str | None = None) -> list[dict[str, Any]]:
    """Return events from the audit log, optionally filtered by *task_id*."""
    if not _LOG_FILE.is_file():
        return []
    events: list[dict[str, Any]] = []
    with _LOG_FILE.open("r", encoding="utf-8") as fh:
        for line in fh:
            line = line.strip()
            if not line:
                continue
            try:
                entry = json.loads(line)
            except json.JSONDecodeError:
                continue
            if task_id is None or entry.get("task_id") == task_id:
                events.append(entry)
    return events
