"""Approval gate for NexusAI controlled autonomy (v0.3 Step 1).

Manages human approval decisions for task steps.

Rules
-----
* Default state for any step is blocked / rejected.
* ``is_approved(task_id, step_id)`` returns ``False`` unless an explicit
  ``approve()`` call was made.
* Approving a step only records the decision – it never executes anything.
* All decisions are logged to the audit log.
"""

from __future__ import annotations

from typing import Any

import audit_log as _audit

# Decision values
DECISION_APPROVED = "approved"
DECISION_REJECTED = "rejected"
DECISION_CHANGES_REQUESTED = "changes_requested"
DECISION_PENDING = "pending"  # no decision yet → treated as blocked


class ApprovalGate:
    """In-memory decision store for task/step approval.

    Decisions are keyed by ``(task_id, step_id)`` tuples.
    The store is intentionally in-memory for v0.3 Step 1.
    All changes are recorded in the audit log for traceability.
    """

    def __init__(self) -> None:
        self._decisions: dict[tuple[str, str], dict[str, Any]] = {}

    # ------------------------------------------------------------------
    # Write operations
    # ------------------------------------------------------------------

    def approve(
        self,
        task_id: str,
        step_id: str,
        *,
        reason: str | None = None,
    ) -> dict[str, Any]:
        """Record an *approved* decision for the given step.

        This only stores the decision.  It does NOT execute the step.
        """
        entry = self._record(task_id, step_id, DECISION_APPROVED, reason)
        _audit.log_event(
            "approval_granted",
            task_id=task_id,
            step_id=step_id,
            details={"reason": reason, "auto_applied": False},
        )
        return entry

    def reject(
        self,
        task_id: str,
        step_id: str,
        *,
        reason: str | None = None,
    ) -> dict[str, Any]:
        """Record a *rejected* decision for the given step."""
        entry = self._record(task_id, step_id, DECISION_REJECTED, reason)
        _audit.log_event(
            "approval_rejected",
            task_id=task_id,
            step_id=step_id,
            details={"reason": reason},
        )
        return entry

    def request_changes(
        self,
        task_id: str,
        step_id: str,
        *,
        reason: str | None = None,
    ) -> dict[str, Any]:
        """Record a *changes_requested* decision for the given step."""
        entry = self._record(task_id, step_id, DECISION_CHANGES_REQUESTED, reason)
        _audit.log_event(
            "changes_requested",
            task_id=task_id,
            step_id=step_id,
            details={"reason": reason},
        )
        return entry

    # ------------------------------------------------------------------
    # Read operations
    # ------------------------------------------------------------------

    def get_decision(self, task_id: str, step_id: str) -> dict[str, Any]:
        """Return the current decision dict for the step.

        If no decision has been recorded, returns a *pending* (blocked)
        entry with ``decision="pending"`` and ``is_approved=False``.
        """
        key = (task_id, step_id)
        if key in self._decisions:
            return dict(self._decisions[key])
        return {
            "task_id": task_id,
            "step_id": step_id,
            "decision": DECISION_PENDING,
            "reason": None,
            "is_approved": False,
            "auto_applied": False,
        }

    def is_approved(self, task_id: str, step_id: str) -> bool:
        """Return ``True`` only if an explicit ``approve()`` was called."""
        key = (task_id, step_id)
        if key not in self._decisions:
            return False
        return self._decisions[key]["decision"] == DECISION_APPROVED

    # ------------------------------------------------------------------
    # Internal helpers
    # ------------------------------------------------------------------

    def _record(
        self,
        task_id: str,
        step_id: str,
        decision: str,
        reason: str | None,
    ) -> dict[str, Any]:
        from datetime import datetime, timezone

        entry: dict[str, Any] = {
            "task_id": task_id,
            "step_id": step_id,
            "decision": decision,
            "reason": reason,
            "is_approved": decision == DECISION_APPROVED,
            "auto_applied": False,
            "recorded_at": datetime.now(tz=timezone.utc).isoformat(),
        }
        self._decisions[(task_id, step_id)] = entry
        return dict(entry)


# ---------------------------------------------------------------------------
# Module-level singleton and convenience functions
# ---------------------------------------------------------------------------

_default_gate: ApprovalGate | None = None


def _get_gate() -> ApprovalGate:
    global _default_gate
    if _default_gate is None:
        _default_gate = ApprovalGate()
    return _default_gate


def approve(task_id: str, step_id: str, *, reason: str | None = None) -> dict[str, Any]:
    return _get_gate().approve(task_id, step_id, reason=reason)


def reject(task_id: str, step_id: str, *, reason: str | None = None) -> dict[str, Any]:
    return _get_gate().reject(task_id, step_id, reason=reason)


def request_changes(task_id: str, step_id: str, *, reason: str | None = None) -> dict[str, Any]:
    return _get_gate().request_changes(task_id, step_id, reason=reason)


def get_decision(task_id: str, step_id: str) -> dict[str, Any]:
    return _get_gate().get_decision(task_id, step_id)


def is_approved(task_id: str, step_id: str) -> bool:
    return _get_gate().is_approved(task_id, step_id)
