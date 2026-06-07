import json
from pathlib import Path
from tokenizers import ByteLevelBPETokenizer

ARQUIVOS = [
    "data/sft_merged.jsonl",
    "data/sft_stdlib.jsonl",
    "data/sft_examples.jsonl",
]

def extrair_textos(arquivos, saida="data/corpus_tokenizer.txt"):
    total_linhas = 0
    with open(saida, "w", encoding="utf-8") as out:
        for arq in arquivos:
            path = Path(arq)
            if not path.exists():
                print(f"[SKIP] {arq} — não encontrado")
                continue
            with open(path, encoding="utf-8") as f:
                for linha in f:
                    linha = linha.strip()
                    if not linha:
                        continue
                    ex = json.loads(linha)
                    instruction = ex.get("instruction") or ex.get("prompt", "")
                    response    = ex.get("response")    or ex.get("output", "")
                    out.write(f"{instruction}\n{response}\n\n")
                    total_linhas += 1
    size_mb = Path(saida).stat().st_size / 1_048_576
    print(f"Corpus salvo: {saida}")
    print(f"  Pares extraidos : {total_linhas}")
    print(f"  Tamanho em disco: {size_mb:.2f} MB")
    return saida

print("=" * 50)
print("Etapa 1/3 — Extraindo corpus...")
corpus = extrair_textos(ARQUIVOS)

print("\nEtapa 2/3 — Treinando tokenizer BPE 16k...")
tokenizer = ByteLevelBPETokenizer()
tokenizer.train(
    files=[corpus],
    vocab_size=16000,
    min_frequency=2,
    special_tokens=["<PAD>", "<BOS>", "<EOS>", "<UNK>", "<SEP>"]
)

out_dir = Path("NexusAI/tokenizer_16k")
out_dir.mkdir(parents=True, exist_ok=True)
tokenizer.save_model(str(out_dir))
print(f"Tokenizer salvo em {out_dir}/")

# Mostra tamanho real do vocab
vocab_file = out_dir / "vocab.json"
if vocab_file.exists():
    vocab = json.loads(vocab_file.read_text(encoding="utf-8"))
    print(f"  Vocab real: {len(vocab)} tokens")

print("\nEtapa 3/3 — Validação de fragmentação:")
print(f"{'Token alvo':<28} {'# tokens':<10} {'Fragmentos'}")
print("-" * 70)

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
    ": List[",
    "async def ",
    "self.request",
    "app.config",
]

todos_ok = True
for t in tokens_alvo:
    enc = tokenizer.encode(t)
    n = len(enc.tokens)
    if n <= 2:
        status = "OK "
    elif n == 3:
        status = "~  "
    else:
        status = "FRAG"
        todos_ok = False
    print(f"  [{status}] {t:<26} {n:<10} {enc.tokens}")

print()
if todos_ok:
    print("Resultado: tokenizer bem fragmentado — pode prosseguir com a arquitetura.")
else:
    print("Resultado: fragmentacao alta em alguns tokens.")
    print("  -> Recomendacao: rerun com min_frequency=1 para tokens marcados como FRAG.")
