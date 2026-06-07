"""Cloud-friendly training runner for NexusAI Micro-Python."""

import argparse
import subprocess
import sys
from pathlib import Path

import torch


def run(args: list[str], cwd: Path):
    print("+", " ".join(args), flush=True)
    subprocess.run(args, cwd=cwd, check=True)


def print_device_info():
    print(f"torch: {torch.__version__}")
    print(f"cuda_available: {torch.cuda.is_available()}")
    if torch.cuda.is_available():
        print(f"cuda_device_count: {torch.cuda.device_count()}")
        print(f"cuda_device_name: {torch.cuda.get_device_name(0)}")
        props = torch.cuda.get_device_properties(0)
        print(f"cuda_memory_gb: {props.total_memory / (1024 ** 3):.2f}")
    else:
        print("device: cpu")


def main():
    base_dir = Path(__file__).parent.resolve()
    parser = argparse.ArgumentParser(description="Train NexusAI Micro-Python in Colab/Kaggle.")
    parser.add_argument("--config", type=str, default="config.micro-fullstack.json")
    parser.add_argument("--epochs", type=int, default=None, help="Override epochs for this cloud run")
    parser.add_argument("--max_steps", type=int, default=0, help="Optional dry-run step limit")
    parser.add_argument("--log_interval", type=int, default=10)
    parser.add_argument("--skip_tokenizer", action="store_true", help="Reuse existing tokenizer")
    parser.add_argument("--sample_prompt", type=str, default="def add(a, b):")
    args = parser.parse_args()

    config_path = Path(args.config)
    if not config_path.is_absolute():
        config_path = base_dir / config_path

    print_device_info()

    if not args.skip_tokenizer:
        run([sys.executable, "tokenizer_train.py", "--config", str(config_path)], cwd=base_dir)

    train_cmd = [sys.executable, "train.py", "--config", str(config_path), "--log_interval", str(args.log_interval)]
    if args.epochs is not None:
        train_cmd += ["--epochs", str(args.epochs)]
    if args.max_steps:
        train_cmd += ["--max_steps", str(args.max_steps)]
    run(train_cmd, cwd=base_dir)

    run(
        [
            sys.executable,
            "infer.py",
            "--config",
            str(config_path),
            "-p",
            args.sample_prompt,
            "-n",
            "80",
            "-k",
            "20",
            "-t",
            "0.2",
        ],
        cwd=base_dir,
    )

    print("\nDone. Download NexusAI/model_micro/nexus_model_best.pt for local use.")


if __name__ == "__main__":
    main()
