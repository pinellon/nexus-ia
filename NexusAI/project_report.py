"""Generate a complete NexusAI project progress report."""

from __future__ import annotations

import argparse
import json
import time
from collections import Counter
from datetime import datetime
from pathlib import Path

from nexus_status import active_training_processes, checkpoint_status, latest_train_log, memory_status, parse_log


BASE_DIR = Path(__file__).parent
LOG_DIR = BASE_DIR / "logs"
MANIFEST = BASE_DIR / "data" / "instruction_manifest.jsonl"
ROADMAP = BASE_DIR / "NEXUSAI_PROGRESS_AND_ROADMAP.md"


def latest_file(pattern: str) -> Path | None:
    files = sorted(LOG_DIR.glob(pattern), key=lambda path: path.stat().st_mtime, reverse=True)
    return files[0] if files else None


def load_eval(path: Path | None) -> dict:
    if not path or not path.is_file():
        return {}
    return json.loads(path.read_text(encoding="utf-8"))


def dataset_summary() -> dict:
    if not MANIFEST.is_file():
        return {}

    quality = Counter()
    weighted = Counter()
    language = Counter()
    files = 0
    chars = 0

    for line in MANIFEST.read_text(encoding="utf-8").splitlines():
        row = json.loads(line)
        files += 1
        chars += int(row.get("chars", 0))
        quality[row.get("quality", "unknown")] += 1
        weighted[row.get("quality", "unknown")] += int(row.get("weight", 1))
        language[row.get("language", "unknown")] += 1

    corpus = BASE_DIR / "data" / "instruction_clean" / "tagged_corpus.txt"
    corpus_chars = corpus.stat().st_size if corpus.is_file() else 0

    return {
        "files": files,
        "source_chars": chars,
        "corpus_chars": corpus_chars,
        "estimated_tokens": corpus_chars // 4,
        "quality_counts": dict(quality),
        "weighted_records": dict(weighted),
        "languages": dict(language),
    }


def eval_summary(eval_payload: dict) -> list[str]:
    if not eval_payload:
        return ["- Nenhuma avaliação encontrada."]
    lines = [f"- Aggregate: `{json.dumps(eval_payload.get('aggregate', {}), ensure_ascii=False)}`"]
    by_category = eval_payload.get("by_category", {})
    if by_category:
        lines.append("- Por categoria:")
        for category, values in sorted(by_category.items()):
            lines.append(f"  - {category}: `{json.dumps(values, ensure_ascii=False)}`")
    return lines


def roadmap_excerpt() -> list[str]:
    if not ROADMAP.is_file():
        return []
    text = ROADMAP.read_text(encoding="utf-8")
    marker = "## Quanto Falta Para o Final"
    if marker in text:
        return text[text.index(marker) :].splitlines()[:40]
    return text.splitlines()[:40]


