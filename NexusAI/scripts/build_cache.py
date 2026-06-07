# build_cache.py — roda UMA VEZ antes do treino
# Gera data/cache/train.npy (offsets) + data/cache/train_ids.bin (ids compactados)
# O treino carrega via mmap: RAM constante independente do tamanho do dataset

import json
import struct
import numpy as np
from pathlib import Path
from tokenizers import ByteLevelBPETokenizer

TOKENIZER_PATH = "tokenizer/v2"
DATA_FILES = [
    "data/raw/sft_merged.jsonl",
    "data/raw/sft_stdlib.jsonl",
    "data/raw/sft_examples.jsonl"
]
MAX_LEN    = 256
CACHE_DIR  = Path("data/cache")
CACHE_IDS  = CACHE_DIR / "train_ids.bin"    # sequência plana de uint16
CACHE_OFF  = CACHE_DIR / "train_offsets.npy" # offsets[i] = posição em train_ids do exemplo i

def main():
    CACHE_DIR.mkdir(parents=True, exist_ok=True)

    tok = ByteLevelBPETokenizer(
        f"{TOKENIZER_PATH}/vocab.json",
        f"{TOKENIZER_PATH}/merges.txt",
    )
    tok.enable_truncation(max_length=MAX_LEN)

    print("Lendo e tokenizando exemplos...")
    offsets = [0]
    total_tokens = 0

    with open(CACHE_IDS, "wb") as bin_f:
        for arq in DATA_FILES:
            path = Path(arq)
            if not path.exists():
                print(f"  [SKIP] {arq}")
                continue
            with open(path, encoding="utf-8") as f:
                for i, linha in enumerate(f):
                    linha = linha.strip()
                    if not linha:
                        continue
                    ex = json.loads(linha)
                    instruction = ex.get("instruction") or ex.get("prompt", "")
                    response    = ex.get("response")    or ex.get("output", "")
                    text = (
                        f"### Instruction:\n{instruction.strip()}\n"
                        f"### Response:\n{response.strip()}<EOS>"
                    )
                    enc = tok.encode(text)
                    ids = enc.ids[:MAX_LEN]

                    # Escreve como uint16 (vocab 16k cabe em 2 bytes)
                    bin_f.write(struct.pack(f"{len(ids)}H", *ids))
                    total_tokens += len(ids)
                    offsets.append(total_tokens)

                    if i % 5000 == 0:
                        print(f"  {arq} — linha {i}, tokens acumulados: {total_tokens:,}")

    np.save(str(CACHE_OFF), np.array(offsets, dtype=np.int64))

    n_examples = len(offsets) - 1
    size_mb = CACHE_IDS.stat().st_size / 1_048_576
    print(f"\nCache gerado:")
    print(f"  Exemplos : {n_examples:,}")
    print(f"  Tokens   : {total_tokens:,}")
    print(f"  Tamanho  : {size_mb:.1f} MB  ({CACHE_IDS})")
    print(f"  Offsets  : {CACHE_OFF}")
    print("\nPronto. Rode 'python train_v2.py' agora.")

if __name__ == "__main__":
    main()
