"""Validation utilities for controlled NexusAI output."""

from __future__ import annotations

import ast
import json
import re
from dataclasses import dataclass, field
from html.parser import HTMLParser


@dataclass
class ValidationResult:
    valid: bool
    errors: list[str] = field(default_factory=list)
    warnings: list[str] = field(default_factory=list)

    def add_error(self, message: str) -> None:
        self.valid = False
        self.errors.append(message)


class HTMLBalanceParser(HTMLParser):
    def __init__(self) -> None:
        super().__init__()
        self.stack: list[str] = []
        self.errors: list[str] = []

    def handle_starttag(self, tag: str, attrs) -> None:
        if tag not in {"meta", "link", "img", "input", "br", "hr"}:
            self.stack.append(tag)

    def handle_endtag(self, tag: str) -> None:
        if tag in {"meta", "link", "img", "input", "br", "hr"}:
            return
        if tag in self.stack[::-1]:
            index = len(self.stack) - 1 - self.stack[::-1].index(tag)
            del self.stack[index]
        else:
            self.errors.append(f"unexpected closing tag: {tag}")


def common_checks(text: str, result: ValidationResult) -> None:
    lowered = text.lower()
    for marker in ("<sample>", "</sample>", "</file>", "### instruction:", "### response:"):
        if marker in lowered:
            result.add_error(f"dataset marker leaked: {marker}")
    for marker in ("...", "your code here", "implemente aqui"):
        if marker in lowered:
            result.add_error(f"placeholder found: {marker}")
    if re.search(r"\bTODO\b", text):
        result.add_error("placeholder found: TODO")


def validate_html(text: str) -> ValidationResult:
    result = ValidationResult(valid=True)
    common_checks(text, result)
    lowered = text.lower()
    for marker in ("<!doctype html", "<html", "<head", "<body", "</html>"):
        if marker not in lowered:
            result.add_error(f"missing {marker}")
    if "from flask" in lowered or "def " in lowered:
        result.add_error("python mixed into html")
    parser = HTMLBalanceParser()
    try:
        parser.feed(text)
    except Exception as exc:
        result.add_error(f"html parser error: {exc}")
    for error in parser.errors[:5]:
        result.add_error(error)
    return result


def validate_python(text: str, *, require_flask: bool = False) -> ValidationResult:
    result = ValidationResult(valid=True)
    common_checks(text, result)
    try:
        ast.parse(text)
    except SyntaxError as exc:
        result.add_error(f"python syntax error line {exc.lineno}: {exc.msg}")
    lowered = text.lower()
    if require_flask:
        if "from flask import" not in lowered and "import flask" not in lowered:
            result.add_error("missing Flask import")
        if "flask(__name__)" not in lowered:
            result.add_error("missing app = Flask(__name__)")
        if "@app." not in lowered and "@app.route" not in lowered:
            result.add_error("missing Flask route decorator")
        if "jsonify" not in lowered:
            result.add_error("missing jsonify response")
    if "<article" in lowered or "</div>" in lowered:
        result.add_error("html mixed into python")
    return result


def validate_typescript(text: str, *, electron: bool = False, react: bool = False) -> ValidationResult:
    result = ValidationResult(valid=True)
    common_checks(text, result)
    if text.count("{") != text.count("}"):
        result.add_error("unbalanced braces")
    if text.count("(") != text.count(")"):
        result.add_error("unbalanced parentheses")
    lowered = text.lower()
    if electron:
        if "contextisolation" not in lowered or "true" not in lowered:
            result.add_error("missing contextIsolation true")
        if "nodeintegration" not in lowered or "false" not in lowered:
            result.add_error("missing nodeIntegration false")
        if "preload" not in lowered:
            result.add_error("missing preload")
    if react:
        if "export default" not in lowered:
            result.add_error("missing export default")
        if "return" not in lowered:
            result.add_error("missing return")
        if "<" not in text or ">" not in text:
            result.add_error("missing JSX")
    if "from flask" in lowered:
        result.add_error("python/flask mixed into typescript")
    return result


def looks_like_html_task(prompt: str) -> bool:
    lowered = prompt.lower()
    return any(term in lowered for term in ("landing page", "site", "html", "index.html", "página", "pagina"))


def extract_user_request(prompt: str) -> str:
    marker = "PEDIDO_DO_USUARIO:"
    if marker in prompt:
        return prompt.split(marker, 1)[1].strip()
    return prompt.strip()


def prompt_requires_python_function(prompt: str) -> bool:
    lowered = extract_user_request(prompt).lower()
    return any(term in lowered for term in ("funcao", "função", "app.py", "soma", "somar", "media", "inverter", "filtrar", "multiplicar"))


def validate_patch_review(text: str, *, original_prompt: str = "") -> ValidationResult:
    result = ValidationResult(valid=True)
    common_checks(text, result)
    lowered = text.lower()
    required_sections = {
        "arquivos afetados": ("arquivos afetados",),
        "problema": ("problema",),
        "mudança proposta": ("mudança proposta", "mudanca proposta", "patch proposto"),
        "risco": ("risco",),
        "como testar": ("como testar",),
    }
    for label, aliases in required_sections.items():
        if not any(alias in lowered for alias in aliases):
            result.add_error(f"missing patch review section: {label}")
    if looks_like_html_task(original_prompt):
        for marker in ("<!doctype html", "<html", "<body", "</html>"):
            if marker not in lowered:
                result.add_error(f"missing html marker for landing page: {marker}")
    return result


def validate_json(text: str) -> ValidationResult:
    result = ValidationResult(valid=True)
    common_checks(text, result)
    try:
        json.loads(text)
    except json.JSONDecodeError as exc:
        result.add_error(f"json syntax error line {exc.lineno}: {exc.msg}")
    return result


def validate_output(task_type: str, text: str, *, original_prompt: str = "") -> ValidationResult:
    if task_type == "site_html":
        return validate_html(text)
    if task_type == "flask_api":
        return validate_python(text, require_flask=True)
    if task_type == "react_component":
        return validate_typescript(text, react=True)
    if task_type == "electron_app":
        return validate_typescript(text, electron=True)
    if task_type == "json":
        return validate_json(text)
    if task_type == "patch_review":
        return validate_patch_review(text, original_prompt=original_prompt)
    if task_type == "bugfix":
        if re.search(r"\bdef\s+\w+", text):
            return validate_python(text)
        if prompt_requires_python_function(original_prompt):
            return ValidationResult(valid=False, errors=["missing Python function"])
        return ValidationResult(valid=True)
    return ValidationResult(valid=True)
