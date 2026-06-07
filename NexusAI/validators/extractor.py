"""Code extraction utilities for benchmark scoring."""

from __future__ import annotations

import re


CODE_BLOCK_RE = re.compile(r"```([A-Za-z0-9_+-]+)?[ \t]*\r?\n(.*?)```", re.DOTALL)

LANGUAGE_ALIASES = {
    "diff": {"diff", "patch"},
    "flask": {"py", "python"},
    "json": {"json"},
    "patch": {"diff", "patch"},
    "python": {"py", "python"},
}

DOMAIN_START_RE = {
    "flask": re.compile(r"(?m)^(from\s+flask\s+import|import\s+flask|app\s*=\s*Flask|\s*@app\.)"),
    "python": re.compile(r"(?m)^(from\s+\w+|import\s+\w+|def\s+\w+|class\s+\w+|@\w+)"),
    "json": re.compile(r"[\[{]"),
    "patch": re.compile(r"(?m)^(diff --git|--- |\+\+\+ |Arquivos afetados:|Problema:)"),
}


def strip_training_markers(text: str) -> str:
    cut_at = len(text)
    for marker in ("</sample>", "<sample>", "</file>", "### Instruction:", "### Response:"):
        pos = text.find(marker)
        if pos >= 0:
            cut_at = min(cut_at, pos)
    return text[:cut_at]


def extract_code(text: str, *, domain: str = "python") -> dict:
    raw = strip_training_markers(text or "").strip()
    blocks = [
        ((language or "").strip().lower(), body.strip())
        for language, body in CODE_BLOCK_RE.findall(raw)
        if body.strip()
    ]
    aliases = LANGUAGE_ALIASES.get(domain, set())
    for language, body in blocks:
        if language in aliases:
            return {"code": body, "used_block": True, "language": language, "raw": raw}
    if blocks:
        language, body = blocks[0]
        return {"code": body, "used_block": True, "language": language, "raw": raw}

    start_re = DOMAIN_START_RE.get(domain)
    if start_re:
        match = start_re.search(raw)
        if match:
            return {"code": raw[match.start() :].strip(), "used_block": False, "language": "", "raw": raw}

    # Common garbage produced by small checkpoints before the actual code.
    cleaned = re.sub(r"^\s*=\s*\[\s*", "", raw).strip()
    return {"code": cleaned, "used_block": False, "language": "", "raw": raw}


def repetition_metrics(text: str) -> dict:
    words = re.findall(r"[A-Za-z0-9_À-ÿ-]{3,}", (text or "").lower())
    if not words:
        return {"word_count": 0, "unique_ratio": 0.0, "repeated_4grams": 0, "score": 0.0}
    unique_ratio = len(set(words)) / len(words)
    grams = [" ".join(words[i : i + 4]) for i in range(max(0, len(words) - 3))]
    repeated_4grams = len(grams) - len(set(grams))
    score = max(0.0, min(1.0, unique_ratio - (0.08 * repeated_4grams)))
    return {
        "word_count": len(words),
        "unique_ratio": round(unique_ratio, 3),
        "repeated_4grams": repeated_4grams,
        "score": round(score, 3),
    }
