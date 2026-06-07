"""Stack-aware test runner for NexusAI repo mode."""

from __future__ import annotations

import argparse
import json
import shutil
import subprocess
import sys
import time
from pathlib import Path

from repo_indexer import build_project_index, resolve_project_dir


def run_command(command: list[str], cwd: Path, timeout: int = 40) -> dict:
    start = time.time()
    try:
        proc = subprocess.run(
            command,
            cwd=str(cwd),
            text=True,
            capture_output=True,
            timeout=timeout,
        )
        return {
            "command": command,
            "ok": proc.returncode == 0,
            "returncode": proc.returncode,
            "duration_s": round(time.time() - start, 2),
            "stdout": proc.stdout[-4000:],
            "stderr": proc.stderr[-4000:],
        }
    except subprocess.TimeoutExpired as exc:
        return {
            "command": command,
            "ok": False,
            "returncode": None,
            "duration_s": round(time.time() - start, 2),
            "stdout": (exc.stdout or "")[-4000:] if isinstance(exc.stdout, str) else "",
            "stderr": "command timed out",
        }


def package_scripts(root: Path) -> dict:
    package_path = root / "package.json"
    if not package_path.is_file():
        return {}
    try:
        package = json.loads(package_path.read_text(encoding="utf-8"))
    except json.JSONDecodeError:
        return {}
    return package.get("scripts", {}) if isinstance(package.get("scripts"), dict) else {}


def choose_test_commands(root: Path, index: dict) -> list[list[str]]:
    commands: list[list[str]] = []
    stack = set(index.get("stack", []))
    entrypoints = index.get("entrypoints", {})

    if "python" in stack:
        backend = entrypoints.get("backend")
        if backend:
            commands.append([sys.executable, "-m", "py_compile", backend])
        elif (root / "app.py").is_file():
            commands.append([sys.executable, "-m", "py_compile", "app.py"])
        if (root / "tests").is_dir():
            commands.append([sys.executable, "-m", "pytest"])

    scripts = package_scripts(root)
    npm = shutil.which("npm")
    if npm and scripts:
        if "lint" in scripts:
            commands.append([npm, "run", "lint"])
        if "build" in scripts:
            commands.append([npm, "run", "build"])
        elif "test" in scripts:
            commands.append([npm, "test"])

    return commands


def run_project_tests(project_dir: str | Path, *, timeout: int = 40) -> dict:
    root = resolve_project_dir(project_dir)
    index = build_project_index(root)
    commands = choose_test_commands(root, index)
    results = [run_command(command, root, timeout=timeout) for command in commands]
    return {
        "project_dir": str(root),
        "stack": index.get("stack", []),
        "commands": commands,
        "results": results,
        "ok": all(item["ok"] for item in results) if results else True,
        "no_tests_found": not commands,
    }


def main() -> None:
    parser = argparse.ArgumentParser(description="Run stack-aware tests for a project.")
    parser.add_argument("project_dir", nargs="?", default=".")
    parser.add_argument("--timeout", type=int, default=40)
    args = parser.parse_args()
    print(json.dumps(run_project_tests(args.project_dir, timeout=args.timeout), ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
