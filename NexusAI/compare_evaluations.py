"""Compare two NexusAI generation evaluation JSON files."""

from __future__ import annotations

import argparse
import json
from pathlib import Path


def load(path: Path) -> dict:
    data = json.loads(path.read_text(encoding="utf-8"))
    if isinstance(data, list):
        return {
            "aggregate": {"total_score": sum(item["score"]["score"] for item in data)},
            "by_category": {},
            "results": data,
        }
    return data


def case_scores(payload: dict) -> dict[str, int]:
    return {item["name"]: int(item["score"]["score"]) for item in payload.get("results", [])}


def metric_delta(after: dict, before: dict, key: str) -> float:
    return round(float(after.get(key, 0)) - float(before.get(key, 0)), 3)


def main() -> None:
    parser = argparse.ArgumentParser(description="Compare two evaluation files.")
    parser.add_argument("before")
    parser.add_argument("after")
    parser.add_argument("--output", default="")
    args = parser.parse_args()

    before = load(Path(args.before))
    after = load(Path(args.after))
    before_scores = case_scores(before)
    after_scores = case_scores(after)

    lines = [
        "# NexusAI Evaluation Comparison",
        "",
        f"Before: `{args.before}`",
        f"After: `{args.after}`",
        "",
        "## Aggregate Delta",
    ]

    for key in ("total_score", "avg_score", "avg_instruction_following", "avg_repetition_score", "compile_like_rate"):
        lines.append(
            f"- {key}: {before.get('aggregate', {}).get(key, 0)} -> "
            f"{after.get('aggregate', {}).get(key, 0)} "
            f"(delta {metric_delta(after.get('aggregate', {}), before.get('aggregate', {}), key)})"
        )

    lines.extend(["", "## Category Delta"])
    categories = sorted(set(before.get("by_category", {})) | set(after.get("by_category", {})))
    for category in categories:
        before_cat = before.get("by_category", {}).get(category, {})
        after_cat = after.get("by_category", {}).get(category, {})
        lines.append(
            f"- {category}: score {before_cat.get('total_score', 0)} -> {after_cat.get('total_score', 0)}, "
            f"follow {before_cat.get('avg_instruction_following', 0)} -> {after_cat.get('avg_instruction_following', 0)}, "
            f"compile {before_cat.get('compile_like_rate', 0)} -> {after_cat.get('compile_like_rate', 0)}"
        )

    deltas = []
    for name in sorted(set(before_scores) | set(after_scores)):
        deltas.append((after_scores.get(name, 0) - before_scores.get(name, 0), name, before_scores.get(name, 0), after_scores.get(name, 0)))
    improved = sorted([item for item in deltas if item[0] > 0], reverse=True)[:8]
    regressed = sorted([item for item in deltas if item[0] < 0])[:8]

    lines.extend(["", "## Biggest Improvements"])
    for delta, name, old, new in improved:
        lines.append(f"- {name}: {old} -> {new} (delta +{delta})")
    if not improved:
        lines.append("- none")

    lines.extend(["", "## Biggest Regressions"])
    for delta, name, old, new in regressed:
        lines.append(f"- {name}: {old} -> {new} (delta {delta})")
    if not regressed:
        lines.append("- none")

    text = "\n".join(lines) + "\n"
    if args.output:
        Path(args.output).write_text(text, encoding="utf-8")
    print(text)


if __name__ == "__main__":
    main()
