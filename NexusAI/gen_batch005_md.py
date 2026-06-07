"""Convert gold_batch_005 JSONL to Markdown format for audit ingestion."""
import json
from pathlib import Path

BASE = Path(__file__).parent
src = BASE / "data/raw/user_lessons/premium_instruction_pairs/gold_batch_005_python_flask_html_js.jsonl"
out = BASE / "data/raw/user_lessons/premium_instruction_pairs/gold_batch_005_python_flask_html_js.md"

pairs = [json.loads(l) for l in src.read_text(encoding="utf-8").splitlines() if l.strip()]

lines = [
    "quality: gold",
    "",
    "# Gold Batch 005 - Python / Flask / HTML / CSS / JS",
    "",
    "Curated minimal-response pairs covering functions, classes, Flask routes, HTML fragments, CSS rules and JS utilities.",
    "",
]
for i, p in enumerate(pairs, 1):
    source = p["source"]
    lines += [
        f"## Pair {i:03d} - {source}",
        "",
        "### Instruction:",
        p["instruction"].strip(),
        "",
        "### Response:",
        p["response"].strip(),
        "",
    ]

out.write_text("\n".join(lines), encoding="utf-8")
print(f"MD salvo: {out}")
print(f"Total pares: {len(pairs)}")
