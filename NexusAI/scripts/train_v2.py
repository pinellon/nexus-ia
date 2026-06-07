# train_v2.py
import json
import math
import time
import warnings
import torch
import torch.nn as nn
from pathlib import Path
from tokenizers import ByteLevelBPETokenizer
from torch.utils.data import Dataset, DataLoader

# ── Config ──────────────────────────────────────────────────────────────────
CFG = {
    "tokenizer_path": "tokenizer/v2",
    "data_files": [
        "data/raw/sft_merged.jsonl",
        "data/raw/sft_stdlib.jsonl",
        "data/raw/sft_examples.jsonl"
    ],
    "output_dir": "models/v2",
    "hidden_size": 384,
    "num_layers": 6,
    "num_heads": 6,
    "dim_feedforward": 1536,
    "max_seq_len": 256,
    "dropout": 0.15,
    "weight_decay": 0.01,
    "learning_rate": 3e-4,
    "warmup_steps": 100,
    "epochs": 10,
    "batch_size": 8,
    "grad_clip": 1.0,
    "save_every_epochs": 2,
    "log_interval": 50,
    # ── Early stopping ────────────────────────────────────────────────────────
    "early_stop_patience": 3,    # epochs sem melhora >= MIN_DELTA antes de parar
    "early_stop_min_delta": 0.005, # melhora minima considerada real
}

# ── Tokenizer ────────────────────────────────────────────────────────────────
def load_tokenizer(path):
    tok = ByteLevelBPETokenizer(
        f"{path}/vocab.json",
        f"{path}/merges.txt",
    )
    tok.enable_padding(pad_id=0, pad_token="<PAD>")
    tok.enable_truncation(max_length=CFG["max_seq_len"])
    return tok

# ── Dataset (mmap -- RAM constante, sem OOM) ─────────────────────────────────
import numpy as np
import struct
import mmap as mmap_mod

CACHE_IDS_PATH = "data/cache/train_ids.bin"
CACHE_OFF_PATH = "data/cache/train_offsets.npy"

class SFTDataset(Dataset):
    """
    Le token ids de arquivo binario via mmap.
    RAM usada = tamanho do batch, nao do dataset inteiro.
    Gere o cache rodando: python build_cache.py
    """
    def __init__(self):
        if not Path(CACHE_IDS_PATH).exists() or not Path(CACHE_OFF_PATH).exists():
            raise FileNotFoundError(
                "Cache nao encontrado. Rode primeiro:\n  python build_cache.py"
            )
        self.offsets = np.load(CACHE_OFF_PATH)          # shape: (N+1,)
        self.n       = len(self.offsets) - 1
        self._bin    = open(CACHE_IDS_PATH, "rb")
        self._mmap   = mmap_mod.mmap(self._bin.fileno(), 0, access=mmap_mod.ACCESS_READ)
        size_mb = Path(CACHE_IDS_PATH).stat().st_size / 1_048_576
        print(f"Dataset: {self.n:,} exemplos via mmap ({size_mb:.1f} MB em disco)")

    def __len__(self):
        return self.n

    def __getitem__(self, idx):
        start  = int(self.offsets[idx])
        end    = int(self.offsets[idx + 1])
        length = end - start
        self._mmap.seek(start * 2)           # uint16 = 2 bytes cada
        raw = self._mmap.read(length * 2)
        ids = list(struct.unpack(f"{length}H", raw))
        return torch.tensor(ids, dtype=torch.long)


def collate_fn(batch):
    max_len = max(x.size(0) for x in batch)
    padded = torch.zeros(len(batch), max_len, dtype=torch.long)
    for i, x in enumerate(batch):
        padded[i, :x.size(0)] = x
    return padded

