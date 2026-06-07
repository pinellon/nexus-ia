"""JSON validation for P0 benchmark cases."""

from __future__ import annotations

import json

from .result import BenchmarkValidation


def validate_json_code(
    code: str,
    *,
    expected_keys: list[str] | tuple[str, ...] = (),
) -> BenchmarkValidation:
    result = BenchmarkValidation(valid=True)
    try:
        parsed = json.loads(code)
        result.details["json_type"] = type(parsed).__name__
    except json.JSONDecodeError as exc:
        result.details["json_error"] = f"line {exc.lineno}: {exc.msg}"
        result.add_error("invalid_json")
        return result

    if expected_keys and isinstance(parsed, dict):
        missing = [key for key in expected_keys if key not in parsed]
        if missing:
            result.add_error(f"missing_json_keys:{','.join(missing)}")
    elif expected_keys:
        result.add_error("json_root_not_object")
    return result
