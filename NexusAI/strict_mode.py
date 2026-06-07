"""Strict reliability checks for NexusAI outputs and repo operations."""

from __future__ import annotations

from dataclasses import dataclass, field


PLACEHOLDER_MARKERS = ("...", "TODO", "pass  #", "your code here", "implemente aqui")
TRAINING_MARKERS = ("<sample>", "</sample>", "</file>", "### instruction:", "### response:")


@dataclass
class StrictResult:
    ok: bool
    errors: list[str] = field(default_factory=list)
    warnings: list[str] = field(default_factory=list)


def strict_check_text(text: str, *, require_plan: bool = False) -> StrictResult:
    result = StrictResult(ok=True)
    lowered = text.lower()
    for marker in TRAINING_MARKERS:
        if marker in lowered:
            result.ok = False
            result.errors.append(f"training marker leaked: {marker}")
    for marker in PLACEHOLDER_MARKERS:
        if marker.lower() in lowered:
            result.ok = False
            result.errors.append(f"placeholder found: {marker}")
    if require_plan:
        plan_terms = {
            "arquivos afetados": ("arquivos afetados",),
            "problema": ("problema",),
            "mudança proposta": ("mudança proposta", "mudanca proposta", "patch proposto"),
            "risco": ("risco",),
            "como testar": ("como testar",),
        }
        for label, aliases in plan_terms.items():
            if not any(alias in lowered for alias in aliases):
                result.ok = False
                result.errors.append(f"missing strict plan section: {label}")
    return result


def strict_check_operation(
    *,
    approved: bool,
    tests_ok: bool | None = None,
    adds_dependencies: bool = False,
    allow_dependencies: bool = False,
) -> StrictResult:
    result = StrictResult(ok=True)
    if not approved:
        result.ok = False
        result.errors.append("approval required")
    if adds_dependencies and not allow_dependencies:
        result.ok = False
        result.errors.append("new dependency requires approval")
    if tests_ok is False:
        result.ok = False
        result.errors.append("tests failed")
    return result