# ── Modelo ───────────────────────────────────────────────────────────────────
class NexusV2(nn.Module):
    def __init__(self, vocab_size, cfg):
        super().__init__()
        self.embedding = nn.Embedding(vocab_size, cfg["hidden_size"], padding_idx=0)
        self.pos_embedding = nn.Embedding(cfg["max_seq_len"], cfg["hidden_size"])

        encoder_layer = nn.TransformerEncoderLayer(
            d_model=cfg["hidden_size"],
            nhead=cfg["num_heads"],
            dim_feedforward=cfg["dim_feedforward"],
            dropout=cfg["dropout"],
            batch_first=True,
            norm_first=True,  # Pre-LN: mais estável que Post-LN
        )
        self.transformer = nn.TransformerEncoder(encoder_layer, num_layers=cfg["num_layers"])
        self.norm = nn.LayerNorm(cfg["hidden_size"])
        self.head = nn.Linear(cfg["hidden_size"], vocab_size, bias=False)

        # Weight tying: embedding e head compartilham pesos
        self.head.weight = self.embedding.weight

        self._init_weights()

    def _init_weights(self):
        for p in self.parameters():
            if p.dim() > 1:
                nn.init.xavier_uniform_(p)

    def forward(self, x):
        B, T = x.shape
        positions = torch.arange(T, device=x.device).unsqueeze(0)
        h = self.embedding(x) + self.pos_embedding(positions)

        # Causal mask para geração autoregressiva
        mask = nn.Transformer.generate_square_subsequent_mask(T, device=x.device)
        h = self.transformer(h, mask=mask, is_causal=True)
        h = self.norm(h)
        return self.head(h)

# ── LR Scheduler (warmup + cosine decay) ────────────────────────────────────
def get_lr(step, cfg, total_steps):
    if step < cfg["warmup_steps"]:
        return cfg["learning_rate"] * step / cfg["warmup_steps"]
    progress = (step - cfg["warmup_steps"]) / (total_steps - cfg["warmup_steps"])
    return cfg["learning_rate"] * 0.5 * (1 + math.cos(math.pi * progress))

