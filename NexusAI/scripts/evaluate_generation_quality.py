"""Benchmark NexusAI code generation quality.

The goal is not to prove the model is "smart". The goal is to track whether
changes to dataset, training, memory, and inference improve useful output.
"""

from __future__ import annotations

import argparse
import ast
import json
import re
import time
from dataclasses import dataclass
from html.parser import HTMLParser
from pathlib import Path

import sys
from pathlib import Path
PROJECT_ROOT = Path(__file__).parent.parent
sys.path.append(str(PROJECT_ROOT))
from infer import run_generation


BASE_DIR = Path(__file__).parent.parent
DEFAULT_BENCHMARK = BASE_DIR / "benchmark_prompts.json"
CODE_LIKE_KINDS = {
    "css",
    "dockerfile",
    "html",
    "javascript",
    "json",
    "patch",
    "python",
    "sql",
    "tsx",
    "typescript",
    "yaml",
}
CODE_BLOCK_RE = re.compile(r"```([A-Za-z0-9_+-]+)?[ \t]*\r?\n(.*?)```", re.DOTALL)
KIND_LANGUAGE_ALIASES = {
    "css": {"css"},
    "dockerfile": {"dockerfile"},
    "html": {"html"},
    "javascript": {"js", "javascript"},
    "json": {"json"},
    "patch": {"diff", "patch"},
    "python": {"py", "python"},
    "sql": {"sql"},
    "tsx": {"jsx", "tsx"},
    "typescript": {"ts", "typescript"},
    "yaml": {"yml", "yaml"},
}


@dataclass(frozen=True)
class EvalCase:
    name: str
    category: str
    kind: str
    prompt: str
    expected_terms: tuple[str, ...]
    banned_terms: tuple[str, ...] = (
        "lorem ipsum",
        "patch review",
        "</sample>",
        "<sample>",
        "</file>",
        "### instruction:",
    )


class SimpleHTMLChecker(HTMLParser):
    def __init__(self) -> None:
        super().__init__()
        self.tags: list[str] = []
        self.errors: list[str] = []

    def handle_starttag(self, tag: str, attrs) -> None:
        if tag not in {"meta", "link", "img", "input", "br", "hr"}:
            self.tags.append(tag)

    def handle_endtag(self, tag: str) -> None:
        if tag in {"meta", "link", "img", "input", "br", "hr"}:
            return
        if tag in self.tags[::-1]:
            index = len(self.tags) - 1 - self.tags[::-1].index(tag)
            del self.tags[index]
        else:
            self.errors.append(f"unexpected closing tag {tag}")


def load_cases(path: Path) -> list[EvalCase]:
    data = json.loads(path.read_text(encoding="utf-8"))
    return [
        EvalCase(
            name=item["name"],
            category=item.get("category", item["kind"]),
            kind=item["kind"],
            prompt=item["prompt"],
            expected_terms=tuple(item.get("expected_terms", [])),
            banned_terms=tuple(item.get("banned_terms", EvalCase.banned_terms)),
        )
        for item in data
    ]


def generated_part(text: str, prompt: str) -> str:
    return text[len(prompt) :].strip() if text.startswith(prompt) else text.strip()


def extract_code_block(text: str, kind: str) -> tuple[str, bool, str]:
    """Return the most relevant fenced code block for code-like benchmark cases."""
    blocks = [
        ((language or "").strip().lower(), body.strip())
        for language, body in CODE_BLOCK_RE.findall(text)
        if body.strip()
    ]
    if not blocks:
        return text.strip(), False, ""

    aliases = KIND_LANGUAGE_ALIASES.get(kind.lower(), set())
    for language, body in blocks:
        if language in aliases:
            return body, True, language
    return blocks[0][1], True, blocks[0][0]


def normalize_for_scoring(text: str, kind: str) -> tuple[str, bool, str]:
    if kind.lower() not in CODE_LIKE_KINDS:
        return text.strip(), False, ""
    return extract_code_block(text, kind)


def repetition_metrics(text: str) -> dict:
    words = re.findall(r"[A-Za-z0-9_À-ÿ-]{3,}", text.lower())
    if not words:
        return {"word_count": 0, "unique_ratio": 0.0, "repeated_4grams": 0}
    unique_ratio = len(set(words)) / len(words)
    grams = [" ".join(words[i : i + 4]) for i in range(max(0, len(words) - 3))]
    repeated_4grams = len(grams) - len(set(grams))
    return {
        "word_count": len(words),
        "unique_ratio": round(unique_ratio, 3),
        "repeated_4grams": repeated_4grams,
    }


