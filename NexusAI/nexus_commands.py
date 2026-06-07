"""Internal slash commands for NexusAI."""

from __future__ import annotations

import argparse
import json
from pathlib import Path

from command_sandbox import run_sandboxed_command
from failure_ranking import top_failures
from git_tools import git_diff, git_status, git_summary
from patch_manager import rollback_last
from project_docs import generate_project_docs
from repo_indexer import build_project_index
from repo_mode import build_repo_context, run_repo_task
from task_metrics import task_success_summary
from test_runner import run_project_tests


def split_command(text: str) -> tuple[str, str]:
    stripped = text.strip()
    if not stripped.startswith("/"):
        return "", stripped
    parts = stripped.split(maxsplit=1)
    return parts[0].lower(), parts[1] if len(parts) > 1 else ""


def run_internal_command(
    command_text: str,
    *,
    project_dir: str | Path = ".",
    config: str | Path = Path(__file__).parent / "config.micro-instruct-fullstack.behavior.json",
) -> dict:
    command, arg = split_command(command_text)
    if command == "/analyze-project":
        return {"command": command, "result": build_project_index(project_dir)}
    if command == "/run-tests":
        return {"command": command, "result": run_project_tests(project_dir)}
    if command == "/rollback":
        return {"command": command, "result": rollback_last(project_dir)}
    if command == "/generate-docs":
        return {"command": command, "result": generate_project_docs(project_dir)}
    if command == "/diff":
        return {"command": command, "result": git_diff(project_dir)}
    if command == "/git-status":
        return {"command": command, "result": git_status(project_dir)}
    if command == "/git-summary":
        return {"command": command, "result": git_summary(project_dir)}
    if command == "/context":
        return {"command": command, "result": build_repo_context(project_dir, arg or "analyze project")}
    if command == "/review-patch":
        return {"command": command, "result": run_repo_task(project_dir, arg or "review current patch", config=config)}
    if command == "/create-feature":
        return {"command": command, "result": run_repo_task(project_dir, arg or "create feature", config=config)}
    if command == "/fix-bug":
        return {"command": command, "result": run_repo_task(project_dir, arg or "fix bug", config=config)}
    if command == "/explain-error":
        return {"command": command, "result": run_repo_task(project_dir, "explique este erro: " + arg, config=config)}
    if command == "/failures":
        return {"command": command, "result": top_failures()}
    if command == "/metrics":
        return {"command": command, "result": task_success_summary()}
    if command == "/run-command":
        return {"command": command, "result": run_sandboxed_command(arg, project_dir)}
    return {
        "command": command or "unknown",
        "error": "unknown command",
        "available": [
            "/analyze-project",
            "/create-feature",
            "/fix-bug",
            "/review-patch",
            "/run-tests",
            "/explain-error",
            "/rollback",
            "/generate-docs",
            "/diff",
            "/git-status",
            "/git-summary",
            "/context",
            "/failures",
            "/metrics",
            "/run-command",
        ],
    }


def main() -> None:
    parser = argparse.ArgumentParser(description="Run a NexusAI slash command.")
    parser.add_argument("project_dir")
    parser.add_argument("command")
    args = parser.parse_args()
    print(json.dumps(run_internal_command(args.command, project_dir=args.project_dir), ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
