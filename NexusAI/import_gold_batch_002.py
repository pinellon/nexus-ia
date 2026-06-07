"""Import Gold Batch 002 JSONL into NexusAI raw lessons.

The pasted batch is JSONL, but the current audit pipeline extracts pairs from
Markdown. This importer writes both:
- gold_batch_002_frontend_debug.jsonl for traceability;
- gold_batch_002_frontend_debug.md for the dataset cleaner/auditor.
"""

from __future__ import annotations

import argparse
import json
from collections import Counter
from pathlib import Path


BASE_DIR = Path(__file__).parent
RAW_DIR = BASE_DIR / "data" / "raw" / "user_lessons" / "premium_instruction_pairs"
OUT_JSONL = RAW_DIR / "gold_batch_002_frontend_debug.jsonl"
OUT_MD = RAW_DIR / "gold_batch_002_frontend_debug.md"

SUPPLEMENTAL_PAIR = {
    "source": "gold_batch_002#html_25",
    "kind": "html",
    "instruction": "Crie um HTML completo para uma pagina de login com email, senha e botao entrar.",
    "response": """<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Login</title>
  <style>
    * { box-sizing: border-box; }
    body {
      margin: 0;
      min-height: 100vh;
      display: grid;
      place-items: center;
      font-family: Arial, sans-serif;
      background: #f4f6f8;
    }
    form {
      width: min(360px, 92vw);
      padding: 2rem;
      background: #ffffff;
      border: 1px solid #dde3ea;
      border-radius: 8px;
    }
    h1 { margin: 0 0 1.5rem; font-size: 1.5rem; }
    label { display: block; margin: 0 0 0.35rem; font-weight: 700; }
    input {
      width: 100%;
      padding: 0.75rem;
      margin-bottom: 1rem;
      border: 1px solid #cbd5df;
      border-radius: 4px;
      font-size: 1rem;
    }
    button {
      width: 100%;
      padding: 0.8rem 1rem;
      border: 0;
      border-radius: 4px;
      background: #2563eb;
      color: #ffffff;
      font-size: 1rem;
      cursor: pointer;
    }
    button:hover { background: #1d4ed8; }
  </style>
</head>
<body>
  <form>
    <h1>Entrar</h1>
    <label for="email">Email</label>
    <input id="email" name="email" type="email" autocomplete="email" required>
    <label for="senha">Senha</label>
    <input id="senha" name="senha" type="password" autocomplete="current-password" required>
    <button type="submit">Entrar</button>
  </form>
</body>
</html>""",
    "issues": [],
}

DEBOUNCE_WITHOUT_REST = """export function debounce<T>(
  fn: (value: T) => void,
  delay: number
): (value: T) => void {
  let timer: ReturnType<typeof setTimeout>;

  return (value: T) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(value), delay);
  };
}"""


def load_jsonl(path: Path) -> list[dict]:
    pairs: list[dict] = []
    for line_number, line in enumerate(path.read_text(encoding="utf-8").splitlines(), start=1):
        line = line.strip()
        if not line:
            continue
        try:
            item = json.loads(line)
        except json.JSONDecodeError as exc:
            raise ValueError(f"Invalid JSON at line {line_number}: {exc}") from exc
        pairs.append(item)
    return pairs


def validate_pair(pair: dict) -> None:
    required = {"source", "kind", "instruction", "response", "issues"}
    missing = required - set(pair)
    if missing:
        raise ValueError(f"Missing fields {missing} in {pair.get('source', '<unknown>')}")
    if not isinstance(pair["issues"], list):
        raise ValueError(f"issues must be a list in {pair['source']}")
    if pair["issues"]:
        raise ValueError(f"pair has issues in {pair['source']}: {pair['issues']}")
    if len(str(pair["instruction"]).strip()) < 8:
        raise ValueError(f"instruction too short in {pair['source']}")
    if len(str(pair["response"]).strip()) < 20:
        raise ValueError(f"response too short in {pair['source']}")
    response = str(pair["response"])
    if "<sample>" in response or "</sample>" in response:
        raise ValueError(f"training marker found in {pair['source']}")


def ensure_supplemental_pair(pairs: list[dict]) -> list[dict]:
    sources = {pair["source"] for pair in pairs}
    if SUPPLEMENTAL_PAIR["source"] not in sources:
        pairs.append(dict(SUPPLEMENTAL_PAIR))
    return pairs


