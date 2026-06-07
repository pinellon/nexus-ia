"""Show NexusAI training, memory, checkpoint, and evaluation status."""

from __future__ import annotations

import argparse
import json
import os
import re
import time
from datetime import datetime
from pathlib import Path

import psutil

from memory_store import DEFAULT_DB_PATH, ensure_db, search_memories


BASE_DIR = Path(__file__).parent
LOG_DIR = BASE_DIR / "logs"
MODEL_DIR = BASE_DIR / "model_instruct_fullstack"
BEST_MODEL = MODEL_DIR / "nexus_model_best.pt"
LOSS_PATTERN = re.compile(r"Epoch\s+(\d+).*Step\s+(\d+).*Loss\s+([0-9.]+)")
AVG_PATTERN = re.compile(r"Epoch\s+(\d+)\s+finished\s+\|\s+Avg loss:\s+([0-9.]+)")


def active_training_processes() -> list[dict]:
    processes = []
    for proc in psutil.process_iter(["cmdline", "cpu_times", "create_time"]):
        cmdline = proc.info.get("cmdline") or []
        if any("train.py" in str(part) for part in cmdline):
            processes.append(
                {
                    "pid": proc.pid,
                    "cmdline": " ".join(str(part) for part in cmdline),
                    "cpu_seconds": round(
                        float(proc.info["cpu_times"].user + proc.info["cpu_times"].system),
                        1,
                    ),
                    "started_at": datetime.fromtimestamp(proc.info["create_time"]).strftime("%Y-%m-%d %H:%M:%S"),
                }
            )
    return processes


def latest_train_log() -> Path | None:
    logs = sorted(LOG_DIR.glob("train_*.log"), key=lambda path: path.stat().st_mtime, reverse=True)
    return logs[0] if logs else None


def parse_log(path: Path) -> dict:
    lines = path.read_text(encoding="utf-8", errors="ignore").splitlines()
    losses = []
    avgs = []
    deadline = ""
    for line in lines:
        if line.startswith("Stop deadline:"):
            deadline = line.split(":", 1)[1].strip()
        if match := LOSS_PATTERN.search(line):
            losses.append(
                {
                    "epoch": int(match.group(1)),
                    "step": int(match.group(2)),
                    "loss": float(match.group(3)),
                }
            )
        if match := AVG_PATTERN.search(line):
            avgs.append({"epoch": int(match.group(1)), "avg_loss": float(match.group(2))})
    return {
        "path": str(path),
        "last_modified": datetime.fromtimestamp(path.stat().st_mtime).strftime("%Y-%m-%d %H:%M:%S"),
        "deadline": deadline,
        "last_losses": losses[-6:],
        "last_epoch_avgs": avgs[-6:],
        "tail": lines[-12:],
    }


def checkpoint_status() -> dict:
    if not BEST_MODEL.is_file():
        return {"exists": False, "path": str(BEST_MODEL)}
    stat = BEST_MODEL.stat()
    return {
        "exists": True,
        "path": str(BEST_MODEL),
        "size_mb": round(stat.st_size / (1024 * 1024), 2),
        "last_modified": datetime.fromtimestamp(stat.st_mtime).strftime("%Y-%m-%d %H:%M:%S"),
    }


def memory_status() -> dict:
    ensure_db(DEFAULT_DB_PATH)
    stat = DEFAULT_DB_PATH.stat()
    memories = search_memories("nexusai projeto site electron flask qualidade", limit=5)
    return {
        "path": str(DEFAULT_DB_PATH),
        "size_kb": round(stat.st_size / 1024, 1),
        "last_modified": datetime.fromtimestamp(stat.st_mtime).strftime("%Y-%m-%d %H:%M:%S"),
        "top_memories": [f"{memory.kind}:{memory.key}" for memory in memories],
    }


def main() -> None:
    parser = argparse.ArgumentParser(description="Show NexusAI status.")
    parser.add_argument("--json", action="store_true", help="Print machine-readable JSON")
    parser.add_argument("--watch", type=int, default=0, help="Refresh every N seconds")
    args = parser.parse_args()

    while True:
        log = latest_train_log()
        status = {
            "now": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
            "training_processes": active_training_processes(),
            "latest_log": parse_log(log) if log else None,
            "checkpoint": checkpoint_status(),
            "memory": memory_status(),
        }

        if args.json:
            print(json.dumps(status, indent=2, ensure_ascii=False))
            return

        if args.watch:
            os.system("cls" if os.name == "nt" else "clear")

        print(f"NexusAI status at {status['now']}")
        print()
        if status["training_processes"]:
            print("Training: RUNNING")
            for proc in status["training_processes"]:
                print(f"- PID {proc['pid']} | CPU {proc['cpu_seconds']}s | started {proc['started_at']}")
        else:
            print("Training: STOPPED")

        print()
        if status["latest_log"]:
            print(f"Latest log: {status['latest_log']['path']}")
            if status["latest_log"]["deadline"]:
                print(f"Deadline: {status['latest_log']['deadline']}")
            if status["latest_log"]["last_losses"]:
                last = status["latest_log"]["last_losses"][-1]
                print(f"Last loss: epoch {last['epoch']} step {last['step']} loss {last['loss']}")
            if status["latest_log"]["last_epoch_avgs"]:
                last_avg = status["latest_log"]["last_epoch_avgs"][-1]
                print(f"Last epoch avg: epoch {last_avg['epoch']} avg_loss {last_avg['avg_loss']}")

        print()
        ckpt = status["checkpoint"]
        print(f"Best checkpoint: {ckpt['path']}")
        print(f"Checkpoint updated: {ckpt.get('last_modified', 'not found')}")

        print()
        mem = status["memory"]
        print(f"Memory DB: {mem['path']} ({mem['size_kb']} KB)")
        print("Relevant memories:")
        for item in mem["top_memories"]:
            print(f"- {item}")

        if not args.watch:
            return
        time.sleep(max(1, args.watch))


if __name__ == "__main__":
    main()
