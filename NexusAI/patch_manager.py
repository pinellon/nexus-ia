"""Safe patch application and rollback for NexusAI repo mode."""

from __future__ import annotations

import argparse
import difflib
import json
import shutil
import time
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from dependency_guard import added_dependencies
from repo_indexer import IGNORED_DIRS, resolve_project_dir

SENSITIVE_FILENAMES = {
    ".env",
    ".env.local",
    ".env.development",
    ".env.production",
    "credentials.json",
    "secrets.json",
    "id_rsa",
    "id_dsa",
    "id_ecdsa",
    "id_ed25519",
}

SENSITIVE_PATH_PREFIXES = {
    "nexusai/memory",
}


def safe_project_path(root: Path, relative_path: str) -> Path:
    if "\0" in relative_path:
        raise ValueError(f"Path contains invalid null byte: {relative_path}")
    normalised = relative_path.replace("\\", "/").strip("/")
    candidate = (root / normalised).resolve()
    if root not in candidate.parents and candidate != root:
        raise ValueError(f"Path escapes project: {relative_path}")
    rel_parts = candidate.relative_to(root).parts
    if any(part in IGNORED_DIRS for part in rel_parts):
        raise ValueError(f"Path targets ignored directory: {relative_path}")
    rel_posix = candidate.relative_to(root).as_posix().lower()
    name = candidate.name.lower()
    if name in SENSITIVE_FILENAMES or name.startswith(".env."):
        raise ValueError(f"Path targets sensitive file: {relative_path}")
    if any(rel_posix == prefix or rel_posix.startswith(prefix + "/") for prefix in SENSITIVE_PATH_PREFIXES):
        raise ValueError(f"Path targets sensitive directory: {relative_path}")
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


def _now_iso() -> str:
    return datetime.now(tz=timezone.utc).isoformat()


def _patch_id() -> str:
    return f"{time.strftime('%Y%m%d_%H%M%S')}_{uuid.uuid4().hex[:8]}"


def _normalise_changes(root: Path, changes: list[dict]) -> list[dict[str, Any]]:
    if not changes:
        raise ValueError("changes must be a non-empty list")
    prepared: list[dict[str, Any]] = []
    seen: set[str] = set()
    for change in changes:
        if not isinstance(change, dict) or not isinstance(change.get("path"), str) or "content" not in change:
            raise ValueError("each change needs path and content")
        rel = str(change["path"]).replace("\\", "/").strip("/")
        if not rel:
            raise ValueError("change path cannot be empty")
        if rel in seen:
            raise ValueError(f"duplicate change path: {rel}")
        seen.add(rel)
        after = str(change.get("content", ""))
        target = safe_project_path(root, rel)
        if target.exists() and target.is_dir():
            raise ValueError(f"Path targets a directory: {rel}")
        existed = target.exists()
        before = read_text_if_exists(target)
        new_deps = added_dependencies(rel, before, after)
        prepared.append(
            {
                "path": rel,
                "target": target,
                "existed": existed,
                "before": before,
                "after": after,
                "new_dependencies": new_deps,
            }
        )
    return prepared


def apply_file_changes(
    project_dir: str | Path,
    changes: list[dict],
    *,
    reason: str = "",
    allow_dependencies: bool = False,
    task_id: str | None = None,
    step_id: str | None = None,
) -> dict:
    root = resolve_project_dir(project_dir)
    nexus_dir = root / ".nexus"
    backup_root = nexus_dir / "backups"
    patches_root = nexus_dir / "patches"
    stamp = _patch_id()
    backup_dir = backup_root / stamp
    patch_path = patches_root / f"{stamp}.diff"

    prepared = _normalise_changes(root, changes)
    blocked_deps = [dep for item in prepared for dep in item["new_dependencies"]]
    if blocked_deps and not allow_dependencies:
        raise ValueError(
            "New dependencies require approval before applying patch: "
            + ", ".join(blocked_deps)
        )

    backup_dir.mkdir(parents=True, exist_ok=True)
    patches_root.mkdir(parents=True, exist_ok=True)

    touched: list[dict] = []
    diffs: list[str] = []

    for item in prepared:
        rel = item["path"]
        target = item["target"]
        if item["existed"]:
            backup_target = backup_dir / rel
            backup_target.parent.mkdir(parents=True, exist_ok=True)
            shutil.copy2(target, backup_target)
        else:
            placeholder = backup_dir / rel
            placeholder.parent.mkdir(parents=True, exist_ok=True)

        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_text(item["after"], encoding="utf-8")
        diffs.append(unified_diff(rel, item["before"], item["after"]))
        touched.append({"path": rel, "existed": item["existed"]})

    patch_path.write_text("\n".join(diffs), encoding="utf-8")
    history = load_history(root)
    record = {
        "id": stamp,
        "created_at": _now_iso(),
        "reason": reason,
        "task_id": task_id,
        "step_id": step_id,
        "backup_dir": str(backup_dir),
        "patch": str(patch_path),
        "changes": touched,
        "rolled_back": False,
    }
    history.append(record)
    save_history(root, history)
    return record


def _restore_record(root: Path, record: dict) -> dict:
    if record.get("rolled_back"):
        return {
            "rolled_back": False,
            "already_rolled_back": True,
            "patch_id": record.get("id"),
            "reason": "patch already rolled back",
        }

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

    record["rolled_back"] = True
    record["rolled_back_at"] = _now_iso()
    record["rollback"] = {"restored": restored, "removed": removed}
    return {"rolled_back": True, "patch_id": record["id"], "restored": restored, "removed": removed}


def rollback_patch(project_dir: str | Path, patch_id: str) -> dict:
    root = resolve_project_dir(project_dir)
    history = load_history(root)
    for record in history:
        if record.get("id") == patch_id:
            result = _restore_record(root, record)
            save_history(root, history)
            return result
    return {"rolled_back": False, "patch_id": patch_id, "reason": "patch not found"}


def rollback_last(project_dir: str | Path) -> dict:
    root = resolve_project_dir(project_dir)
    history = load_history(root)
    if not history:
        return {"rolled_back": False, "reason": "no patch history"}

    record = next((item for item in reversed(history) if not item.get("rolled_back")), None)
    if record is None:
        return {"rolled_back": False, "already_rolled_back": True, "reason": "no active patch history"}

    result = _restore_record(root, record)
    save_history(root, history)
    return result


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
