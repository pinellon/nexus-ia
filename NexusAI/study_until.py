"""Refresh the dataset/tokenizer and train until a wall-clock deadline."""

import argparse
import subprocess
import sys
from pathlib import Path


def run(args: list[str], cwd: Path):
    print("+", " ".join(args), flush=True)
    subprocess.run(args, cwd=cwd, check=True)


def main():
    base_dir = Path(__file__).parent.resolve()
    parser = argparse.ArgumentParser(description="Let NexusAI refresh data and study until a deadline.")
    parser.add_argument("--config", default="config.micro-python.json")
    parser.add_argument("--stop_at", default="21:00", help="Local time to stop, e.g. 21:00")
    parser.add_argument("--epochs", type=int, default=999, help="High ceiling; stop_at controls the real stop")
    parser.add_argument("--log_interval", type=int, default=10)
    args = parser.parse_args()

    config_path = base_dir / args.config
    run([sys.executable, "dataset_cleaner.py", "--raw_dir", "data/raw", "--clean_dir", "data/clean", "--reset"], cwd=base_dir)
    run([sys.executable, "tokenizer_train.py", "--config", str(config_path)], cwd=base_dir)
    run(
        [
            sys.executable,
            "train.py",
            "--config",
            str(config_path),
            "--epochs",
            str(args.epochs),
            "--stop_at",
            args.stop_at,
            "--log_interval",
            str(args.log_interval),
        ],
        cwd=base_dir,
    )


if __name__ == "__main__":
    main()
