"""Deterministic task planning for NexusAI coder tools."""

from __future__ import annotations

from pathlib import Path

from context_builder import build_context


PLAN_STEP_IDS = [
    "understand_task",
    "locate_relevant_files",
    "propose_change",
    "suggest_tests",
    "assess_risk",
]


def create_plan(project_dir: str | Path, task: str, *, context_limit: int = 8) -> dict:
    context = build_context(project_dir, task, limit=context_limit)
    selected_paths = [item["path"] for item in context.get("selected_files", [])]
    has_tests = any("test" in path.lower() or "spec" in path.lower() for path in selected_paths)

    steps = [
        {
            "id": "understand_task",
            "title": "Understand task",
            "detail": task.strip(),
            "status": "ready",
        },
        {
            "id": "locate_relevant_files",
            "title": "Locate relevant files",
            "detail": selected_paths,
            "status": "ready" if selected_paths else "needs_context",
        },
        {
            "id": "propose_change",
            "title": "Propose change",
            "detail": "Prepare a small reviewable patch; do not apply automatically.",
            "status": "ready",
        },
        {
            "id": "suggest_tests",
            "title": "Suggest tests",
            "detail": "Prefer existing project tests and targeted compile/typecheck commands.",
            "status": "ready" if has_tests else "needs_test_selection",
        },
        {
            "id": "assess_risk",
            "title": "Assess risk",
            "detail": "Check sensitive paths, command safety, size, and scope before proposing edits.",
            "status": "ready",
        },
    ]

    return {
        "task": task,
        "project_dir": context["project_dir"],
        "selected_files": selected_paths,
        "steps": steps,
        "ready": bool(selected_paths),
    }
