"""Safe diff utilities for NexusAI coder tools."""

from __future__ import annotations

import difflib
import re
from pathlib import Path

from repo_indexer import resolve_project_dir


BLOCKED_PATH_PARTS = {
    ".git",
    "node_modules",
    "dist",
    "build",
    "coverage",
    "__pycache__",
    ".pytest_cache",
}

SENSITIVE_PATTERNS = (
    ".env",
    "secret",
    "secrets",
    "credential",
    "credentials",
    "private_key",
    "id_rsa",
    "id_dsa",
    ".pem",
    ".key",
)

DANGEROUS_CONTENT_PATTERNS = [
    re.compile(r"rm\s+-rf", re.IGNORECASE),
    re.compile(r"Remove-Item\s+.*-Recurse", re.IGNORECASE),
    re.compile(r"curl\s+.*\|\s*(sh|bash)", re.IGNORECASE),
    re.compile(r"Invoke-Expression|iex\s", re.IGNORECASE),
    re.compile(r"api[_-]?key\s*=\s*['\"][^'\"]+", re.IGNORECASE),
    re.compile(r"password\s*=\s*['\"][^'\"]+", re.IGNORECASE),
]


def normalize_rel_path(path: str) -> str:
    return str(path).replace("\\", "/").strip().lstrip("/")


def is_sensitive_path(path: str) -> bool:
    normalized = normalize_rel_path(path).lower()
    parts = set(normalized.split("/"))
    if parts & BLOCKED_PATH_PARTS:
        return True
    return any(pattern in normalized for pattern in SENSITIVE_PATTERNS)


def validate_patch_paths(project_dir: str | Path, changes: list[dict]) -> dict:
    root = resolve_project_dir(project_dir)
    findings = []
    ok = True
    for change in changes:
        rel = normalize_rel_path(str(change.get("path", "")))
        target = (root / rel).resolve()
        if root not in target.parents and target != root:
            ok = False
            findings.append({"path": rel, "severity": "high", "message": "Path escapes project root"})
        if is_sensitive_path(rel):
            ok = False
            findings.append({"path": rel, "severity": "high", "message": "Sensitive or generated path is blocked"})
    return {"ok": ok, "findings": findings}


def detect_dangerous_content(content: str) -> list[str]:
    findings = []
    for pattern in DANGEROUS_CONTENT_PATTERNS:
        if pattern.search(content):
            findings.append(pattern.pattern)
    return findings


def make_unified_diff(path: str, before: str, after: str) -> str:
    rel = normalize_rel_path(path)
    return "".join(
        difflib.unified_diff(
            before.splitlines(keepends=True),
            after.splitlines(keepends=True),
            fromfile=f"a/{rel}",
            tofile=f"b/{rel}",
        )
    )


def represent_patch(project_dir: str | Path, changes: list[dict]) -> dict:
    path_validation = validate_patch_paths(project_dir, changes)
    diffs = []
    findings = list(path_validation["findings"])

    for change in changes:
        path = normalize_rel_path(str(change.get("path", "")))
        before = str(change.get("before", ""))
        after = str(change.get("after", change.get("content", "")))
        diffs.append({"path": path, "diff": make_unified_diff(path, before, after)})
        for pattern in detect_dangerous_content(after):
            findings.append({"path": path, "severity": "high", "message": f"Dangerous content matched: {pattern}"})

    return {
        "ok": path_validation["ok"] and not any(item["severity"] == "high" for item in findings),
        "auto_applied": False,
        "diffs": diffs,
        "findings": findings,
    }