def syntax_metrics(text: str, kind: str) -> dict:
    kind = kind.lower()
    if kind == "python":
        try:
            ast.parse(text)
            return {"syntax_ok": True, "syntax_error": ""}
        except SyntaxError as exc:
            return {"syntax_ok": False, "syntax_error": f"line {exc.lineno}: {exc.msg}"}

    if kind == "json":
        try:
            json.loads(text)
            return {"syntax_ok": True, "syntax_error": ""}
        except json.JSONDecodeError as exc:
            return {"syntax_ok": False, "syntax_error": f"line {exc.lineno}: {exc.msg}"}

    if kind == "html":
        parser = SimpleHTMLChecker()
        try:
            parser.feed(text)
            has_document = all(marker in text.lower() for marker in ("<html", "<head", "<body"))
            ok = has_document and not parser.errors
            return {
                "syntax_ok": ok,
                "syntax_error": "; ".join(parser.errors[:3]) if parser.errors else "",
            }
        except Exception as exc:
            return {"syntax_ok": False, "syntax_error": str(exc)}

    if kind in {"typescript", "tsx", "javascript", "css", "yaml", "dockerfile", "patch", "markdown", "sql", "explanation"}:
        balanced_braces = text.count("{") == text.count("}")
        balanced_parens = text.count("(") == text.count(")")
        if kind in {"typescript", "tsx", "javascript"}:
            return {
                "syntax_ok": balanced_braces and balanced_parens,
                "syntax_error": "" if balanced_braces and balanced_parens else "unbalanced braces or parens",
            }
        return {"syntax_ok": True, "syntax_error": ""}

    return {"syntax_ok": False, "syntax_error": f"unknown kind {kind}"}


def structure_score(text: str, kind: str) -> tuple[int, list[str]]:
    lowered = text.lower()
    checks = []
    score = 0

    generic_markers = {
        "html": ("<html", "<head", "<body", "</html>", "<section"),
        "css": ("{", "}", "@media"),
        "javascript": ("addEventListener", "function", "=>"),
        "python": ("def ", "return"),
        "typescript": ("type ", "function", "=>", "export", "const "),
        "tsx": ("export", "function", "return", "<", ">"),
        "sql": ("create table",),
        "patch": ("diff --git", "---", "+++"),
        "json": ("{", "}", ":"),
        "markdown": ("#", "```"),
        "yaml": ("name:", "jobs:"),
        "dockerfile": ("from ", "cmd"),
        "explanation": ("problema", "corre", "porque"),
    }

    for marker in generic_markers.get(kind, ()):
        if marker.lower() in lowered:
            score += 2
            checks.append(marker)

    if "\n" in text and len(text) > 180:
        score += 2
        checks.append("multi-line substantial output")

    return score, checks


def score_output(text: str, case: EvalCase) -> dict:
    generated = generated_part(text, case.prompt)
    scored_text, used_code_block, code_block_language = normalize_for_scoring(generated, case.kind)
    lowered = scored_text.lower()
    raw_lowered = generated.lower()
    found = [term for term in case.expected_terms if term.lower() in lowered]
    banned = [
        term
        for term in case.banned_terms
        if term.lower() in raw_lowered or term.lower() in lowered
    ]
    structure, structure_checks = structure_score(scored_text, case.kind)
    syntax = syntax_metrics(scored_text, case.kind)
    repetition = repetition_metrics(scored_text)
    penalties = []

    if text.startswith(case.prompt):
        penalties.append("echoed prompt")
    if len(scored_text) < 120:
        penalties.append("too short")
    if repetition["repeated_4grams"] > 2:
        penalties.append("repetitive")
    if repetition["word_count"] > 20 and repetition["unique_ratio"] < 0.45:
        penalties.append("low lexical diversity")
    if case.kind != "html" and "<article" in lowered:
        penalties.append("mixed html into code")
    if case.kind == "html" and ("def " in lowered or "from flask" in lowered):
        penalties.append("mixed code into html")
    if not syntax["syntax_ok"] and case.kind in {"python", "json", "html", "typescript", "tsx", "javascript"}:
        penalties.append("syntax risk")

    instruction_following = round(len(found) / max(1, len(case.expected_terms)), 3)
    syntax_score = 1.0 if syntax["syntax_ok"] else 0.0
    repetition_score = max(0.0, min(1.0, repetition["unique_ratio"] - (0.08 * repetition["repeated_4grams"])))
    raw_score = len(found) * 2 + structure + (4 if syntax["syntax_ok"] else 0) - len(banned) * 4 - len(penalties) * 3

    return {
        "score": max(raw_score, 0),
        "instruction_following": instruction_following,
        "syntax_score": syntax_score,
        "repetition_score": round(repetition_score, 3),
        "found_terms": found,
        "banned_terms": banned,
        "structure_checks": structure_checks,
        "syntax": syntax,
        "repetition": repetition,
        "penalties": penalties,
        "chars": len(scored_text),
        "raw_chars": len(generated),
        "used_code_block": used_code_block,
        "code_block_language": code_block_language,
    }


