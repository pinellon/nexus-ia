"""Autonomy plan definitions for NexusAI controlled autonomy (v0.3 Step 1).

Provides ``PlanStep`` and ``AutonomyPlan`` dataclasses.

Key rules
---------
* If a step is marked ``mutable=True``, ``requires_approval`` is automatically
  forced to ``True`` regardless of the caller's value.
* This module never executes any actions.
"""

from __future__ import annotations

import uuid
from dataclasses import dataclass, field
from typing import Any

from task_queue import TaskStatus

# ---------------------------------------------------------------------------
# Action types
# ---------------------------------------------------------------------------

ALLOWED_ACTION_TYPES: frozenset[str] = frozenset(
    {
        "read_only",
        "analysis",
        "test",
        "patch_proposal",
        "write_request",
        "command_request",
        "rollback_request",
    }
)

# Action types that are always considered mutable (belt-and-suspenders)
_INHERENTLY_MUTABLE: frozenset[str] = frozenset(
    {"patch_proposal", "write_request", "command_request", "rollback_request"}
)


@dataclass
class PlanStep:
    """A single step in an autonomy plan.

    Parameters
    ----------
    description:
        Human-readable description of the step.
    action_type:
        Must be one of :data:`ALLOWED_ACTION_TYPES`.
    mutable:
        Whether this step changes project state.  Steps with certain
        action types (e.g. ``patch_proposal``) are automatically treated
        as mutable.
    requires_approval:
        Automatically forced to ``True`` when ``mutable`` is ``True``.
    step_id:
        Stable UUID v4 string.  Auto-generated if not supplied.
    status:
        Current step status string (mirrors ``TaskStatus`` vocabulary).
    """

    description: str
    action_type: str
    mutable: bool = False
    requires_approval: bool = False
    step_id: str = field(default_factory=lambda: str(uuid.uuid4()))
    status: str = TaskStatus.PENDING.value

    def __post_init__(self) -> None:
        if self.action_type not in ALLOWED_ACTION_TYPES:
            raise ValueError(
                f"Invalid action_type {self.action_type!r}. "
                f"Allowed: {sorted(ALLOWED_ACTION_TYPES)}"
            )
        # Inherently mutable action types upgrade the flag
        if self.action_type in _INHERENTLY_MUTABLE:
            self.mutable = True
        # Mutable always requires approval
        if self.mutable:
            self.requires_approval = True

    # ------------------------------------------------------------------
    # Serialisation
    # ------------------------------------------------------------------

    def to_dict(self) -> dict[str, Any]:
        return {
            "step_id": self.step_id,
            "description": self.description,
            "action_type": self.action_type,
            "mutable": self.mutable,
            "requires_approval": self.requires_approval,
            "status": self.status,
        }

    @classmethod
    def from_dict(cls, data: dict[str, Any]) -> "PlanStep":
        return cls(
            step_id=data["step_id"],
            description=data["description"],
            action_type=data["action_type"],
            mutable=data.get("mutable", False),
            requires_approval=data.get("requires_approval", False),
            status=data.get("status", TaskStatus.PENDING.value),
        )


@dataclass
class AutonomyPlan:
    """A multi-step plan associated with a task.

    Parameters
    ----------
    task_id:
        The UUID of the parent task.
    steps:
        Ordered list of :class:`PlanStep` objects.
    """

    task_id: str
    steps: list[PlanStep] = field(default_factory=list)

    def add_step(
        self,
        description: str,
        action_type: str,
        *,
        mutable: bool = False,
        requires_approval: bool = False,
    ) -> PlanStep:
        """Create a step, append it to the plan, and return it."""
        step = PlanStep(
            description=description,
            action_type=action_type,
            mutable=mutable,
            requires_approval=requires_approval,
        )
        self.steps.append(step)
        return step

    def pending_approval_steps(self) -> list[PlanStep]:
        """Return steps that require approval and have not been approved yet."""
        return [
            s for s in self.steps
            if s.requires_approval and s.status == TaskStatus.WAITING_APPROVAL.value
        ]

    # ------------------------------------------------------------------
    # Serialisation
    # ------------------------------------------------------------------

    def to_dict(self) -> dict[str, Any]:
        return {
            "task_id": self.task_id,
            "steps": [s.to_dict() for s in self.steps],
        }

    @classmethod
    def from_dict(cls, data: dict[str, Any]) -> "AutonomyPlan":
        return cls(
            task_id=data["task_id"],
            steps=[PlanStep.from_dict(s) for s in data.get("steps", [])],
        )


def build_default_plan(task_id: str, prompt: str) -> AutonomyPlan:
    """Build a sensible default multi-step plan for a given *prompt*.

    This is a lightweight heuristic plan generator.  Future versions
    can call an LLM to generate a more contextual plan.
    """
    plan = AutonomyPlan(task_id=task_id)
    prompt_lower = prompt.lower()

    # Always start with read-only analysis
    plan.add_step("Analyse current codebase and gather context", "read_only")
    plan.add_step("Identify files relevant to the task", "analysis")

    # If the prompt suggests testing
    if any(kw in prompt_lower for kw in ("test", "spec", "assert", "check")):
        plan.add_step("Run existing test suite to establish baseline", "test")

    # Propose a patch only if the prompt suggests modification
    if any(kw in prompt_lower for kw in ("add", "fix", "update", "change", "refactor", "implement", "create", "remove", "delete", "validation")):
        plan.add_step(
            "Propose code patch addressing the task",
            "patch_proposal",
            mutable=True,
        )

    # If commands are involved
    if any(kw in prompt_lower for kw in ("run", "execute", "command", "deploy", "install")):
        plan.add_step(
            "Propose command(s) required to complete the task",
            "command_request",
            mutable=True,
        )

    # Always end with a read-only verification step
    plan.add_step("Verify and summarise proposed changes", "analysis")

    return plan
