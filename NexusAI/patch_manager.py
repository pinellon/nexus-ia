"""Safe patch application and rollback for NexusAI repo mode."""

from __future__ import annotations

import argparse
import difflib
import json
import shutil
import time
from pathlib import Path

from dependency_guard import added_dependencies
from repo_indexer import IGNORED_DIRS, resolve_project_dir


def safe_project_path(root: Path, relative_path: str) -> Path:
    candidate = (root / relative_path).resolve()
    if root not in candidate.parents and candidate != root:
        raise ValueError(f"Path escapes project: {relative_path}")
    rel_parts = candidate.relative_to(root).parts
    if any(part in IGNORED_DIRS for part in rel_parts):
        raise ValueError(f"Path targets ignored directory: {relative_path}")
    return candidate


def read_text_if_exists(path: Path) -> str:
    if not path.exists():
        return ""
    return path.read_text(encoding="utf-8", errors="ignore")


def unified_diff(rel: str, before: str, after: str) -> str:
    return "".join(
        difflib.unified_diff(
            before.splitlines(keepends=True),
            after.splitlines(keepends=True),
            fromfile=f"a/{rel}",
            tofile=f"b/{rel}",
        )
    )


def load_history(root: Path) -> list[dict]:
    path = root / ".nexus" / "patch_history.json"
    if not path.is_file():
        return []
    return json.loads(path.read_text(encoding="utf-8"))


def save_history(root: Path, history: list[dict]) -> None:
    path = root / ".nexus" / "patch_history.json"
    path.parent.mkdir(exist_ok=True)
    path.write_text(json.dumps(history, ensure_ascii=False, indent=2), encoding="utf-8")


def apply_file_changes(
    project_dir: str | Path,
    changes: list[dict],
    *,
    reason: str = "",
    allow_dependencies: bool = False,
) -> dict:
    root = resolve_project_dir(project_dir)
    nexus_dir = root / ".nexus"
    backup_root = nexus_dir / "backups"
    patches_root = nexus_dir / "patches"
    stamp = time.strftime("%Y%m%d_%H%M%S")
    backup_dir = backup_root / stamp
    patch_path = patches_root / f"{stamp}.diff"
    backup_dir.mkdir(parents=True, exist_ok=True)
    patches_root.mkdir(parents=True, exist_ok=True)

    touched: list[dict] = []
    diffs: list[str] = []

    for change in changes:
        rel = str(change["path"]).replace("\\", "/")
        after = str(change.get("content", ""))
        target = safe_project_path(root, rel)
        existed = target.exists()
        before = read_text_if_exists(target)
        new_deps = added_dependencies(rel, before, after)
        if new_deps and not allow_dependencies:
            raise ValueError(
                "New dependencies require approval before applying patch: "
                + ", ".join(new_deps)
            )

        if existed:
            backup_target = backup_dir / rel
            backup_target.parent.mkdir(parents=True, exist_ok=True)
            shutil.copy2(target, backup_target)

        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_text(after, encoding="utf-8")
        diffs.append(unified_diff(rel, before, after))
        touched.append({"path": rel, "existed": existed})

    patch_path.write_text("\n".join(diffs), encoding="utf-8")
    history = load_history(root)
    record = {
        "id": stamp,
        "created_at": time.strftime("%Y-%m-%d %H:%M:%S"),
        "reason": reason,
        "backup_dir": str(backup_dir),
        "patch": str(patch_path),
        "changes": touched,
    }
    history.append(record)
    save_history(root, history)
    return record


def rollback_last(project_dir: str | Path) -> dict:
    root = resolve_project_dir(project_dir)
    history = load_history(root)
    if not history:
        return {"rolled_back": False, "reason": "no patch history"}

    record = history.pop()
    backup_dir = Path(record["backup_dir"])
    restored: list[str] = []
    removed: list[str] = []

    for change in record.get("changes", []):
        rel = change["path"]
        target = safe_project_path(root, rel)
        backup_file = backup_dir / rel
        if change.get("existed") and backup_file.is_file():
            target.parent.mkdir(parents=True, exist_ok=True)
            shutil.copy2(backup_file, target)
            restored.append(rel)
        elif not change.get("existed") and target.exists():
            target.unlink()
            removed.append(rel)

    save_history(root, history)
    return {"rolled_back": True, "patch_id": record["id"], "restored": restored, "removed": removed}


def main() -> None:
    parser = argparse.ArgumentParser(description="Apply or rollback NexusAI file changes.")
    sub = parser.add_subparsers(dest="cmd", required=True)
    apply_cmd = sub.add_parser("apply")
    apply_cmd.add_argument("project_dir")
    apply_cmd.add_argument("changes_json", help="JSON file with [{'path': 'file', 'content': '...'}]")
    apply_cmd.add_argument("--reason", default="")
    apply_cmd.add_argument("--allow_dependencies", action="store_true")
    rollback_cmd = sub.add_parser("rollback")
    rollback_cmd.add_argument("project_dir")
    args = parser.parse_args()

    if args.cmd == "apply":
        changes = json.loads(Path(args.changes_json).read_text(encoding="utf-8"))
        print(
            json.dumps(
                apply_file_changes(
                    args.project_dir,
                    changes,
                    reason=args.reason,
                    allow_dependencies=args.allow_dependencies,
                ),
                ensure_ascii=False,
                indent=2,
            )
        )
    else:
        print(json.dumps(rollback_last(args.project_dir), ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
