import json
from pathlib import Path

ARQUIVOS = [
    "data/raw/sft_merged.jsonl",
    "data/raw/sft_stdlib.jsonl",
    "data/raw/sft_stdlib_sft_tier.jsonl",
    "data/raw/sft_examples.jsonl"
]

CONTAMINANTES = [
    "TypeScript", "interface ", "type ", ": string", ": number",
    ": boolean", "=>", ".tsx", ".ts", "import React",
    "const ", "let ", "export default",
]

REQUIRED_DOMAIN = ["python", "flask", "def ", "import ", ".py"]

def score_exemplo(text: str) -> dict:
    ts_hits = sum(1 for t in CONTAMINANTES if t in text)
    py_hits = sum(1 for t in REQUIRED_DOMAIN if t.lower() in text.lower())
    return {"ts": ts_hits, "py": py_hits}

for arquivo in ARQUIVOS:
    path = Path(arquivo)
    if not path.exists():
        print(f"\n[SKIP] {arquivo} — não encontrado")
        continue

    limpos, contaminados = [], []

    with open(path, encoding="utf-8") as f:
        for linha in f:
            linha = linha.strip()
            if not linha:
                continue
            ex = json.loads(linha)
            text = str(ex)
            score = score_exemplo(text)

            if score["ts"] >= 2 and score["py"] == 0:
                contaminados.append(ex)
            else:
                limpos.append(ex)

    total = len(limpos) + len(contaminados)
    pct_limpo = 100 * len(limpos) / total if total else 0
    pct_cont  = 100 * len(contaminados) / total if total else 0

    print(f"\n{'='*50}")
    print(f"Arquivo:      {path.name}")
    print(f"Total:        {total}")
    print(f"Limpos:       {len(limpos):>6}  ({pct_limpo:.1f}%)")
    print(f"Contaminados: {len(contaminados):>6}  ({pct_cont:.1f}%)")

    if pct_cont > 30:
        print(f"  ⚠️  RECOMENDAÇÃO: DESCARTAR (>{pct_cont:.0f}% contaminado)")
    else:
        print(f"  ✅  RECOMENDAÇÃO: FILTRAR (contaminação controlada)")

    # Salva versão filtrada
    out = path.parent / f"{path.stem}_clean.jsonl"
    with open(out, "w", encoding="utf-8") as f:
        for ex in limpos:
            f.write(json.dumps(ex, ensure_ascii=False) + "\n")
    print(f"  Salvo em:    {out}")

    # Mostra 3 exemplos de contaminados para inspeção manual
    if contaminados:
        print(f"\n  --- Amostra de contaminados ({min(3, len(contaminados))} de {len(contaminados)}) ---")
        for ex in contaminados[:3]:
            text = str(ex)
            print(f"  > {text[:180]}")
            print()
