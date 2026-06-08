"""Deterministic test command suggestion for NexusAI coder tools."""

from __future__ import annotations

from pathlib import Path

from repo_indexer import resolve_project_dir


def suggest_tests(project_dir: str | Path, task: str, affected_files: list[str]) -> list[str]:
    root = resolve_project_dir(project_dir)
    lowered = " ".join([task, *affected_files]).lower()
    commands: list[str] = []

    has_python = any(path.endswith(".py") for path in affected_files) or "python" in lowered or (root / "NexusAI").is_dir()
    has_node = (root / "package.json").is_file() or any(path.endswith((".ts", ".tsx", ".js", ".jsx")) for path in affected_files)

    if has_python:
        commands.append("python -m py_compile NexusAI/*.py")
        if any("test_controlled_components.py" in path for path in affected_files) or (root / "NexusAI" / "test_controlled_components.py").is_file():
            commands.append("cd NexusAI && python -m unittest test_controlled_components.py")
        if any("test_coder_components.py" in path for path in affected_files) or (root / "tests" / "test_coder_components.py").is_file():
            commands.append("python -m unittest tests/test_coder_components.py")

    if has_node:
        commands.extend(["npm run typecheck", "npm run build", "npm test"])

    if not commands:
        commands.append("Run the smallest existing test command for the affected stack.")

    return list(dict.fromkeys(commands))
