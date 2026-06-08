"""Safe deterministic coder-agent orchestration for NexusAI v0.1.1."""

from __future__ import annotations

from pathlib import Path

from code_reviewer import review_coder_change
from context_builder import build_context
from planner import create_plan
from repo_indexer import build_project_index, resolve_project_dir
from test_suggester import suggest_tests


def run_coder_task(project_dir: str | Path, task: str, *, context_limit: int = 8) -> dict:
    root = resolve_project_dir(project_dir)
    index = build_project_index(root)
    context = build_context(root, task, limit=context_limit)
    plan = create_plan(root, task, context_limit=context_limit)
    selected_files = [item["path"] for item in context.get("selected_files", [])]
    suggested_tests = suggest_tests(root, task, selected_files)
    risks = review_coder_change(root, task=task, selected_files=selected_files, suggested_tests=suggested_tests)

    final_status = "blocked" if risks["severity"] == "high" else "ready_for_review"
    if not selected_files:
        final_status = "needs_context"

    return {
        "task": task,
        "project_dir": str(root),
        "index": {
            "project_name": index.get("project_name"),
            "stack": index.get("stack", []),
            "file_count": index.get("file_count", 0),
        },
        "selected_files": context.get("selected_files", []),
        "plan": plan,
        "suggested_tests": suggested_tests,
        "risks": risks,
        "final_status": final_status,
        "auto_applied": False,
    }
