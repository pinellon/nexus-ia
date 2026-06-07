"""Lightweight semantic checks for NexusAI real-task smoke suites."""

from __future__ import annotations

import json
import re
from dataclasses import dataclass, field


@dataclass
class SemanticResult:
    semantic_pass: bool
    generic_fallback: bool = False
    errors: list[str] = field(default_factory=list)

    def add_error(self, message: str) -> None:
        self.semantic_pass = False
        self.errors.append(message)


GENERIC_MARKERS = (
    "conteudo gerado pelo assistente",
    "componente gerado pelo assistente",
)


def normalize(text: str) -> str:
    return text.lower()


def contains_any(text: str, terms: list[str]) -> bool:
    lowered = normalize(text)
    return any(term.lower() in lowered for term in terms)


def check_expected_terms(text: str, terms: list[str], result: SemanticResult) -> None:
    lowered = normalize(text)
    for term in terms:
        if term.lower() not in lowered:
            result.add_error(f"missing semantic term: {term}")


def infer_prompt_terms(task: dict) -> list[str]:
    prompt = normalize(task.get("prompt", ""))
    terms: list[str] = []
    keyword_map = {
        "depoimento": "depoimentos",
        "header": "header",
        "navbar": "nav",
        "botao": "button",
        "botão": "button",
        "form": "form",
        "card": "card",
        "produto": "product",
        "product": "product",
        "email": "email",
        "health": "health",
        "cliente": "cliente",
        "clientes": "cliente",
        "soma": "soma",
        "media": "media",
        "média": "media",
        "reverse": "reverse",
        "inverter": "invert",
        "factorial": "factorial",
    }
    for key, term in keyword_map.items():
        if key in prompt:
            terms.append(term)
    return terms


def check_python(task: dict, text: str) -> SemanticResult:
    result = SemanticResult(semantic_pass=True)
    lowered = normalize(text)
    for name in task.get("expected_functions", []):
        if re.search(rf"\bdef\s+{re.escape(name)}\b", text) is None:
            result.add_error(f"missing function: {name}")
    if not task.get("allow_flask") and "flask" in lowered:
        result.add_error("unexpected Flask in pure Python task")
    if "soma" in normalize(task.get("prompt", "")) and "+" not in text:
        result.add_error("sum task missing addition")
    if ("inverter" in normalize(task.get("prompt", "")) or "reverse" in lowered) and "[::-1]" not in text:
        result.add_error("reverse task missing slicing")
    return result


def check_flask(task: dict, text: str) -> SemanticResult:
    result = SemanticResult(semantic_pass=True)
    lowered = normalize(text)
    route = task.get("expected_route")
    if route and route not in text:
        result.add_error(f"missing route: {route}")
    method = task.get("expected_method")
    if method and method.upper() not in text.upper():
        result.add_error(f"missing method: {method}")
    if task.get("expects_json", True) and "jsonify" not in lowered:
        result.add_error("missing jsonify")
    for field_name in task.get("expected_fields", []):
        if field_name.lower() not in lowered:
            result.add_error(f"missing field: {field_name}")
    if route and route != "/health" and "/health" in text and route not in text:
        result.add_error("generic /health route used for different route")
    return result


def check_html(task: dict, text: str) -> SemanticResult:
    result = SemanticResult(semantic_pass=True)
    lowered = normalize(text)
    check_expected_terms(text, task.get("expected_terms", []) or infer_prompt_terms(task), result)
    for element in task.get("expected_elements", []):
        element = element.lower()
        if element == "button" and "<button" not in lowered:
            result.add_error("missing button element")
        elif element == "form" and "<form" not in lowered:
            result.add_error("missing form element")
        elif element == "nav" and "<nav" not in lowered:
            result.add_error("missing nav element")
        elif element == "card" and "card" not in lowered and "<article" not in lowered:
            result.add_error("missing card/article element")
        elif element not in {"button", "form", "nav", "card"} and f"<{element}" not in lowered:
            result.add_error(f"missing html element: {element}")
    if contains_any(text, list(GENERIC_MARKERS)) and not result.errors:
        result.generic_fallback = not bool(task.get("allow_generic_fallback", False))
        if result.generic_fallback:
            result.add_error("generic fallback content")
    return result


def check_json(task: dict, text: str) -> SemanticResult:
    result = SemanticResult(semantic_pass=True)
    try:
        data = json.loads(text)
    except json.JSONDecodeError as exc:
        return SemanticResult(semantic_pass=False, errors=[f"invalid json during semantic check: {exc}"])
    expected_fields = task.get("expected_fields", [])
    if isinstance(data, dict):
        for field_name in expected_fields:
            if field_name not in data:
                result.add_error(f"missing json field: {field_name}")
        if set(data.keys()) == {"status"} and expected_fields:
            result.generic_fallback = True
            result.add_error("generic status-only JSON")
    else:
        result.add_error("JSON root is not an object")
    return result


def check_react(task: dict, text: str) -> SemanticResult:
    result = SemanticResult(semantic_pass=True)
    lowered = normalize(text)
    component_name = task.get("expected_component")
    if component_name and component_name.lower() not in lowered:
        result.add_error(f"missing component: {component_name}")
    check_expected_terms(text, task.get("expected_terms", []) or infer_prompt_terms(task), result)
    for element in task.get("expected_elements", []):
        if element == "button" and "<button" not in lowered:
            result.add_error("missing button element")
        elif element == "form" and "<form" not in lowered:
            result.add_error("missing form element")
        elif element == "list" and "<ul" not in lowered and ".map(" not in lowered:
            result.add_error("missing list rendering")
    if contains_any(text, list(GENERIC_MARKERS)) and not result.errors:
        result.generic_fallback = not bool(task.get("allow_generic_fallback", False))
        if result.generic_fallback:
            result.add_error("generic fallback component")
    return result


def check_patch_review(task: dict, text: str) -> SemanticResult:
    result = SemanticResult(semantic_pass=True)
    check_expected_terms(text, task.get("expected_terms", []) or infer_prompt_terms(task), result)
    return result


def check_semantics(task: dict, text: str) -> SemanticResult:
    task_type = task.get("task_type", "")
    if task_type == "flask_api":
        return check_flask(task, text)
    if task_type == "site_html":
        return check_html(task, text)
    if task_type == "json":
        return check_json(task, text)
    if task_type == "react_component":
        return check_react(task, text)
    if task_type == "patch_review":
        return check_patch_review(task, text)
    if task_type == "bugfix":
        return check_python(task, text)
    return SemanticResult(semantic_pass=True)
