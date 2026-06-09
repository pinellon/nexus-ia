"""Sandboxed command execution rules for NexusAI."""

from __future__ import annotations

import argparse
import json
import re
import shlex
import subprocess
import time
from pathlib import Path

from repo_indexer import resolve_project_dir


BLOCKED_PATTERNS = [
    r"\brm\s+-rf\b",
    r"\bdel\s+/s\b",
    r"\bformat\b",
    r"\bgit\s+reset\s+--hard\b",
    r"\bcurl\b.*\|\s*(bash|sh|powershell|pwsh)",
    r"\birm\b.*\|\s*iex\b",
    r"\biwr\b.*\|\s*iex\b",
]

INSTALL_PATTERNS = [
    r"\bpip\s+install\b",
    r"\bpython\s+-m\s+pip\s+install\b",
    r"\bnpm\s+install\b",
    r"\bnpm\s+i\b",
    r"\byarn\s+add\b",
    r"\bpnpm\s+add\b",
]

ALLOWED_PREFIXES = (
    ("python", "-m", "py_compile"),
    ("python", "-m", "pytest"),
    ("pytest",),
    ("npm", "run", "build"),
    ("npm", "run", "lint"),
    ("npm", "test"),
    ("git", "status"),
    ("git", "diff"),
    ("git", "branch"),
    ("git", "log"),
)

SHELL_META_TOKENS = {"&&", "||", ";", "|", ">", ">>", "<", "$(", "`"}


def tokenize(command: str) -> list[str]:
    try:
        return shlex.split(command, posix=False)
    except ValueError:
        return command.split()


def _normalise_executable(token: str) -> str:
    lowered = token.lower()
    if lowered.endswith(("python.exe", "python3.exe")):
        return "python"
    if lowered.endswith(("npm.cmd", "npm.exe")):
        return "npm"
    return lowered


def _inside(parent: Path, child: Path) -> bool:
    try:
        child.relative_to(parent)
        return True
    except ValueError:
        return False


def _looks_like_path(token: str) -> bool:
    return "/" in token or "\\" in token or token.startswith(".")


def _paths_stay_in_root(tokens: tuple[str, ...], root: Path) -> tuple[bool, str]:
    for token in tokens:
        stripped = token.strip('"').strip("'")
        if not stripped or stripped.startswith("-"):
            continue
        if "\0" in stripped:
            return False, "command argument contains invalid null byte"
        if _looks_like_path(stripped):
            candidate = Path(stripped)
            resolved = candidate.resolve() if candidate.is_absolute() else (root / candidate).resolve()
            if not _inside(root, resolved):
                return False, f"command path escapes project: {stripped}"
    return True, "allowed"


def is_command_allowed(command: str, *, allow_install: bool = False, project_dir: str | Path | None = None) -> tuple[bool, str]:
    lowered = command.lower()
    if any(meta in command for meta in SHELL_META_TOKENS):
        return False, "shell metacharacters are not allowed"
    for pattern in BLOCKED_PATTERNS:
        if re.search(pattern, lowered):
            return False, f"blocked dangerous command pattern: {pattern}"
    for pattern in INSTALL_PATTERNS:
        if re.search(pattern, lowered) and not allow_install:
            return False, "install commands require explicit approval"
    tokens = tuple(token.strip('"').strip("'") for token in tokenize(command))
    if not tokens:
        return False, "empty command"
    normalized = tuple(_normalise_executable(token) for token in tokens)
    for prefix in ALLOWED_PREFIXES:
        if normalized[: len(prefix)] == prefix:
            if project_dir is not None:
                root = resolve_project_dir(project_dir)
                ok, reason = _paths_stay_in_root(tokens[len(prefix):], root)
                if not ok:
                    return ok, reason
            return True, "allowed"
    return False, "command prefix is not in NexusAI sandbox allowlist"


def run_sandboxed_command(command: str, project_dir: str | Path, *, timeout: int = 40, allow_install: bool = False) -> dict:
    root = resolve_project_dir(project_dir)
    allowed, reason = is_command_allowed(command, allow_install=allow_install, project_dir=root)
    if not allowed:
        return {"ok": False, "blocked": True, "reason": reason, "command": command}
    start = time.time()
    proc = subprocess.run(tokenize(command), cwd=str(root), text=True, capture_output=True, timeout=timeout)
    return {
        "ok": proc.returncode == 0,
        "blocked": False,
        "command": command,
        "returncode": proc.returncode,
        "duration_s": round(time.time() - start, 2),
        "stdout": proc.stdout[-4000:],
        "stderr": proc.stderr[-4000:],
    }


def main() -> None:
    parser = argparse.ArgumentParser(description="Run a command through the NexusAI sandbox.")
    parser.add_argument("project_dir")
    parser.add_argument("command")
    parser.add_argument("--allow_install", action="store_true")
    args = parser.parse_args()
    print(json.dumps(run_sandboxed_command(args.command, args.project_dir, allow_install=args.allow_install), ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
