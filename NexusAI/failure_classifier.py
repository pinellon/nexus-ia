"""Failure clustering for NexusAI benchmark results."""

from __future__ import annotations

from collections import Counter


DOMAIN_MARKERS = {
    "flask": ("from flask", "jsonify", "@app.", "flask(__name__)"),
    "html": ("<html", "<body", "<section", "</div>"),
    "react": ("usestate", "usememo", "react", "tsx", "jsx"),
    "json": ('{"', "null", "true", "false"),
}


def classify_failure(case: dict, output: str, validation: dict, repetition: dict) -> list[str]:
    labels: list[str] = []
    lowered = (output or "").lower()
    errors = validation.get("errors", [])
    domain = case.get("domain", "")

    if not output.strip():
        labels.append("empty_output")
    if repetition.get("repeated_4grams", 0) > 2 or repetition.get("score", 1.0) < 0.45:
        labels.append("repetition")
    if any("syntax_error" in error for error in errors):
        labels.append("syntax_error")
    if any("invalid_json" in error for error in errors):
        labels.append("json_error")
    if any("wrong_route" in error for error in errors):
        labels.append("route_error")
    if any("wrong_method" in error for error in errors):
        labels.append("method_error")
    if any("missing_jsonify" in error or "missing_validation" in error for error in errors):
        labels.append("missing_validation")
    if any("wrong_domain" in error for error in errors):
        labels.append("wrong_domain")

    if domain == "python" and any(marker in lowered for marker in DOMAIN_MARKERS["flask"]):
        labels.append("wrong_domain")
    if domain in {"python", "flask"} and any(marker in lowered for marker in DOMAIN_MARKERS["react"]):
        labels.append("hallucinated_framework")
    if domain in {"python", "flask"} and any(marker in lowered for marker in DOMAIN_MARKERS["html"]):
        labels.append("wrong_domain")
    if domain == "json" and any(marker in lowered for marker in DOMAIN_MARKERS["flask"]):
        labels.append("wrong_domain")
    if "v1/v1" in lowered or "/api/v1/v1" in lowered:
        labels.append("wrong_route")
    if "..." in lowered or "todo" in lowered:
        labels.append("incomplete_code")

    if errors and not labels:
        labels.append("unknown")
    return sorted(set(labels))


def summarize_failure_labels(items: list[dict]) -> dict:
    counter = Counter(label for item in items for label in item.get("failure_labels", []))
    return dict(counter.most_common())