# ── Treino ───────────────────────────────────────────────────────────────────
def train(resume=False):
    # Suprime warning benigno do PyTorch sobre nested tensors com norm_first=True
    warnings.filterwarnings("ignore", message="enable_nested_tensor")

    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    print(f"Device: {device}")

    # Configura número de threads da CPU para evitar overhead de hyperthreading
    import psutil
    physical_cores = psutil.cpu_count(logical=False)
    if physical_cores:
        torch.set_num_threads(physical_cores)
        print(f"Threads do PyTorch limitadas aos cores físicos: {physical_cores}")
    else:
        print("Não foi possível determinar os cores físicos. Usando padrão do PyTorch.")

    Path(CFG["output_dir"]).mkdir(parents=True, exist_ok=True)

    tokenizer = load_tokenizer(CFG["tokenizer_path"])
    vocab_size = tokenizer.get_vocab_size()
    print(f"Vocab size: {vocab_size}")

    dataset = SFTDataset()
    loader  = DataLoader(
        dataset,
        batch_size=CFG["batch_size"],
        shuffle=True,
        collate_fn=collate_fn,
        num_workers=0,  # 0 para compatibilidade Windows (evita issues com multiprocessing)
    )

    model = NexusV2(vocab_size, CFG).to(device)
    n_params = sum(p.numel() for p in model.parameters())
    print(f"Parametros: {n_params/1e6:.1f}M")
    print(f"Steps por epoch: {len(loader)}")
    print(f"Total steps: {len(loader) * CFG['epochs']}")
    print()

    optimizer = torch.optim.AdamW(
        model.parameters(),
        lr=CFG["learning_rate"],
        weight_decay=CFG["weight_decay"],
        betas=(0.9, 0.95),
    )
    criterion = nn.CrossEntropyLoss(ignore_index=0)

    total_steps = len(loader) * CFG["epochs"]
    step = 0
    best_loss = float("inf")
    start_epoch = 1

    # ── Early stopping ────────────────────────────────────────────────────────
    no_improve  = 0
    prev_best   = float("inf")
    PATIENCE    = CFG["early_stop_patience"]
    MIN_DELTA   = CFG["early_stop_min_delta"]

    # Tabela de metas de loss
    LOSS_METAS = {1: (4.5, 5.5), 3: (3.0, 3.8), 5: (2.2, 2.8), 10: (1.5, 2.0)}

    if resume:
        ckpt_path = Path(CFG["output_dir"]) / "nexus_v2_best.pt"
        if ckpt_path.exists():
            print(f"Carregando checkpoint de: {ckpt_path}")
            checkpoint = torch.load(ckpt_path, map_location=device)
            model.load_state_dict(checkpoint["model_state"])
            optimizer.load_state_dict(checkpoint["optimizer_state"])
            best_loss = checkpoint["loss"]
            prev_best = best_loss
            start_epoch = checkpoint["epoch"] + 1
            step = len(loader) * checkpoint["epoch"]
            print(f"Retomando do início da Epoch {start_epoch} | Best Loss: {best_loss:.4f} | Step Inicial: {step}")
        else:
            print("Checkpoint para resume não encontrado. Iniciando do zero.")

    for epoch in range(start_epoch, CFG["epochs"] + 1):
        model.train()
        epoch_loss = 0.0
        t0 = time.time()

        for batch in loader:
            batch = batch.to(device)
            x, y = batch[:, :-1], batch[:, 1:]

            # Atualiza LR
            lr = get_lr(step, CFG, total_steps)
            for g in optimizer.param_groups:
                g["lr"] = lr

            # Autocast apenas para CUDA, ja que bfloat16 em CPU no PyTorch e extremamente lento (44x de overhead)
            if device.type == "cuda":
                with torch.amp.autocast(device_type=device.type, dtype=torch.bfloat16):
                    logits = model(x)
                    loss = criterion(logits.reshape(-1, vocab_size), y.reshape(-1))
            else:
                logits = model(x)
                loss = criterion(logits.reshape(-1, vocab_size), y.reshape(-1))

            optimizer.zero_grad()
            loss.backward()
            nn.utils.clip_grad_norm_(model.parameters(), CFG["grad_clip"])
            optimizer.step()

            epoch_loss += loss.item()
            step += 1

            if step % CFG["log_interval"] == 0:
                print(f"  step {step:5d} | loss {loss.item():.4f} | lr {lr:.2e}")

        avg = epoch_loss / len(loader)
        elapsed = time.time() - t0
        print(f"\nEpoch {epoch:2d}/{CFG['epochs']} | avg_loss {avg:.4f} | {elapsed:.0f}s")

        # Verifica meta de loss
        if epoch in LOSS_METAS:
            lo, hi = LOSS_METAS[epoch]
            if avg > hi:
                print(f"  [ALERTA] Loss {avg:.4f} acima da meta ({lo:.1f}–{hi:.1f}) — checar LR/collate")
            elif avg < lo:
                print(f"  [AVISO]  Loss {avg:.4f} abaixo do minimo da meta — risco de overfit, considere lr=1e-4")
            else:
                print(f"  [OK]     Loss {avg:.4f} dentro da meta ({lo:.1f}–{hi:.1f})")

        if avg < best_loss:
            best_loss = avg
            ckpt = Path(CFG["output_dir"]) / "nexus_v2_best.pt"
            torch.save({
                "epoch": epoch,
                "model_state": model.state_dict(),
                "optimizer_state": optimizer.state_dict(),
                "loss": best_loss,
                "cfg": CFG,
            }, str(ckpt))
            print(f"  >> checkpoint salvo (best loss {best_loss:.4f})")

        if epoch % CFG["save_every_epochs"] == 0:
            ckpt = Path(CFG["output_dir"]) / f"nexus_v2_epoch{epoch}.pt"
            torch.save({
                "epoch": epoch,
                "model_state": model.state_dict(),
                "cfg": CFG,
            }, str(ckpt))
            print(f"  >> checkpoint periodico salvo: nexus_v2_epoch{epoch}.pt")

        # ── Early stopping check ───────────────────────────────────────────────
        if prev_best - avg > MIN_DELTA:
            no_improve = 0
            prev_best  = avg
        else:
            no_improve += 1
            print(f"  [PATIENCE] {no_improve}/{PATIENCE} epochs sem melhora >= {MIN_DELTA}")
            if no_improve >= PATIENCE:
                print(f"  [EARLY STOP] loss estagnada em {avg:.4f} por {PATIENCE} epochs. Parando.")
                break

        print()

    print(f"Treino concluido. Melhor loss: {best_loss:.4f}")

if __name__ == "__main__":
    import argparse
    parser = argparse.ArgumentParser()
    parser.add_argument("--resume", action="store_true", help="Retomar treino do melhor checkpoint")
    args = parser.parse_args()
    train(resume=args.resume)
