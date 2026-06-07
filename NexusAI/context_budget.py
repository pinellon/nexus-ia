"""Context budget selection for NexusAI repo mode."""

from __future__ import annotations

from pathlib import Path


PRIORITY_ORDER = {
    "user_instruction": 100,
    "direct_files": 90,
    "project_decisions": 80,
    "recent_errors": 70,
    "memory": 60,
    "docs": 50,
}


def trim_text(text: str, budget_chars: int) -> str:
    if len(text) <= budget_chars:
        return text
    head = max(0, budget_chars // 2)
    tail = max(0, budget_chars - head - 80)
    return text[:head] + "\n\n[...context trimmed...]\n\n" + text[-tail:]


def apply_context_budget(context: dict, *, max_chars: int = 48_000) -> dict:
    remaining = max_chars
    budgeted = {"index": context.get("index", {}), "selected_files": [], "docs": {}, "files": []}

    for rel, text in context.get("docs", {}).items():
        if remaining <= 0:
            break
        chunk_budget = min(6000, remaining)
        budgeted["docs"][rel] = trim_text(text, chunk_budget)
        remaining -= len(budgeted["docs"][rel])

    for item in context.get("files", []):
        if remaining <= 0:
            break
        rel = item["path"]
        content = item.get("content", "")
        chunk_budget = min(12000, remaining)
        trimmed = trim_text(content, chunk_budget)
        budgeted["files"].append({"path": rel, "content": trimmed, "original_chars": len(content), "included_chars": len(trimmed)})
        budgeted["selected_files"].append(rel)
        remaining -= len(trimmed)

    budgeted["budget"] = {
        "max_chars": max_chars,
        "used_chars": max_chars - remaining,
        "remaining_chars": max(0, remaining),
        "priority_order": PRIORITY_ORDER,
    }
    return budgeted


def default_budget_for_project(project_dir: str | Path) -> int:
    # Conservative default for a tiny local model.
    return 48_000
