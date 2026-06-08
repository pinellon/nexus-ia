"""Deterministic context selection for NexusAI coder tools."""

from __future__ import annotations

import re
from pathlib import Path

from repo_indexer import build_project_index, read_small_text, resolve_project_dir


LANGUAGE_HINTS = {
    "python": {".py", "requirements.txt", "pyproject.toml", "unittest", "pytest"},
    "typescript": {".ts", ".tsx", "tsconfig.json", "package.json", "vite.config.ts"},
    "javascript": {".js", ".jsx", "package.json", "vite.config.js"},
    "json": {".json", "json"},
    "markdown": {".md", "readme", "docs"},
    "config": {"package.json", "tsconfig.json", ".toml", ".yml", ".yaml", ".env.example"},
    "tests": {"test", "tests", "spec", "unittest", "vitest"},
}

MAX_DEFAULT_FILE_BYTES = 80_000


def tokenize_task(task: str) -> set[str]:
    return {
        token
        for token in re.findall(r"[a-zA-Z0-9_.\\/-]+", task.lower())
        if len(token) >= 3
    }


def _path_tokens(path: str) -> set[str]:
    return set(re.findall(r"[a-zA-Z0-9_]+", path.lower()))


def _score_file(file_info: dict, task_terms: set[str]) -> tuple[int, list[str]]:
    path = str(file_info.get("path", ""))
    lowered = path.lower()
    ext = str(file_info.get("extension") or file_info.get("ext") or "").lower()
    probable_type = str(file_info.get("probable_type", "")).lower()
    reasons: list[str] = []
    score = 0

    if file_info.get("important"):
        score += 5
        reasons.append("important file")

    for term in task_terms:
        normalized = term.strip("./\\")
        if not normalized:
            continue
        if normalized in lowered:
            score += 4
            reasons.append(f"path matches `{normalized}`")
        elif normalized in probable_type:
            score += 3
            reasons.append(f"type matches `{normalized}`")
        elif normalized in _path_tokens(path):
            score += 2
            reasons.append(f"name token matches `{normalized}`")

    for hint, values in LANGUAGE_HINTS.items():
        if hint in task_terms and (ext in values or path.lower() in values or probable_type == hint):
            score += 4
            reasons.append(f"{hint} task signal")

    if any(term in {"test", "tests", "unittest", "vitest", "pytest"} for term in task_terms):
        if "test" in lowered or "spec" in lowered:
            score += 4
            reasons.append("test file signal")

    if ext in {".py", ".ts", ".tsx", ".js", ".jsx", ".json", ".md"}:
        score += 1

    return score, reasons


def build_context(
    project_dir: str | Path,
    task: str,
    *,
    limit: int = 8,
    max_file_bytes: int = MAX_DEFAULT_FILE_BYTES,
    max_read_chars: int = 12_000,
) -> dict:
    root = resolve_project_dir(project_dir)
    index = build_project_index(root)
    task_terms = tokenize_task(task)
    scored: list[tuple[int, str, dict, list[str]]] = []

    for file_info in index.get("files", []):
        path = str(file_info.get("path", ""))
        score, reasons = _score_file(file_info, task_terms)
        if score <= 0:
            continue
        scored.append((score, path, file_info, reasons))

    selected = []
    for priority, path, file_info, reasons in sorted(scored, key=lambda item: (-item[0], item[1]))[:limit]:
        abs_path = root / path
        size_bytes = int(file_info.get("size_bytes") or file_info.get("size") or 0)
        entry = {
            "path": path,
            "priority": priority,
            "reason": "; ".join(dict.fromkeys(reasons)) or "matched task context",
            "probable_type": file_info.get("probable_type", "unknown"),
            "size_bytes": size_bytes,
            "content": "",
            "content_truncated": False,
        }
        if abs_path.is_file() and size_bytes <= max_file_bytes:
            content = read_small_text(abs_path, limit=max_read_chars)
            entry["content"] = content
            entry["content_truncated"] = len(content) >= max_read_chars
        else:
            entry["reason"] += "; skipped large file content"
        selected.append(entry)

    return {
        "task": task,
        "project_dir": str(root),
        "selected_files": selected,
        "index_summary": {
            "project_name": index.get("project_name"),
            "stack": index.get("stack", []),
            "file_count": index.get("file_count", 0),
            "entrypoints": index.get("entrypoints", {}),
        },
    }
