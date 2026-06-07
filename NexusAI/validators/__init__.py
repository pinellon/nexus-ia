"""Benchmark validators plus compatibility exports for legacy validators.py.

The project already had a sibling ``validators.py`` module. This package exists
for the P0 benchmark validators while still preserving old imports such as
``from validators import validate_output`` when scripts run from ``NexusAI/``.
"""

from __future__ import annotations

import importlib.util
import sys
from pathlib import Path


_LEGACY_PATH = Path(__file__).resolve().parent.parent / "validators.py"
_spec = importlib.util.spec_from_file_location("_nexusai_legacy_validators", _LEGACY_PATH)
if _spec and _spec.loader:
    _legacy = importlib.util.module_from_spec(_spec)
    sys.modules[_spec.name] = _legacy
    _spec.loader.exec_module(_legacy)
    ValidationResult = _legacy.ValidationResult
    validate_html = _legacy.validate_html
    validate_python = _legacy.validate_python
    validate_typescript = _legacy.validate_typescript
    validate_patch_review = _legacy.validate_patch_review
    validate_json = _legacy.validate_json
    validate_output = _legacy.validate_output
    looks_like_html_task = _legacy.looks_like_html_task


__all__ = [
    "ValidationResult",
    "looks_like_html_task",
    "validate_html",
    "validate_json",
    "validate_output",
    "validate_patch_review",
    "validate_python",
    "validate_typescript",
]
