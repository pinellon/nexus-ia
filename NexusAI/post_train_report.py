"""Run a post-training evaluation and produce a compact markdown report."""

from __future__ import annotations

import argparse
import json
import subprocess
import sys
import time
from datetime import datetime
from pathlib import Path

import psutil

from nexus_status import active_training_processes, latest_train_log, parse_log, checkpoint_status


BASE_DIR = Path(__file__).parent
LOG_DIR = BASE_DIR / "logs"


def wait_for_training(timeout_minutes: float, poll_seconds: int) -> None:
    deadline = time.time() + timeout_minutes * 60
    while time.time() < deadline:
        active = [
            proc for proc in active_training_processes()
            if "post_train_report.py" not in proc.get("cmdline", "")
        ]
        if not active:
            return
        print(f"Training still running: {', '.join(str(proc['pid']) for proc in active)}")
        time.sleep(poll_seconds)
    raise TimeoutError(f"Training still running after {timeout_minutes} minutes")


def latest_eval_file(before: set[Path]) -> Path:
    after = set(LOG_DIR.glob("generation_eval_*.json"))
    new_files = sorted(after - before, key=lambda path: path.stat().st_mtime, reverse=True)
    if new_files:
        return new_files[0]
    files = sorted(after, key=lambda path: path.stat().st_mtime, reverse=True)
    if not files:
        raise FileNotFoundError("No generation_eval_*.json file found")
    return files[0]


def run_evaluation(config: str) -> Path:
    before = set(LOG_DIR.glob("generation_eval_*.json"))
    subprocess.run(
        [
            sys.executable,
            "evaluate_generation_quality.py",
            "--config",
            config,
            "--tokens",
            "180",
            "--temperature",
            "0.25",
            "--top_k",
            "30",
        ],
        cwd=BASE_DIR,
        check=True,
    )
    return latest_eval_file(before)


def previous_eval_file(current: Path) -> Path | None:
    files = sorted(LOG_DIR.glob("generation_eval_*.json"), key=lambda path: path.stat().st_mtime, reverse=True)
    others = [path for path in files if path != current]
    return others[0] if others else None


def summarize_eval(path: Path) -> tuple[int, list[str]]:
    payload = json.loads(path.read_text(encoding="utf-8"))
    data = payload["results"] if isinstance(payload, dict) and "results" in payload else payload
    total = 0
    lines = []
    for item in data:
        score = int(item["score"]["score"])
        total += score
        found = ", ".join(item["score"].get("found_terms", [])) or "none"
        penalties = ", ".join(item["score"].get("penalties", [])) or "none"
        follow = item["score"].get("instruction_following", 0)
        syntax = item["score"].get("syntax_score", 0)
        rep = item["score"].get("repetition_score", 0)
        lines.append(
            f"- {item['name']}: score {score}; follow {follow}; syntax {syntax}; "
            f"repetition {rep}; found {found}; penalties {penalties}"
        )
    return total, lines


def write_report(eval_path: Path) -> Path:
    log = latest_train_log()
    log_info = parse_log(log) if log else None
    ckpt = checkpoint_status()
    total, eval_lines = summarize_eval(eval_path)
    payload = json.loads(eval_path.read_text(encoding="utf-8"))
    aggregate = payload.get("aggregate", {}) if isinstance(payload, dict) else {}
    by_category = payload.get("by_category", {}) if isinstance(payload, dict) else {}
    report_path = LOG_DIR / f"post_train_report_{int(time.time())}.md"

    lines = [
        "# NexusAI Post-Training Report",
        "",
        f"Generated at: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}",
        f"Evaluation file: `{eval_path}`",
        f"Total score: `{total}`",
        "",
        "## Evaluation",
        f"- Aggregate: `{json.dumps(aggregate, ensure_ascii=False)}`",
        "",
        "## By Category",
        *[
            f"- {category}: `{json.dumps(values, ensure_ascii=False)}`"
            for category, values in sorted(by_category.items())
        ],
        "",
        "## Cases",
        *eval_lines,
        "",
        "## Checkpoint",
        f"- Path: `{ckpt['path']}`",
        f"- Updated: `{ckpt.get('last_modified', 'not found')}`",
        f"- Size MB: `{ckpt.get('size_mb', 'n/a')}`",
        "",
    ]

    if log_info:
        lines.extend(
            [
                "## Training Log",
                f"- Path: `{log_info['path']}`",
                f"- Updated: `{log_info['last_modified']}`",
                f"- Deadline: `{log_info['deadline'] or 'none'}`",
            ]
        )
        if log_info["last_losses"]:
            last = log_info["last_losses"][-1]
            lines.append(f"- Last loss: epoch {last['epoch']} step {last['step']} loss {last['loss']}")
        if log_info["last_epoch_avgs"]:
            last_avg = log_info["last_epoch_avgs"][-1]
            lines.append(f"- Last avg loss: epoch {last_avg['epoch']} avg {last_avg['avg_loss']}")

    report_path.write_text("\n".join(lines) + "\n", encoding="utf-8")
    return report_path


def main() -> None:
    parser = argparse.ArgumentParser(description="Wait for train.py, evaluate, and write report.")
    parser.add_argument("--config", default="config.micro-instruct-fullstack.infinite.json")
    parser.add_argument("--wait", action="store_true")
    parser.add_argument("--timeout_minutes", type=float, default=120)
    parser.add_argument("--poll_seconds", type=int, default=60)
    args = parser.parse_args()

    if args.wait:
        wait_for_training(args.timeout_minutes, args.poll_seconds)

    eval_path = run_evaluation(args.config)
    report_path = write_report(eval_path)
    previous = previous_eval_file(eval_path)
    if previous:
        compare_path = LOG_DIR / f"evaluation_compare_{int(time.time())}.md"
        subprocess.run(
            [
                sys.executable,
                "compare_evaluations.py",
                str(previous),
                str(eval_path),
                "--output",
                str(compare_path),
            ],
            cwd=BASE_DIR,
            check=True,
        )
        print(f"Comparison: {compare_path}")
    print(f"Evaluation: {eval_path}")
    print(f"Report: {report_path}")


if __name__ == "__main__":
    main()
