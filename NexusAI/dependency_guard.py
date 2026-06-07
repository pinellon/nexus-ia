"""Detect new dependencies before NexusAI applies patches."""

from __future__ import annotations

import json
import re


def normalize_requirement(line: str) -> str:
    line = line.strip()
    if not line or line.startswith("#"):
        return ""
    return re.split(r"[<>=!~\[]", line, maxsplit=1)[0].strip().lower()


def requirements_deps(text: str) -> set[str]:
    return {dep for dep in (normalize_requirement(line) for line in text.splitlines()) if dep}


def package_json_deps(text: str) -> set[str]:
    try:
        payload = json.loads(text or "{}")
    except json.JSONDecodeError:
        return set()
    deps: set[str] = set()
    for section in ("dependencies", "devDependencies", "optionalDependencies"):
        values = payload.get(section, {})
        if isinstance(values, dict):
            deps.update(str(name).lower() for name in values)
    return deps


def added_dependencies(path: str, before: str, after: str) -> list[str]:
    normalized = path.replace("\\", "/").lower()
    if normalized.endswith("requirements.txt"):
        before_deps = requirements_deps(before)
        after_deps = requirements_deps(after)
    elif normalized.endswith("package.json"):
        before_deps = package_json_deps(before)
        after_deps = package_json_deps(after)
    else:
        return []
    return sorted(after_deps - before_deps)
