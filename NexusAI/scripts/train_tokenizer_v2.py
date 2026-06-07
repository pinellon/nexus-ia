import json
from pathlib import Path
from tokenizers import ByteLevelBPETokenizer

tokenizer = ByteLevelBPETokenizer()
tokenizer.train(
    files=["data/raw/corpus_tokenizer.txt"],
    vocab_size=16000,
    min_frequency=1,
    special_tokens=[
        "<PAD>", "<BOS>", "<EOS>", "<UNK>", "<SEP>",
        "@app.route", "@app.get", "@app.post", "@app.put", "@app.delete",
        "### Instruction:", "### Response:",
    ]
)

out_dir = Path("tokenizer/v2")
out_dir.mkdir(parents=True, exist_ok=True)
tokenizer.save_model(str(out_dir))

vocab = json.loads((out_dir / "vocab.json").read_text(encoding="utf-8"))
print(f"Vocab real: {len(vocab)} tokens")

tokens_alvo = [
    "jsonify",
    "Blueprint",
    "@app.route",
    "request.json",
    "def ",
    "return ",
    "Flask(__name__)",
    "-> str:",
    "-> int:",
    ": Optional[",
    "async def ",
    "self.request",
    "### Instruction:",
    "### Response:",
]

print()
print(f"{'Token alvo':<30} {'# tokens':<10} Fragmentos")
print("-" * 72)
for t in tokens_alvo:
    enc = tokenizer.encode(t)
    n = len(enc.tokens)
    if n <= 2:
        status = "OK  "
    elif n == 3:
        status = "~   "
    else:
        status = "FRAG"
    print(f"  [{status}] {t:<28} {n:<10} {enc.tokens}")
