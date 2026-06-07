"""Refresh mixed corpus, build tagged samples, and train until a deadline."""

import argparse
import subprocess
import sys
from pathlib import Path


def run(args: list[str], cwd: Path):
    print("+", " ".join(args), flush=True)
    subprocess.run(args, cwd=cwd, check=True)


def main():
    base_dir = Path(__file__).parent.resolve()
    parser = argparse.ArgumentParser(description="Train NexusAI with tagged file/language samples.")
    parser.add_argument("--config", default="config.micro-instruct-fullstack.json")
    parser.add_argument("--stop_at", default="21:00")
    parser.add_argument("--epochs", type=int, default=999)
    parser.add_argument("--log_interval", type=int, default=10)
    parser.add_argument("--max_minutes", type=float, default=0)
    parser.add_argument("--profile", choices=["balanced", "behavior"], default="behavior")
    args = parser.parse_args()

    config_path = base_dir / args.config
    run([sys.executable, "fullstack_corpus_builder.py"], cwd=base_dir)
    run([sys.executable, "dataset_cleaner.py", "--raw_dir", "data/raw", "--clean_dir", "data/clean", "--reset"], cwd=base_dir)
    run(
        [
            sys.executable,
            "instruction_dataset_builder.py",
            "--clean_dir",
            "data/clean",
            "--output_dir",
            "data/instruction_clean",
            "--profile",
            args.profile,
        ],
        cwd=base_dir,
    )
    run([sys.executable, "tokenizer_train.py", "--config", str(config_path)], cwd=base_dir)

    train_cmd = [
        sys.executable,
        "train.py",
        "--config",
        str(config_path),
        "--epochs",
        str(args.epochs),
        "--log_interval",
        str(args.log_interval),
    ]
    if args.max_minutes:
        train_cmd += ["--max_minutes", str(args.max_minutes)]
    else:
        train_cmd += ["--stop_at", args.stop_at]
    run(train_cmd, cwd=base_dir)


if __name__ == "__main__":
    main()
