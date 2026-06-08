"""Risk review helpers for NexusAI coder tools."""

from __future__ import annotations

import re
from pathlib import Path

from diff_utils import detect_dangerous_content, is_sensitive_path, normalize_rel_path
from repo_indexer import resolve_project_dir


COMMAND_PATTERNS = [
    re.compile(r"\brm\s+-rf\b", re.IGNORECASE),
    re.compile(r"\bgit\s+reset\s+--hard\b", re.IGNORECASE),
    re.compile(r"\bcurl\b.*\|\s*(sh|bash)", re.IGNORECASE),
    re.compile(r"Remove-Item\s+.*-Recurse", re.IGNORECASE),
]


def _severity_rank(value: str) -> int:
    return {"low": 1, "medium": 2, "high": 3}.get(value, 1)


def _max_severity(findings: list[dict]) -> str:
    if not findings:
        return "low"
    return max((item.get("severity", "low") for item in findings), key=_severity_rank)


def review_coder_change(
    project_dir: str | Path,
    *,
    task: str,
    selected_files: list[str] | None = None,
    changes: list[dict] | None = None,
    suggested_tests: list[str] | None = None,
) -> dict:
    root = resolve_project_dir(project_dir)
    selected_files = selected_files or []
    changes = changes or []
    suggested_tests = suggested_tests or []
    findings: list[dict] = []

    for rel in selected_files:
        normalized = normalize_rel_path(rel)
        target = (root / normalized).resolve()
        if root not in target.parents and target != root:
            findings.append({"severity": "high", "path": normalized, "message": "Selected file escapes project root"})
        if is_sensitive_path(normalized):
            findings.append({"severity": "high", "path": normalized, "message": "Selected file is sensitive or generated"})

    for change in changes:
        path = normalize_rel_path(str(change.get("path", "")))
        if is_sensitive_path(path):
            findings.append({"severity": "high", "path": path, "message": "Patch targets blocked path"})
        content = str(change.get("after", change.get("content", "")))
        for pattern in detect_dangerous_content(content):
            findings.append({"severity": "high", "path": path, "message": f"Dangerous content matched: {pattern}"})

    all_text = " ".join([task, *suggested_tests])
    for pattern in COMMAND_PATTERNS:
        if pattern.search(all_text):
            findings.append({"severity": "high", "path": "", "message": f"Dangerous command pattern: {pattern.pattern}"})

    if not suggested_tests:
        findings.append({"severity": "medium", "path": "", "message": "No tests suggested"})
    if len(changes) > 8:
        findings.append({"severity": "medium", "path": "", "message": "Large change set; split into smaller patches"})
    if not selected_files:
        findings.append({"severity": "medium", "path": "", "message": "No relevant files selected"})

    severity = _max_severity(findings)
    recommendation = "block" if severity == "high" else "review" if severity == "medium" else "proceed_with_review"

    return {
        "severity": severity,
        "findings": findings,
        "recommendation": recommendation,
    }
