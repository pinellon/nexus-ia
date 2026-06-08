"""Autonomy controller for NexusAI controlled autonomy (v0.3 Step 1).

Orchestrates task creation, plan generation, approval handling,
cancellation and status reporting.

Invariants
----------
* ``auto_applied`` is always ``False`` in every returned payload.
* Mutable steps are never executed automatically.
* Steps requiring approval remain in ``waiting_approval`` status until
  an explicit human ``approve()`` call is made.
* Cancellation is always available.
* Plans are persisted to NexusAI/memory/autonomy_plans.json so that
  CLI commands in separate subprocess invocations can access plan data.
"""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any

import audit_log as _audit
import approval_gate as _gate
from autonomy_plan import AutonomyPlan, PlanStep, build_default_plan
from task_queue import TaskQueue, TaskStatus

# auto_applied is permanently False for all payloads
_AUTO_APPLIED = False

_MEMORY_DIR = Path(__file__).parent / "memory"
_PLANS_FILE = _MEMORY_DIR / "autonomy_plans.json"


class AutonomyController:
    """Orchestrates the controlled-autonomy lifecycle for a task."""

    def __init__(self) -> None:
        self._queue = TaskQueue()
        self._gate = _gate.ApprovalGate()
        # task_id → AutonomyPlan (loaded from disk on init)
        self._plans: dict[str, AutonomyPlan] = {}
        self._load_plans()

    # ------------------------------------------------------------------
    # Plan persistence
    # ------------------------------------------------------------------

    def _save_plans(self) -> None:
        """Persist all plans to disk."""
        _MEMORY_DIR.mkdir(parents=True, exist_ok=True)
        data = {tid: plan.to_dict() for tid, plan in self._plans.items()}
        _PLANS_FILE.write_text(
            json.dumps(data, indent=2, ensure_ascii=False), encoding="utf-8"
        )

    def _load_plans(self) -> None:
        """Load plans from disk (no-op if file does not exist or is corrupted)."""
        if not _PLANS_FILE.is_file():
            return
        try:
            raw = json.loads(_PLANS_FILE.read_text(encoding="utf-8"))
            for tid, plan_data in raw.items():
                self._plans[tid] = AutonomyPlan.from_dict(plan_data)
        except (json.JSONDecodeError, KeyError, TypeError):
            self._plans = {}

    # ------------------------------------------------------------------
    # Task creation and plan generation
    # ------------------------------------------------------------------

    def create_task_and_plan(self, prompt: str, root: str = ".") -> dict[str, Any]:
        """Create a task and generate a default multi-step plan.

        Returns a JSON-serialisable dict with ``task_id``, ``status``,
        ``steps`` and ``auto_applied: false``.
        Mutable steps are automatically moved to ``waiting_approval``.
        """
        # 1. Create the task
        task = self._queue.create_task(prompt, metadata={"root": root})
        task_id: str = task["task_id"]
        _audit.log_event("task_created", task_id=task_id, details={"prompt": prompt})

        # 2. Generate plan
        plan = build_default_plan(task_id, prompt)
        self._plans[task_id] = plan
        _audit.log_event("plan_created", task_id=task_id, details={"step_count": len(plan.steps)})

        # 3. Update task to planned
        self._queue.update_status(task_id, TaskStatus.PLANNED)

        # 4. Process steps: mark mutable ones as waiting_approval
        has_mutable = False
        for step in plan.steps:
            if step.requires_approval:
                step.status = TaskStatus.WAITING_APPROVAL.value
                has_mutable = True
                _audit.log_event(
                    "approval_required",
                    task_id=task_id,
                    step_id=step.step_id,
                    details={"description": step.description, "action_type": step.action_type},
                )

        # 5. Move task to waiting_approval if any mutable steps exist
        if has_mutable:
            self._queue.update_status(task_id, TaskStatus.WAITING_APPROVAL)

        # 6. Persist plan to disk so future subprocess calls can access it
        self._save_plans()

        return self._task_payload(task_id)

    # ------------------------------------------------------------------
    # Status
    # ------------------------------------------------------------------

    def get_status(self, task_id: str) -> dict[str, Any]:
        """Return the current status payload for a task."""
        task = self._queue.get_task(task_id)
        if task is None:
            return {"error": f"Task not found: {task_id}", "auto_applied": _AUTO_APPLIED}
        return self._task_payload(task_id)

    # ------------------------------------------------------------------
    # Approval actions (record-only – never executes)
    # ------------------------------------------------------------------

    def approve_step(self, task_id: str, step_id: str, *, reason: str | None = None) -> dict[str, Any]:
        """Record an approval for *step_id*.

        This ONLY stores the decision and updates step status to ``approved``.
        It does NOT execute the step.
        """
        task = self._queue.get_task(task_id)
        if task is None:
            return {"error": f"Task not found: {task_id}", "auto_applied": _AUTO_APPLIED}

        plan = self._plans.get(task_id)
        step = self._find_step(plan, step_id)
        if step is None:
            return {"error": f"Step not found: {step_id}", "auto_applied": _AUTO_APPLIED}

        decision = self._gate.approve(task_id, step_id, reason=reason)
        step.status = TaskStatus.APPROVED.value
        self._save_plans()

        return {
            "task_id": task_id,
            "step_id": step_id,
            "action": "approved",
            "decision": decision,
            "auto_applied": _AUTO_APPLIED,
            "note": "Approval recorded. The step will NOT be executed automatically.",
        }

    def reject_step(self, task_id: str, step_id: str, *, reason: str | None = None) -> dict[str, Any]:
        """Record a rejection for *step_id*."""
        task = self._queue.get_task(task_id)
        if task is None:
            return {"error": f"Task not found: {task_id}", "auto_applied": _AUTO_APPLIED}

        plan = self._plans.get(task_id)
        step = self._find_step(plan, step_id)
        if step is None:
            return {"error": f"Step not found: {step_id}", "auto_applied": _AUTO_APPLIED}

        decision = self._gate.reject(task_id, step_id, reason=reason)
        step.status = TaskStatus.CANCELLED.value
        self._save_plans()

        return {
            "task_id": task_id,
            "step_id": step_id,
            "action": "rejected",
            "decision": decision,
            "auto_applied": _AUTO_APPLIED,
        }

    def request_changes_on_step(
        self,
        task_id: str,
        step_id: str,
        *,
        reason: str | None = None,
    ) -> dict[str, Any]:
        """Record a *changes_requested* decision for *step_id*."""
        task = self._queue.get_task(task_id)
        if task is None:
            return {"error": f"Task not found: {task_id}", "auto_applied": _AUTO_APPLIED}

        plan = self._plans.get(task_id)
        step = self._find_step(plan, step_id)
        if step is None:
            return {"error": f"Step not found: {step_id}", "auto_applied": _AUTO_APPLIED}

        decision = self._gate.request_changes(task_id, step_id, reason=reason)
        step.status = TaskStatus.WAITING_APPROVAL.value
        self._save_plans()

        return {
            "task_id": task_id,
            "step_id": step_id,
            "action": "changes_requested",
            "decision": decision,
            "auto_applied": _AUTO_APPLIED,
        }

    # ------------------------------------------------------------------
    # Cancellation
    # ------------------------------------------------------------------

    def cancel_task(self, task_id: str, *, reason: str | None = None) -> dict[str, Any]:
        """Cancel a task and all its pending steps."""
        task = self._queue.get_task(task_id)
        if task is None:
            return {"error": f"Task not found: {task_id}", "auto_applied": _AUTO_APPLIED}

        current_status = task["status"]
        terminal = {TaskStatus.COMPLETED.value, TaskStatus.FAILED.value, TaskStatus.CANCELLED.value}
        if current_status in terminal:
            return {
                "task_id": task_id,
                "action": "cancel",
                "error": f"Task already in terminal state: {current_status!r}",
                "auto_applied": _AUTO_APPLIED,
            }

        updated = self._queue.update_status(task_id, TaskStatus.CANCELLED, reason=reason)
        plan = self._plans.get(task_id)
        if plan:
            for step in plan.steps:
                if step.status not in (TaskStatus.COMPLETED.value, TaskStatus.FAILED.value, TaskStatus.CANCELLED.value):
                    step.status = TaskStatus.CANCELLED.value
            self._save_plans()

        _audit.log_event(
            "task_cancelled",
            task_id=task_id,
            details={"reason": reason, "previous_status": current_status},
        )

        return {
            "task_id": task_id,
            "action": "cancelled",
            "task": updated,
            "auto_applied": _AUTO_APPLIED,
        }

    # ------------------------------------------------------------------
    # Internal helpers
    # ------------------------------------------------------------------

    def _find_step(self, plan: AutonomyPlan | None, step_id: str) -> PlanStep | None:
        if plan is None:
            return None
        for step in plan.steps:
            if step.step_id == step_id:
                return step
        return None

    def _task_payload(self, task_id: str) -> dict[str, Any]:
        task = self._queue.get_task(task_id) or {}
        plan = self._plans.get(task_id)
        steps_data: list[dict[str, Any]] = []
        if plan:
            for step in plan.steps:
                sd = step.to_dict()
                if step.requires_approval:
                    sd["approval_decision"] = self._gate.get_decision(task_id, step.step_id)["decision"]
                    sd["is_approved"] = self._gate.is_approved(task_id, step.step_id)
                steps_data.append(sd)

        return {
            "task_id": task_id,
            "status": task.get("status"),
            "prompt": task.get("prompt"),
            "created_at": task.get("created_at"),
            "updated_at": task.get("updated_at"),
            "steps": steps_data,
            "auto_applied": _AUTO_APPLIED,
        }


# ---------------------------------------------------------------------------
# Module-level singleton and convenience functions
# ---------------------------------------------------------------------------

_default_controller: AutonomyController | None = None


def _get_controller() -> AutonomyController:
    global _default_controller
    if _default_controller is None:
        _default_controller = AutonomyController()
    return _default_controller


def create_task_and_plan(prompt: str, root: str = ".") -> dict[str, Any]:
    return _get_controller().create_task_and_plan(prompt, root)


def get_status(task_id: str) -> dict[str, Any]:
    return _get_controller().get_status(task_id)


def approve_step(task_id: str, step_id: str, *, reason: str | None = None) -> dict[str, Any]:
    return _get_controller().approve_step(task_id, step_id, reason=reason)


def reject_step(task_id: str, step_id: str, *, reason: str | None = None) -> dict[str, Any]:
    return _get_controller().reject_step(task_id, step_id, reason=reason)


def request_changes_on_step(task_id: str, step_id: str, *, reason: str | None = None) -> dict[str, Any]:
    return _get_controller().request_changes_on_step(task_id, step_id, reason=reason)


def cancel_task(task_id: str, *, reason: str | None = None) -> dict[str, Any]:
    return _get_controller().cancel_task(task_id, reason=reason)
