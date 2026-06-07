"""Training script for Nexus Coder Tiny.

Low-VRAM friendly features:
- micro-batching with gradient accumulation;
- mixed precision on CUDA;
- checkpointing and resume support;
- optional early stopping from config.json.
"""

import argparse
import json
import os
import sys
import time
from datetime import datetime, timedelta
from pathlib import Path

import torch
import torch.nn as nn
from torch.nn.utils.rnn import pad_sequence
from torch.utils.data import DataLoader, Dataset
from tokenizers import Tokenizer

sys.path.append(str(Path(__file__).parent))
from model import TinyTransformer


def resolve_path(base_dir: Path, value: str) -> Path:
    path = Path(value)
    return path if path.is_absolute() else base_dir / path


def load_config(config_path: Path) -> dict:
    with config_path.open("r", encoding="utf-8") as f:
        return json.load(f)


def should_early_stop(losses: list[float], window: int, threshold_pct: float) -> bool:
    if window <= 0 or len(losses) < window:
        return False
    first = losses[-window]
    last = losses[-1]
    if first == 0:
        return False
    pct_change = abs(last - first) / abs(first) * 100
    return pct_change <= threshold_pct


def parse_stop_at(value: str | None) -> datetime | None:
    if not value:
        return None
    value = value.strip()
    now = datetime.now()
    for fmt in ("%H:%M", "%H:%M:%S"):
        try:
            parsed = datetime.strptime(value, fmt)
            candidate = now.replace(hour=parsed.hour, minute=parsed.minute, second=parsed.second, microsecond=0)
            if candidate <= now:
                candidate += timedelta(days=1)
            return candidate
        except ValueError:
            pass
    try:
        return datetime.fromisoformat(value)
    except ValueError as exc:
        raise ValueError("--stop_at must be HH:MM, HH:MM:SS, or an ISO datetime") from exc


