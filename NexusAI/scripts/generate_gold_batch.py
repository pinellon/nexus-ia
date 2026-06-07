"""Generate gold batch 003 with Python/Flask code-only responses.

This batch intentionally removes Markdown fences from already validated
Python/Flask examples. Its purpose is to teach the model that "apenas codigo"
means raw code only, with no prose and no ``` wrappers.
"""

from __future__ import annotations

import ast
import json
import re
from pathlib import Path


BASE_DIR = Path(__file__).parent
RAW_DIR = BASE_DIR / "data" / "raw" / "user_lessons" / "premium_instruction_pairs"
SOURCE_JSONL = RAW_DIR / "gold_batch_001_python_flask.jsonl"
OUT_MD = RAW_DIR / "gold_batch_003_python_flask_code_only.md"
OUT_JSONL = RAW_DIR / "gold_batch_003_python_flask_code_only.jsonl"
CODE_FENCE_RE = re.compile(r"```python[ \t]*\r?\n(.*?)```", re.DOTALL)


def extract_python_code(response: str) -> str:
    match = CODE_FENCE_RE.search(response)
    if not match:
        raise ValueError("source response is not a python fenced code block")
    code = match.group(1).strip()
    ast.parse(code)
    if "```" in code:
        raise ValueError("code still contains markdown fence")
    if "..." in code:
        raise ValueError("code contains ellipsis placeholder")
    return code


def load_source_pairs() -> list[dict]:
    if not SOURCE_JSONL.is_file():
        raise FileNotFoundError(f"source batch not found: {SOURCE_JSONL}")

    pairs = []
    for line in SOURCE_JSONL.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if not line:
            continue
        item = json.loads(line)
        code = extract_python_code(item["response"])
        instruction = item["instruction"].strip()
        instruction = instruction.rstrip(".")
        instruction = (
            f"{instruction}. Retorne apenas codigo Python puro, sem Markdown, "
            "sem crases e sem explicacao."
        )
        pairs.append(
            {
                "source": item["source"].replace("gold_batch_001", "gold_batch_003"),
                "kind": "python",
                "instruction": instruction,
                "response": code,
                "issues": [],
            }
        )
    return pairs


def validate_pairs(pairs: list[dict]) -> None:
    seen_instructions = set()
    for pair in pairs:
        instruction = pair["instruction"]
        response = pair["response"]
        if instruction in seen_instructions:
            raise ValueError(f"duplicate instruction: {instruction}")
        seen_instructions.add(instruction)
        if "```" in response:
            raise ValueError(f"markdown fence in response: {pair['source']}")
        if any(marker in response.lower() for marker in ("<sample>", "</sample>", "<file ", "</file>")):
            raise ValueError(f"training marker in response: {pair['source']}")
        ast.parse(response)


def write_markdown(pairs: list[dict]) -> None:
    lines = [
        "quality: gold",
        "",
        "# Gold Batch 003 - Python/Flask Code Only",
        "",
        "All responses are raw Python code. No Markdown fences, no prose, no placeholders.",
        "",
    ]
    for index, pair in enumerate(pairs, start=1):
        lines.extend(
            [
                f"## Pair {index:03d}",
                "",
                "### Instruction:",
                pair["instruction"],
                "",
                "### Response:",
                pair["response"],
                "",
            ]
        )
    OUT_MD.write_text("\n".join(lines), encoding="utf-8")


def write_jsonl(pairs: list[dict]) -> None:
    with OUT_JSONL.open("w", encoding="utf-8") as f:
        for pair in pairs:
            f.write(json.dumps(pair, ensure_ascii=False) + "\n")


def main() -> None:
    RAW_DIR.mkdir(parents=True, exist_ok=True)
    pairs = load_source_pairs()
    validate_pairs(pairs)
    write_markdown(pairs)
    write_jsonl(pairs)
    print(f"Generated {len(pairs)} code-only pairs")
    print(f"Markdown: {OUT_MD}")
    print(f"JSONL: {OUT_JSONL}")


if __name__ == "__main__":
    main()
