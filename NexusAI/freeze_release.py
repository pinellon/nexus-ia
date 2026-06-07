"""Freeze a NexusAI checkpoint and its evaluation artifacts as a release candidate."""

from __future__ import annotations

import argparse
import json
import shutil
from datetime import datetime
from pathlib import Path


BASE_DIR = Path(__file__).parent


def latest_file(folder: Path, pattern: str) -> Path | None:
    files = sorted(folder.glob(pattern), key=lambda path: path.stat().st_mtime, reverse=True)
    return files[0] if files else None


def copy_file(src: Path, dest: Path) -> str | None:
    if not src.is_file():
        return None
    dest.parent.mkdir(parents=True, exist_ok=True)
    shutil.copy2(src, dest)
    return str(dest)


def dataset_stats() -> dict:
    manifest = BASE_DIR / "data" / "instruction_manifest.jsonl"
    behavior_manifest = BASE_DIR / "data" / "instruction_behavior_manifest.jsonl"
    stats = {}
    for name, path in (("balanced", manifest), ("behavior", behavior_manifest)):
        if not path.is_file():
            continue
        quality: dict[str, int] = {}
        weighted: dict[str, int] = {}
        languages: dict[str, int] = {}
        rows = 0
        for line in path.read_text(encoding="utf-8").splitlines():
            row = json.loads(line)
            rows += 1
            q = row.get("quality", "unknown")
            lang = row.get("language", "unknown")
            quality[q] = quality.get(q, 0) + 1
            weighted[q] = weighted.get(q, 0) + int(row.get("weight", 1))
            languages[lang] = languages.get(lang, 0) + 1
        corpus = path.with_name("tagged_corpus.txt")
        stats[name] = {
            "manifest": str(path),
            "files": rows,
            "corpus_chars": corpus.stat().st_size if corpus.is_file() else 0,
            "estimated_tokens": (corpus.stat().st_size // 4) if corpus.is_file() else 0,
            "quality_counts": quality,
            "weighted_records": weighted,
            "languages": languages,
        }
    return stats


def main() -> None:
    parser = argparse.ArgumentParser(description="Freeze NexusAI release candidate.")
    parser.add_argument("--name", default="v0.1_candidate")
    parser.add_argument("--config", default="config.micro-instruct-fullstack.behavior.json")
    args = parser.parse_args()

    release_dir = BASE_DIR / "releases" / args.name
    release_dir.mkdir(parents=True, exist_ok=True)
    copied: dict[str, str | None] = {}

    copied["checkpoint"] = copy_file(
        BASE_DIR / "model_instruct_fullstack" / "nexus_model_best.pt",
        release_dir / "nexus_model_best.pt",
    )
    copied["config"] = copy_file(BASE_DIR / args.config, release_dir / "config.json")
    copied["tokenizer"] = copy_file(
        BASE_DIR / "data" / "tokens_instruct_fullstack" / "tokenizer.json",
        release_dir / "tokenizer.json",
    )
    copied["generation_eval"] = copy_file(
        latest_file(BASE_DIR / "logs", "generation_eval_*.json") or Path("__missing__"),
        release_dir / "generation_eval.json",
    )
    copied["post_train_report"] = copy_file(
        latest_file(BASE_DIR / "logs", "post_train_report_*.md") or Path("__missing__"),
        release_dir / "post_train_report.md",
    )
    copied["project_report"] = copy_file(
        latest_file(BASE_DIR / "logs", "project_report_*.md") or Path("__missing__"),
        release_dir / "project_report.md",
    )

    stats_path = release_dir / "dataset_stats.json"
    stats_path.write_text(json.dumps(dataset_stats(), indent=2, ensure_ascii=False), encoding="utf-8")
    copied["dataset_stats"] = str(stats_path)

    manifest = {
        "name": args.name,
        "created_at": datetime.now().isoformat(timespec="seconds"),
        "base_dir": str(BASE_DIR),
        "copied": copied,
    }
    (release_dir / "release_manifest.json").write_text(
        json.dumps(manifest, indent=2, ensure_ascii=False),
        encoding="utf-8",
    )
    print(f"Release frozen at {release_dir}")


if __name__ == "__main__":
    main()
