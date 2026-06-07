"""Small safe Git helpers for NexusAI repo mode."""

from __future__ import annotations

import argparse
import json
import subprocess
from pathlib import Path

from repo_indexer import resolve_project_dir


def run_git(project_dir: str | Path, args: list[str], *, timeout: int = 30) -> dict:
    root = resolve_project_dir(project_dir)
    proc = subprocess.run(["git", *args], cwd=str(root), text=True, capture_output=True, timeout=timeout)
    return {
        "ok": proc.returncode == 0,
        "command": ["git", *args],
        "returncode": proc.returncode,
        "stdout": proc.stdout[-8000:],
        "stderr": proc.stderr[-4000:],
    }


def git_status(project_dir: str | Path) -> dict:
    return run_git(project_dir, ["status", "--short"])


def git_diff(project_dir: str | Path, *, staged: bool = False) -> dict:
    return run_git(project_dir, ["diff", "--staged"] if staged else ["diff"])


def git_recent_log(project_dir: str | Path, limit: int = 5) -> dict:
    return run_git(project_dir, ["log", f"-{limit}", "--oneline"])


def commit_message_from_diff(diff: str) -> str:
    lowered = diff.lower()
    if "test" in lowered:
        prefix = "test"
    elif "fix" in lowered or "error" in lowered or "bug" in lowered:
        prefix = "fix"
    elif "docs" in lowered or ".md" in lowered:
        prefix = "docs"
    else:
        prefix = "chore"
    changed_files = []
    for line in diff.splitlines():
        if line.startswith("diff --git "):
            parts = line.split()
            if len(parts) >= 4:
                changed_files.append(parts[3].removeprefix("b/"))
    target = changed_files[0] if changed_files else "project"
    return f"{prefix}: update {target}"


def git_summary(project_dir: str | Path) -> dict:
    diff = git_diff(project_dir)
    return {
        "status": git_status(project_dir),
        "diff": diff,
        "recent_log": git_recent_log(project_dir),
        "suggested_commit_message": commit_message_from_diff(diff.get("stdout", "")),
    }


def main() -> None:
    parser = argparse.ArgumentParser(description="Safe Git helpers for NexusAI.")
    parser.add_argument("project_dir", nargs="?", default=".")
    parser.add_argument("cmd", choices=["status", "diff", "summary", "commit-message"])
    args = parser.parse_args()
    if args.cmd == "status":
        result = git_status(args.project_dir)
    elif args.cmd == "diff":
        result = git_diff(args.project_dir)
    elif args.cmd == "summary":
        result = git_summary(args.project_dir)
    else:
        result = {"message": commit_message_from_diff(git_diff(args.project_dir).get("stdout", ""))}
    print(json.dumps(result, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
