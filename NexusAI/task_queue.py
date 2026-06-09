"""Task queue for NexusAI controlled autonomy (v0.3 Step 1).

Provides a persistent task queue backed by JSON stored in
NexusAI/memory/task_queue.json.  Task IDs are stable UUID v4 strings.
This module never executes any actions; it only manages task state.
"""

from __future__ import annotations

import json
import uuid
from datetime import datetime, timezone
from enum import Enum
from pathlib import Path
from typing import Any

_MEMORY_DIR = Path(__file__).parent / "memory"
_QUEUE_FILE = _MEMORY_DIR / "task_queue.json"


class TaskStatus(str, Enum):
    PENDING = "pending"
    PLANNED = "planned"
    WAITING_APPROVAL = "waiting_approval"
    APPROVED = "approved"
    RUNNING = "running"
    COMPLETED = "completed"
    FAILED = "failed"
    CANCELLED = "cancelled"


# Valid transitions (from → allowed-tos)
_TRANSITIONS: dict[TaskStatus, set[TaskStatus]] = {
    TaskStatus.PENDING: {TaskStatus.PLANNED, TaskStatus.CANCELLED},
    TaskStatus.PLANNED: {TaskStatus.WAITING_APPROVAL, TaskStatus.CANCELLED},
    TaskStatus.WAITING_APPROVAL: {
        TaskStatus.APPROVED,
        TaskStatus.CANCELLED,
        TaskStatus.FAILED,
    },
    TaskStatus.APPROVED: {TaskStatus.RUNNING, TaskStatus.CANCELLED},
    TaskStatus.RUNNING: {TaskStatus.COMPLETED, TaskStatus.FAILED, TaskStatus.CANCELLED},
    TaskStatus.COMPLETED: set(),
    TaskStatus.FAILED: set(),
    TaskStatus.CANCELLED: set(),
}


def _now_iso() -> str:
    return datetime.now(tz=timezone.utc).isoformat()


class TaskQueue:
    """In-memory task queue with JSON persistence."""

    def __init__(self) -> None:
        self._tasks: dict[str, dict[str, Any]] = {}
        self.load()

    # ------------------------------------------------------------------
    # Public API
    # ------------------------------------------------------------------

    def create_task(self, prompt: str, metadata: dict[str, Any] | None = None) -> dict[str, Any]:
        """Create a new task in *pending* state and persist it.

        Returns the created task dict including its UUID v4 ``task_id``.
        """
        task_id = str(uuid.uuid4())
        task: dict[str, Any] = {
            "task_id": task_id,
            "prompt": prompt,
            "status": TaskStatus.PENDING.value,
            "created_at": _now_iso(),
            "updated_at": _now_iso(),
            "metadata": metadata or {},
        }
        self._tasks[task_id] = task
        self.save()
        return dict(task)

    def get_task(self, task_id: str) -> dict[str, Any] | None:
        """Return a copy of the task dict, or *None* if not found."""
        task = self._tasks.get(task_id)
        return dict(task) if task else None

    def update_status(
        self,
        task_id: str,
        status: str | TaskStatus,
        *,
        reason: str | None = None,
    ) -> dict[str, Any]:
        """Update task status, enforcing valid transitions.

        Returns the updated task dict.
        Raises ``KeyError`` if task not found.
        Raises ``ValueError`` if the transition is invalid.
        """
        task = self._tasks.get(task_id)
        if task is None:
            raise KeyError(f"Task not found: {task_id!r}")
        new_status = TaskStatus(status)
        current_status = TaskStatus(task["status"])
        allowed = _TRANSITIONS.get(current_status, set())
        if new_status not in allowed:
            raise ValueError(
                f"Invalid transition {current_status.value!r} → {new_status.value!r}. "
                f"Allowed: {[s.value for s in allowed]}"
            )
        task["status"] = new_status.value
        task["updated_at"] = _now_iso()
        if reason is not None:
            task.setdefault("history", []).append(
                {"status": new_status.value, "reason": reason, "at": task["updated_at"]}
            )
        self.save()
        return dict(task)

    def list_tasks(self, status: str | TaskStatus | None = None) -> list[dict[str, Any]]:
        """Return all tasks, optionally filtered by *status*."""
        tasks = list(self._tasks.values())
        if status is not None:
            filter_val = TaskStatus(status).value
            tasks = [t for t in tasks if t["status"] == filter_val]
        return [dict(t) for t in tasks]

    # ------------------------------------------------------------------
    # Persistence
    # ------------------------------------------------------------------

    def save(self) -> None:
        """Persist tasks to disk."""
        _MEMORY_DIR.mkdir(parents=True, exist_ok=True)
        _QUEUE_FILE.write_text(
            json.dumps({"tasks": list(self._tasks.values())}, indent=2, ensure_ascii=False),
            encoding="utf-8",
        )

    def load(self) -> None:
        """Load tasks from disk (no-op if file does not exist)."""
        if not _QUEUE_FILE.is_file():
            return
        try:
            data = json.loads(_QUEUE_FILE.read_text(encoding="utf-8"))
            for task in data.get("tasks", []):
                self._tasks[task["task_id"]] = task
        except (json.JSONDecodeError, KeyError):
            # Corrupted file – start fresh
            self._tasks = {}


# Module-level singleton for convenience
_default_queue: TaskQueue | None = None


def _get_queue() -> TaskQueue:
    global _default_queue
    if _default_queue is None:
        _default_queue = TaskQueue()
    return _default_queue


def create_task(prompt: str, metadata: dict[str, Any] | None = None) -> dict[str, Any]:
    return _get_queue().create_task(prompt, metadata)


def get_task(task_id: str) -> dict[str, Any] | None:
    return _get_queue().get_task(task_id)


def update_status(task_id: str, status: str | TaskStatus, *, reason: str | None = None) -> dict[str, Any]:
    return _get_queue().update_status(task_id, status, reason=reason)


def list_tasks(status: str | TaskStatus | None = None) -> list[dict[str, Any]]:
    return _get_queue().list_tasks(status)


def save() -> None:
    _get_queue().save()


def load() -> None:
    _get_queue().load()