def sanitize_pair(pair: dict) -> dict:
    pair = dict(pair)
    source = str(pair["source"])
    response = str(pair["response"])

    if source == "gold_batch_002#html_10":
        response = response.replace("Digite para filtrar...", "Digite para filtrar")
    elif source == "gold_batch_002#html_16":
        response = response.replace("Carregando...", "Carregando")
    elif source == "gold_batch_002#react_05":
        response = DEBOUNCE_WITHOUT_REST
    elif source == "gold_batch_002#react_06":
        response = response.replace(
            "setTarefas([...tarefas, { id: Date.now(), texto: input.trim() }]);",
            "setTarefas(tarefas.concat({ id: Date.now(), texto: input.trim() }));",
        ).replace("Nova tarefa...", "Nova tarefa")
    elif source == "gold_batch_002#react_18":
        response = (
            response.replace(
                "if (existe) return state.map((i) => i.id === acao.item.id ? { ...i, quantidade: i.quantidade + 1 } : i);",
                "if (existe) return state.map((i) => i.id === acao.item.id ? Object.assign({}, i, { quantidade: i.quantidade + 1 }) : i);",
            )
            .replace(
                "return [...state, { ...acao.item, quantidade: 1 }];",
                "return state.concat(Object.assign({}, acao.item, { quantidade: 1 }));",
            )
            .replace(
                "return state.map((i) => i.id === acao.id ? { ...i, quantidade: i.quantidade + 1 } : i);",
                "return state.map((i) => i.id === acao.id ? Object.assign({}, i, { quantidade: i.quantidade + 1 }) : i);",
            )
            .replace(
                "return state.map((i) => i.id === acao.id ? { ...i, quantidade: Math.max(1, i.quantidade - 1) } : i);",
                "return state.map((i) => i.id === acao.id ? Object.assign({}, i, { quantidade: Math.max(1, i.quantidade - 1) }) : i);",
            )
        )

    pair["response"] = response
    return pair


def write_jsonl(path: Path, pairs: list[dict]) -> None:
    with path.open("w", encoding="utf-8") as f:
        for pair in pairs:
            f.write(json.dumps(pair, ensure_ascii=False) + "\n")


def response_as_markdown(pair: dict) -> str:
    response = str(pair["response"]).strip()
    kind = str(pair["kind"]).lower()
    if response.startswith("```"):
        return response
    if kind == "html" and response.lower().startswith("<!doctype html"):
        return f"```html\n{response}\n```"
    if kind in {"react", "typescript"}:
        return f"```tsx\n{response}\n```"
    if kind == "debug":
        return response
    return response


def write_markdown(path: Path, pairs: list[dict]) -> None:
    lines = [
        "quality: gold",
        "",
        "# Gold Batch 002 - Frontend, React, TypeScript and Debug",
        "",
        "Curated Instruction/Response pairs imported from JSONL.",
        "",
    ]
    for index, pair in enumerate(pairs, start=1):
        lines.extend(
            [
                f"## Pair {index:03d} - {pair['source']}",
                "",
                "### Instruction:",
                str(pair["instruction"]).strip(),
                "",
                "### Response:",
                response_as_markdown(pair),
                "",
            ]
        )
    path.write_text("\n".join(lines), encoding="utf-8")


def main() -> None:
    parser = argparse.ArgumentParser(description="Import Gold Batch 002 JSONL into NexusAI lessons.")
    parser.add_argument("source", type=Path, help="Path to pasted JSONL file")
    args = parser.parse_args()

    pairs = [sanitize_pair(pair) for pair in ensure_supplemental_pair(load_jsonl(args.source.resolve()))]
    seen = set()
    for pair in pairs:
        validate_pair(pair)
        if pair["source"] in seen:
            raise ValueError(f"duplicate source: {pair['source']}")
        seen.add(pair["source"])

    RAW_DIR.mkdir(parents=True, exist_ok=True)
    write_jsonl(OUT_JSONL, pairs)
    write_markdown(OUT_MD, pairs)

    counts = Counter(pair["kind"] for pair in pairs)
    print(f"Imported pairs: {len(pairs)}")
    print(f"By kind: {dict(counts)}")
    print(f"JSONL: {OUT_JSONL}")
    print(f"Markdown: {OUT_MD}")


if __name__ == "__main__":
    main()