def aggregate_results(results: list[dict]) -> dict:
    total = sum(item["score"]["score"] for item in results)
    count = max(1, len(results))
    compile_like = sum(1 for item in results if item["score"]["syntax"]["syntax_ok"]) / count
    return {
        "total_score": total,
        "case_count": len(results),
        "avg_score": round(total / count, 3),
        "avg_instruction_following": round(
            sum(item["score"]["instruction_following"] for item in results) / count,
            3,
        ),
        "avg_repetition_score": round(
            sum(item["score"]["repetition_score"] for item in results) / count,
            3,
        ),
        "compile_like_rate": round(compile_like, 3),
    }


def aggregate_by_category(results: list[dict]) -> dict:
    categories = sorted({item["category"] for item in results})
    output = {}
    for category in categories:
        items = [item for item in results if item["category"] == category]
        output[category] = aggregate_results(items)
    return output


def main() -> None:
    parser = argparse.ArgumentParser(description="Evaluate NexusAI generation quality.")
    parser.add_argument("--config", default=str(BASE_DIR / "configs/config.micro-instruct-fullstack.infinite.json"))
    parser.add_argument("--benchmark", default=str(DEFAULT_BENCHMARK))
    parser.add_argument("--tokens", type=int, default=180)
    parser.add_argument("--temperature", type=float, default=0.25)
    parser.add_argument("--top_k", type=int, default=30)
    parser.add_argument("--limit", type=int, default=0)
    parser.add_argument("--output_dir", default=str(BASE_DIR / "logs"))
    args = parser.parse_args()

    cases = load_cases(Path(args.benchmark))
    if args.limit:
        cases = cases[: args.limit]

    results = []
    for case in cases:
        text = run_generation(
            case.prompt,
            max_new_tokens=args.tokens,
            temperature=args.temperature,
            top_k=args.top_k,
            config_path=args.config,
            use_memory=False,
            use_instruction_template=True,
        )
        result = {
            "name": case.name,
            "category": case.category,
            "kind": case.kind,
            "prompt": case.prompt,
            "score": score_output(text, case),
            "output": text,
        }
        results.append(result)
        score = result["score"]
        print(
            f"{case.name}: score={score['score']} "
            f"follow={score['instruction_following']} syntax={score['syntax_score']} "
            f"rep={score['repetition_score']}"
        )

    payload = {
        "created_at": time.strftime("%Y-%m-%d %H:%M:%S"),
        "config": str(args.config),
        "benchmark": str(args.benchmark),
        "settings": {
            "tokens": args.tokens,
            "temperature": args.temperature,
            "top_k": args.top_k,
            "limit": args.limit,
        },
        "aggregate": aggregate_results(results),
        "by_category": aggregate_by_category(results),
        "results": results,
    }

    output_dir = Path(args.output_dir)
    output_dir.mkdir(parents=True, exist_ok=True)
    output_path = output_dir / f"generation_eval_{int(time.time())}.json"
    output_path.write_text(json.dumps(payload, indent=2, ensure_ascii=False), encoding="utf-8")
    print(f"Aggregate: {payload['aggregate']}")
    print(f"Saved evaluation to {output_path}")


if __name__ == "__main__":
    main()
