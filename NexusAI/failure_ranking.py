"""Rank repeated NexusAI failure types."""

from __future__ import annotations

import argparse
import json
import sqlite3
from collections import Counter
from pathlib import Path

from failure_store import DB_PATH, ensure_failures_table


def normalize_failure_type(value: str) -> list[str]:
    parts = []
    for chunk in value.replace(";", "\n").splitlines():
        label = chunk.strip().lower()
        if label:
            parts.append(label[:140])
    return parts or ["unknown"]


def top_failures(limit: int = 5) -> list[dict]:
    ensure_failures_table()
    if not Path(DB_PATH).is_file():
        return []
    with sqlite3.connect(DB_PATH) as conn:
        rows = conn.execute("SELECT failure_type, task_type, created_at FROM failures").fetchall()
    counter: Counter[str] = Counter()
    task_counter: Counter[str] = Counter()
    for failure_type, task_type, _created_at in rows:
        for label in normalize_failure_type(failure_type or ""):
            counter[label] += 1
            task_counter[f"{label}::{task_type or 'unknown'}"] += 1
    ranked = []
    for label, count in counter.most_common(limit):
        task_breakdown = {
            key.split("::", 1)[1]: value
            for key, value in task_counter.items()
            if key.startswith(label + "::")
        }
        ranked.append({"failure_type": label, "count": count, "task_breakdown": task_breakdown})
    return ranked


def main() -> None:
    parser = argparse.ArgumentParser(description="Show ranked NexusAI failures.")
    parser.add_argument("--limit", type=int, default=5)
    args = parser.parse_args()
    print(json.dumps(top_failures(args.limit), ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
