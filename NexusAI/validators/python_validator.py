"""Real Python validation for P0 benchmark cases."""

from __future__ import annotations

import ast

from .result import BenchmarkValidation


WRONG_DOMAIN_TERMS = {
    "html": ("<html", "<body", "</div>", "<section"),
    "react": ("usestate", "usememo", "jsx", "tsx", "react"),
    "flask": ("from flask import", "jsonify", "@app.", "flask(__name__)"),
}


def _defined_names(tree: ast.AST) -> set[str]:
    names: set[str] = set()
    for node in ast.walk(tree):
        if isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef, ast.ClassDef)):
            names.add(node.name)
    return names


def validate_python_code(
    code: str,
    *,
    expected_function: str = "",
    expected_terms: list[str] | tuple[str, ...] = (),
    allow_flask: bool = False,
) -> BenchmarkValidation:
    result = BenchmarkValidation(valid=True)
    lowered = code.lower()
    for marker in ("...", "todo", "your code here", "<sample>", "</sample>", "</file>"):
        if marker in lowered:
            result.add_error(f"placeholder_or_marker:{marker}")

    for domain, terms in WRONG_DOMAIN_TERMS.items():
        if domain == "flask" and allow_flask:
            continue
        if any(term in lowered for term in terms):
            result.add_error(f"wrong_domain:{domain}")

    try:
        tree = ast.parse(code)
        result.details["ast_pass"] = True
        result.details["defined_names"] = sorted(_defined_names(tree))
    except SyntaxError as exc:
        result.details["ast_pass"] = False
        result.details["syntax_error"] = f"line {exc.lineno}: {exc.msg}"
        result.add_error("syntax_error")
        return result

    if expected_function and expected_function not in result.details["defined_names"]:
        result.add_error(f"missing_function:{expected_function}")

    missing_terms = [term for term in expected_terms if term.lower() not in lowered]
    if missing_terms:
        result.add_warning(f"missing_terms:{','.join(missing_terms[:5])}")
    result.details["missing_terms"] = missing_terms
    return result