class CodeDataset(Dataset):
    """Tokenizes all files in a directory and returns next-token chunks."""

    def __init__(self, data_dir: Path, tokenizer: Tokenizer, seq_len: int = 1024):
        self.seq_len = seq_len
        self.tokenizer = tokenizer
        self.files = sorted(p for p in data_dir.rglob("*") if p.is_file())
        self.raw_text = "\n".join(
            p.read_text(encoding="utf-8", errors="ignore") for p in self.files
        )
        self.tokens = self.tokenizer.encode(self.raw_text).ids
        self.num_samples = max(0, (len(self.tokens) - 1 + self.seq_len - 1) // self.seq_len)

    def __len__(self):
        return self.num_samples

    def __getitem__(self, idx):
        start = idx * self.seq_len
        end = start + self.seq_len + 1
        seq = self.tokens[start:end]
        input_ids = torch.tensor(seq[:-1], dtype=torch.long)
        target_ids = torch.tensor(seq[1:], dtype=torch.long)
        return input_ids, target_ids


def collate_fn(batch):
    inputs, targets = zip(*batch)
    inputs = pad_sequence(inputs, batch_first=True, padding_value=0)
    targets = pad_sequence(targets, batch_first=True, padding_value=-100)
    return inputs, targets


def latest_checkpoint(model_dir: Path) -> Path | None:
    checkpoints = sorted(model_dir.glob("*.pt"), key=lambda item: item.stat().st_mtime, reverse=True)
    return checkpoints[0] if checkpoints else None


def save_checkpoint(path: Path, model, optimizer, step: int, epoch: int, best_loss: float) -> Path:
    payload = {
        "model_state_dict": model.state_dict(),
        "optimizer_state_dict": optimizer.state_dict(),
        "step": step,
        "epoch": epoch,
        "best_loss": best_loss,
    }
    path.parent.mkdir(parents=True, exist_ok=True)
    stamp = int(time.time() * 1000)
    tmp_path = path.with_name(f".{path.stem}.{os.getpid()}.{stamp}.tmp")
    torch.save(payload, tmp_path)

    try:
        os.replace(tmp_path, path)
        return path
    except OSError:
        fallback_path = path.with_name(f"{path.stem}_fallback_{stamp}{path.suffix}")
        os.replace(tmp_path, fallback_path)
        return fallback_path
    finally:
        if tmp_path.exists():
            tmp_path.unlink()


def main():
    default_config = Path(__file__).with_name("config.json")
    parser = argparse.ArgumentParser(description="Train Nexus Coder Tiny")
    parser.add_argument("--resume", action="store_true", help="Resume from model/nexus_model_best.pt")
    parser.add_argument(
        "--reset_optimizer",
        action="store_true",
        help="When resuming, load only model weights and start a fresh optimizer/schedule.",
    )
    parser.add_argument("--config", type=str, default=str(default_config), help="Path to config.json")
    parser.add_argument("--epochs", type=int, default=None, help="Override number of epochs from config")
    parser.add_argument("--max_steps", type=int, default=0, help="Stop after this many optimizer steps. 0 means unlimited.")
    parser.add_argument("--max_minutes", type=float, default=0, help="Stop after this many minutes. 0 means unlimited.")
    parser.add_argument("--stop_at", type=str, default=None, help="Stop near this local time, e.g. 21:00")
    parser.add_argument("--log_interval", type=int, default=50, help="Print loss every N optimizer steps")
    args = parser.parse_args()
    stop_deadline = parse_stop_at(args.stop_at)
    if args.max_minutes:
        minutes_deadline = datetime.now() + timedelta(minutes=args.max_minutes)
        stop_deadline = min(stop_deadline, minutes_deadline) if stop_deadline else minutes_deadline

    cfg_path = Path(args.config).resolve()
    if not cfg_path.is_file():
        raise FileNotFoundError(f"Config file not found: {cfg_path}")
    cfg = load_config(cfg_path)
    config_dir = cfg_path.parent

    training_cfg = cfg["training"]
    early_stop_cfg = training_cfg.get("early_stop", {})
    early_stop_window = int(early_stop_cfg.get("window", 20))
    early_stop_threshold = float(early_stop_cfg.get("threshold", 0.5))

    clean_dir = resolve_path(config_dir, cfg["paths"]["clean_data"])
    token_path = resolve_path(config_dir, cfg["paths"]["token_dir"]) / "tokenizer.json"
    model_dir = resolve_path(config_dir, cfg["paths"]["model_dir"])
    log_dir = resolve_path(config_dir, cfg["paths"]["log_dir"])
    os.makedirs(model_dir, exist_ok=True)
    os.makedirs(log_dir, exist_ok=True)
    log_file = log_dir / f"train_{int(time.time())}.log"

    if not token_path.is_file():
        raise FileNotFoundError(f"Tokenizer not found: {token_path}")
    tokenizer = Tokenizer.from_file(str(token_path))

    tokenizer_vocab_size = tokenizer.get_vocab_size()
    vocab_size = int(cfg["model"].get("vocab_size", tokenizer_vocab_size))
    if vocab_size < tokenizer_vocab_size:
        raise ValueError(
            f"Config vocab_size ({vocab_size}) is smaller than tokenizer vocab ({tokenizer_vocab_size})."
        )

    d_model = int(cfg["model"].get("hidden_size", 256))
    nhead = int(cfg["model"].get("num_heads", 4))
    num_layers = int(cfg["model"].get("num_layers", 4))
    dim_ff = int(cfg["model"].get("dim_ff", d_model * 4))
    max_seq_len = int(cfg["model"].get("max_seq_len", 1024))
    micro_batch = int(training_cfg.get("micro_batch_size", 4))
    batch_size = int(training_cfg.get("batch_size", micro_batch))
    grad_accum = int(training_cfg.get("gradient_accumulation_steps", max(1, batch_size // micro_batch)))
    epochs = int(training_cfg.get("epochs", 3))
    if args.epochs is not None:
        epochs = args.epochs
    lr = float(training_cfg.get("learning_rate", 5e-4))
    warmup_steps = int(training_cfg.get("warmup_steps", 0))
    ckpt_interval = int(training_cfg.get("checkpoint_interval", 500))
    use_fp16 = bool(training_cfg.get("mixed_precision", True))
    use_cpu_fallback = bool(training_cfg.get("use_cpu_fallback", True))

    if micro_batch <= 0 or grad_accum <= 0:
        raise ValueError("micro_batch_size and gradient_accumulation_steps must be positive.")

    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    print(f"Device: {device}")
    if device.type == "cpu" and not use_cpu_fallback:
        raise RuntimeError("GPU not available and CPU fallback disabled in config.")

    model = TinyTransformer(
        vocab_size=vocab_size,
        d_model=d_model,
        nhead=nhead,
        num_layers=num_layers,
        dim_ff=dim_ff,
        max_seq_len=max_seq_len,
    ).to(device)
    model.configure_fp16(use_fp16 and device.type == "cuda")
    model.enable_gradient_checkpointing(True)

    optimizer = torch.optim.AdamW(model.parameters(), lr=lr)
    scaler = torch.amp.GradScaler("cuda", enabled=use_fp16 and device.type == "cuda")
    criterion = nn.CrossEntropyLoss(ignore_index=-100)

    start_epoch = 1
    total_steps = 0
    best_loss = float("inf")
    ckpt_path = latest_checkpoint(model_dir) if args.resume else None
    if args.resume and ckpt_path and ckpt_path.is_file():
        ckpt = torch.load(str(ckpt_path), map_location=device)
        model.load_state_dict(ckpt["model_state_dict"])
        if ckpt.get("optimizer_state_dict") and not args.reset_optimizer:
            optimizer.load_state_dict(ckpt["optimizer_state_dict"])
        for group in optimizer.param_groups:
            group["lr"] = lr
        if args.reset_optimizer:
            start_epoch = 1
            total_steps = 0
            best_loss = float("inf")
            print(f"Loaded model weights with fresh optimizer from {ckpt_path}")
        else:
            start_epoch = int(ckpt.get("epoch", 0)) + 1
            total_steps = int(ckpt.get("step", 0))
            best_loss = float(ckpt.get("best_loss", float("inf")))
            print(f"Resuming from epoch {start_epoch - 1}, step {total_steps}")

    dataset = CodeDataset(clean_dir, tokenizer, seq_len=max_seq_len)
    if len(dataset) == 0:
        raise ValueError(f"Not enough training tokens in {clean_dir}. Clean data and train the tokenizer first.")
    loader = DataLoader(dataset, batch_size=micro_batch, shuffle=True, collate_fn=collate_fn)

    loss_history = []
    with log_file.open("w", encoding="utf-8") as log_f:
        log_f.write(f"Training started at {time.strftime('%Y-%m-%d %H:%M:%S')}\n")
        log_f.write(
            f"Files: {len(dataset.files)} | Samples: {len(dataset)} | Effective batch: {micro_batch * grad_accum}\n"
        )
        if stop_deadline:
            log_f.write(f"Stop deadline: {stop_deadline.isoformat(timespec='seconds')}\n")
        log_f.flush()

        for epoch in range(start_epoch, epochs + 1):
            epoch_loss_sum = 0.0
            epoch_updates = 0
            model.train()
            optimizer.zero_grad(set_to_none=True)

            for batch_idx, (input_ids, targets) in enumerate(loader, start=1):
                input_ids = input_ids.to(device)
                targets = targets.to(device)

                with torch.autocast(
                    device_type=device.type,
                    enabled=use_fp16 and device.type == "cuda",
                ):
                    logits = model(input_ids)
                    raw_loss = criterion(logits.reshape(-1, vocab_size), targets.reshape(-1))
                    loss = raw_loss / grad_accum

                scaler.scale(loss).backward()

                should_step = batch_idx % grad_accum == 0 or batch_idx == len(loader)
                if should_step:
                    next_step = total_steps + 1
                    if warmup_steps > 0 and next_step <= warmup_steps:
                        step_lr = lr * next_step / warmup_steps
                    else:
                        step_lr = lr
                    for group in optimizer.param_groups:
                        group["lr"] = step_lr

                    scaler.step(optimizer)
                    scaler.update()
                    optimizer.zero_grad(set_to_none=True)
                    total_steps += 1
                    epoch_updates += 1
                    epoch_loss_sum += raw_loss.item()

                    if args.log_interval and total_steps % args.log_interval == 0:
                        avg_loss = epoch_loss_sum / max(1, epoch_updates)
                        log_line = f"Epoch {epoch} | Step {total_steps} | Loss {avg_loss:.4f}\n"
                        print(log_line.strip())
                        log_f.write(log_line)
                        log_f.flush()

                    if ckpt_interval and total_steps % ckpt_interval == 0:
                        step_path = model_dir / f"nexus_model_step{total_steps}.pt"
                        saved_path = save_checkpoint(step_path, model, optimizer, total_steps, epoch, best_loss)
                        log_f.write(f"Saved checkpoint {saved_path}\n")
                        log_f.flush()

                    if args.max_steps and total_steps >= args.max_steps:
                        summary = f"Reached max_steps={args.max_steps}; stopping dry run.\n"
                        print(summary.strip())
                        log_f.write(summary)
                        log_f.flush()
                        break

                    if stop_deadline and datetime.now() >= stop_deadline:
                        summary = f"Reached stop deadline {stop_deadline.isoformat(timespec='seconds')}; stopping training.\n"
                        print(summary.strip())
                        log_f.write(summary)
                        log_f.flush()
                        break

            epoch_avg = epoch_loss_sum / max(1, epoch_updates)
            loss_history.append(epoch_avg)
            summary = f"--- Epoch {epoch} finished | Avg loss: {epoch_avg:.4f}\n"
            print(summary.strip())
            log_f.write(summary)
            log_f.flush()

            if epoch_avg < best_loss:
                best_loss = epoch_avg
                best_path = model_dir / "nexus_model_best.pt"
                saved_path = save_checkpoint(best_path, model, optimizer, total_steps, epoch, best_loss)
                log_f.write(f"New best model saved to {saved_path}\n")
                log_f.flush()

            if should_early_stop(loss_history, early_stop_window, early_stop_threshold):
                final_ckpt_path = model_dir / f"nexus_model_earlystop_epoch{epoch}.pt"
                saved_path = save_checkpoint(final_ckpt_path, model, optimizer, total_steps, epoch, best_loss)
                log_f.write(f"Early-stop checkpoint saved to {saved_path}\n")
                log_f.flush()
                print("Training stopped early due to convergence criteria.")
                break

            if args.max_steps and total_steps >= args.max_steps:
                break

            if stop_deadline and datetime.now() >= stop_deadline:
                break

    print(f"Training completed. Logs saved to {log_file}")


if __name__ == "__main__":
    main()