def write_report(output: Path) -> None:
    now = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    training = active_training_processes()
    log = latest_train_log()
    log_info = parse_log(log) if log else None
    ckpt = checkpoint_status()
    mem = memory_status()
    data = dataset_summary()
    latest_eval = latest_file("generation_eval_*.json")
    latest_post = latest_file("post_train_report_*.md")
    latest_compare = latest_file("evaluation_compare_*.md")
    latest_controlled = latest_file("controlled_battery_*.md")
    latest_repo_benchmark = latest_file("repo_benchmark_*.md")
    eval_payload = load_eval(latest_eval)

    lines = [
        "# NexusAI Complete Progress Report",
        "",
        f"Generated at: {now}",
        "",
        "## What We Are Doing",
        "",
        "We are building NexusAI as a local coding assistant specialized in professional websites, fullstack apps, Flask APIs, Electron desktop apps, project memory, patch review, and measurable self-improvement.",
        "",
        "The current focus is behavior fine-tuning: teaching the model to follow instructions, keep language boundaries, avoid vague answers, and generate more valid code.",
        "",
        "## Current Status",
        "",
    ]

    if training:
        lines.append("- Training: RUNNING")
        for proc in training:
            lines.append(f"  - PID `{proc['pid']}`, CPU `{proc['cpu_seconds']}s`, started `{proc['started_at']}`")
    else:
        lines.append("- Training: STOPPED")

    if log_info:
        lines.extend(
            [
                f"- Latest log: `{log_info['path']}`",
                f"- Deadline: `{log_info['deadline'] or 'none'}`",
            ]
        )
        if log_info["last_losses"]:
            last = log_info["last_losses"][-1]
            lines.append(f"- Last loss: epoch `{last['epoch']}`, step `{last['step']}`, loss `{last['loss']}`")
        if log_info["last_epoch_avgs"]:
            avg = log_info["last_epoch_avgs"][-1]
            lines.append(f"- Last epoch avg: epoch `{avg['epoch']}`, avg_loss `{avg['avg_loss']}`")

    lines.extend(
        [
            f"- Best checkpoint: `{ckpt['path']}`",
            f"- Checkpoint updated: `{ckpt.get('last_modified', 'not found')}`",
            f"- Memory DB: `{mem['path']}` ({mem['size_kb']} KB)",
            "",
            "## What We Have Built",
            "",
            "- Training pipeline with checkpoint and resume.",
            "- Causal language-model training flow.",
            "- Fullstack/instruction corpus builder.",
            "- Weighted dataset quality levels: gold, silver, bronze.",
            "- Negative examples and chain-correction examples.",
            "- Behavior fine-tuning config with lower learning rate.",
            "- SQLite memory with facts, preferences, project decisions, and interactions.",
            "- Inference aligned to `### Instruction` / `### Response`.",
            "- Benchmark with 30 fixed prompts.",
            "- Evaluation metrics: score, instruction following, repetition, syntax, compile-like rate.",
            "- Post-training report and evaluation comparison scripts.",
            "- Release freeze for `v0.1_candidate`.",
            "- Controlled production generation mode: task router, validators, retry loop, and failure DB.",
            "- Real-world controlled battery prompts for site, Flask, React, Electron, patch, bugfix, and format tests.",
            "- HTML preview writer for validated generated sites.",
            "- Failure-to-gold exporter for corrected real failures.",
            "- Repo mode: project index, relevant file selection, stack-aware tests, patch backup, rollback.",
            "- Project-level benchmark with 5 fixture projects.",
            "- Real task metrics: resolved, assisted, failed, success rate, assisted success rate.",
            "- Replay storage for task sessions and events.",
            "- Weekly-style failure ranking from real stored failures.",
            "- Strict mode checks for placeholders, training marker leaks, missing patch-review sections, approval and tests.",
            "- Command sandbox for safe local command execution.",
            "- Git helpers for status, diff, summary and commit-message suggestions.",
            "- Context budget trimming for repo mode.",
            "- Automatic `.nexus` project docs generation.",
            "- Slash commands such as `/analyze-project`, `/run-tests`, `/rollback`, `/generate-docs`, `/metrics` and `/failures`.",
            "",
            "## Dataset",
            "",
            f"- Files: `{data.get('files', 'n/a')}`",
            f"- Estimated corpus tokens: `{data.get('estimated_tokens', 'n/a')}`",
            f"- Quality counts: `{json.dumps(data.get('quality_counts', {}), ensure_ascii=False)}`",
            f"- Weighted records: `{json.dumps(data.get('weighted_records', {}), ensure_ascii=False)}`",
            f"- Languages: `{json.dumps(data.get('languages', {}), ensure_ascii=False)}`",
            "",
            "## Latest Evaluation",
            "",
            f"- Latest evaluation file: `{latest_eval or 'none'}`",
            f"- Latest post-train report: `{latest_post or 'none'}`",
            f"- Latest comparison: `{latest_compare or 'none'}`",
            f"- Latest controlled battery: `{latest_controlled or 'none'}`",
            f"- Latest repo benchmark: `{latest_repo_benchmark or 'none'}`",
            *eval_summary(eval_payload),
            "",
            "## Progress",
            "",
        ]
    )

    lines.extend(roadmap_excerpt())

    lines.extend(
        [
            "",
            "## Current Diagnosis",
            "",
            "- Repetition is mostly controlled.",
            "- Compile-like structure has improved.",
            "- The main remaining bottleneck is instruction following.",
            "- The current behavior fine-tune is designed to improve instruction following and language purity.",
            "- The next product layer is now in place: generation can be routed, validated, retried, and saved as a failure for future gold examples.",
            "- Repo mode is now the main path: index project, select files, propose patch, test, rollback, and collect failures.",
            "- The next proof point is no longer training: run 50 real tasks and classify each as resolved, assisted, or failed.",
            "",
            "## Next Steps",
            "",
            "1. Let the behavior fine-tune finish.",
            "2. Run the post-training benchmark.",
            "3. Compare against the previous benchmark.",
            "4. Run `run_controlled_battery.py` to test real user-style tasks.",
            "5. Classify failures and convert repeated failures into new gold examples.",
            "6. Use `export_failures_to_gold.py` after failures have corrected responses.",
            "7. If instruction following improves, continue adding gold examples.",
            "8. If instruction following does not improve, increase instruction-pair density and reduce bronze influence.",
            "9. Once quality is acceptable, integrate generation more tightly with Nexus preview and patch review.",
        ]
    )

    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text("\n".join(lines) + "\n", encoding="utf-8")


def main() -> None:
    parser = argparse.ArgumentParser(description="Generate full NexusAI progress report.")
    parser.add_argument("--output", default=str(LOG_DIR / f"project_report_{int(time.time())}.md"))
    args = parser.parse_args()
    output = Path(args.output)
    write_report(output)
    print(f"Report: {output}")


if __name__ == "__main__":
    main()
