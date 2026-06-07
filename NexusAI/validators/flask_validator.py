"""Flask validation with AST parsing and isolated test_client smoke checks."""

from __future__ import annotations

import ast
import json
import subprocess
import sys
import tempfile
import textwrap
from pathlib import Path

from .python_validator import validate_python_code
from .result import BenchmarkValidation


def _route_decorators(tree: ast.AST) -> list[dict]:
    routes: list[dict] = []
    for node in ast.walk(tree):
        if not isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef)):
            continue
        for decorator in node.decorator_list:
            if not isinstance(decorator, ast.Call):
                continue
            func = decorator.func
            if isinstance(func, ast.Attribute) and isinstance(func.value, ast.Name) and func.value.id == "app":
                method = func.attr.upper()
                route = ""
                if decorator.args and isinstance(decorator.args[0], ast.Constant):
                    route = str(decorator.args[0].value)
                if method == "ROUTE":
                    method = "GET"
                    for keyword in decorator.keywords:
                        if keyword.arg == "methods" and isinstance(keyword.value, (ast.List, ast.Tuple)):
                            values = [
                                str(item.value).upper()
                                for item in keyword.value.elts
                                if isinstance(item, ast.Constant)
                            ]
                            method = values[0] if values else "GET"
                routes.append({"function": node.name, "method": method, "route": route})
    return routes


def _run_flask_smoke(code: str, route: str, method: str) -> dict:
    helper = textwrap.dedent(
        """
        import importlib.util
        import json
        import sys
        from pathlib import Path

        module_path = Path(sys.argv[1])
        route = sys.argv[2]
        method = sys.argv[3].upper()
        spec = importlib.util.spec_from_file_location("candidate_app", module_path)
        module = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(module)
        app = getattr(module, "app", None)
        if app is None:
            print(json.dumps({"ok": False, "error": "missing app"}))
            sys.exit(0)
        client = app.test_client()
        payload = {"title": "Teste", "name": "Ana", "email": "ana@example.com", "password": "secret123"}
        if method == "GET":
            response = client.get(route)
        elif method == "POST":
            response = client.post(route, json=payload)
        elif method == "PUT":
            response = client.put(route, json=payload)
        elif method == "PATCH":
            response = client.patch(route, json=payload)
        elif method == "DELETE":
            response = client.delete(route)
        else:
            print(json.dumps({"ok": False, "error": f"unsupported method {method}"}))
            sys.exit(0)
        print(json.dumps({"ok": response.status_code < 500, "status_code": response.status_code}))
        """
    )
    with tempfile.TemporaryDirectory() as tmp:
        root = Path(tmp)
        candidate = root / "candidate_app.py"
        runner = root / "run_smoke.py"
        candidate.write_text(code, encoding="utf-8")
        runner.write_text(helper, encoding="utf-8")
        completed = subprocess.run(
            [sys.executable, str(runner), str(candidate), route, method],
            capture_output=True,
            text=True,
            timeout=8,
        )
    if completed.returncode != 0:
        return {"ok": False, "error": (completed.stderr or completed.stdout).strip()[:500]}
    try:
        return json.loads(completed.stdout.strip().splitlines()[-1])
    except (IndexError, json.JSONDecodeError):
        return {"ok": False, "error": completed.stdout.strip()[:500]}


def validate_flask_code(
    code: str,
    *,
    expected_route: str = "",
    expected_method: str = "",
    expected_terms: list[str] | tuple[str, ...] = (),
) -> BenchmarkValidation:
    result = validate_python_code(code, expected_terms=expected_terms, allow_flask=True)
    lowered = code.lower()
    if "from flask import" not in lowered and "import flask" not in lowered:
        result.add_error("missing_flask_import")
    if "flask(__name__)" not in lowered:
        result.add_error("missing_flask_app")
    if "jsonify" not in lowered:
        result.add_error("missing_jsonify")

    if not result.details.get("ast_pass"):
        return result

    tree = ast.parse(code)
    routes = _route_decorators(tree)
    result.details["routes"] = routes
    if expected_route and expected_route not in [item["route"] for item in routes]:
        result.add_error(f"wrong_route:{expected_route}")
    if expected_method:
        expected_method = expected_method.upper()
        route_methods = [item["method"] for item in routes if not expected_route or item["route"] == expected_route]
        if expected_method not in route_methods:
            result.add_error(f"wrong_method:{expected_method}")

    if expected_route and expected_method and not any(error.startswith(("wrong_route", "wrong_method")) for error in result.errors):
        smoke = _run_flask_smoke(code, expected_route, expected_method)
        result.details["flask_smoke"] = smoke
        if not smoke.get("ok"):
            result.add_error(f"flask_smoke_failed:{smoke.get('error', 'unknown')}")

    return result
