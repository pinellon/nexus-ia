"""Generate .nexus project documentation from an indexed repo."""

from __future__ import annotations

import argparse
import json
import re
import time
from pathlib import Path

from repo_indexer import build_project_index, read_small_text, resolve_project_dir


ROUTE_RE = re.compile(r"@app\.route\(['\"]([^'\"]+)['\"]")


def detect_routes(root: Path, index: dict) -> list[dict]:
    routes = []
    for rel in index.get("important_files", []):
        if not rel.endswith(".py"):
            continue
        text = read_small_text(root / rel, limit=80_000)
        for match in ROUTE_RE.finditer(text):
            routes.append({"file": rel, "route": match.group(1)})
    return routes


def detect_database(index: dict) -> dict:
    files = [item["path"].lower() for item in index.get("files", [])]
    hints = []
    for rel in files:
        if "sqlite" in rel or rel.endswith(".db"):
            hints.append(rel)
        if "models.py" in rel or "schema" in rel:
            hints.append(rel)
    return {"hints": sorted(set(hints)), "detected": bool(hints)}


def generate_project_docs(project_dir: str | Path) -> dict:
    root = resolve_project_dir(project_dir)
    index = build_project_index(root)
    nexus_dir = root / ".nexus"
    nexus_dir.mkdir(exist_ok=True)
    routes = detect_routes(root, index)
    database = detect_database(index)

    summary = [
        "# Project Summary",
        "",
        f"Generated at: {time.strftime('%Y-%m-%d %H:%M:%S')}",
        f"Project: `{index['project_name']}`",
        f"Stack: {', '.join(index.get('stack', [])) or 'unknown'}",
        f"Entrypoints: `{json.dumps(index.get('entrypoints', {}), ensure_ascii=False)}`",
        f"Important files: `{json.dumps(index.get('important_files', [])[:30], ensure_ascii=False)}`",
        "",
    ]
    architecture = [
        "# Architecture",
        "",
        "## Detected Stack",
        "",
        *(f"- {item}" for item in index.get("stack", [])),
        "",
        "## Entrypoints",
        "",
        *(f"- {key}: `{value}`" for key, value in index.get("entrypoints", {}).items()),
        "",
    ]
    routes_md = ["# Routes", ""]
    if routes:
        routes_md.extend(f"- `{route['route']}` in `{route['file']}`" for route in routes)
    else:
        routes_md.append("- No Flask-style routes detected.")
    database_md = ["# Database", "", f"Detected: `{database['detected']}`", ""]
    database_md.extend(f"- `{hint}`" for hint in database["hints"])
    tasks_log = ["# NexusAI Tasks Log", "", "No user tasks recorded in this file yet.", ""]

    files = {
        "project_summary.md": "\n".join(summary),
        "architecture.md": "\n".join(architecture),
        "routes.md": "\n".join(routes_md),
        "database.md": "\n".join(database_md),
        "tasks_log.md": "\n".join(tasks_log),
    }
    written = []
    for name, content in files.items():
        path = nexus_dir / name
        path.write_text(content + "\n", encoding="utf-8")
        written.append(str(path))
    return {"project_dir": str(root), "written": written, "routes": routes, "database": database}


def main() -> None:
    parser = argparse.ArgumentParser(description="Generate .nexus project documentation.")
    parser.add_argument("project_dir", nargs="?", default=".")
    args = parser.parse_args()
    print(json.dumps(generate_project_docs(args.project_dir), ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
