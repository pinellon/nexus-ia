"""Project-level benchmark for NexusAI repo mode."""

from __future__ import annotations

import argparse
import json
import tempfile
import time
from pathlib import Path

from repo_mode import build_repo_context, run_repo_task
from test_runner import run_project_tests


BASE_DIR = Path(__file__).parent
BENCH_DIR = Path(tempfile.gettempdir()) / "nexusai_repo_benchmark_projects"
LOG_DIR = BASE_DIR / "logs"


FIXTURES = [
    {
        "id": "landing_page",
        "task": "adicione uma secao de depoimentos na landing page",
        "files": {
            "index.html": "<!DOCTYPE html><html><head><title>Studio</title><link rel='stylesheet' href='style.css'></head><body><main><h1>Studio Nexus</h1></main></body></html>",
            "style.css": "body { font-family: Arial, sans-serif; margin: 0; } main { padding: 32px; }\n",
        },
        "expected_files": ["index.html", "style.css"],
    },
    {
        "id": "flask_api",
        "task": "adicione CRUD simples de clientes com nome email telefone",
        "files": {
            "app.py": "from flask import Flask, jsonify, request\napp = Flask(__name__)\nclientes = []\n@app.route('/health')\ndef health():\n    return jsonify({'ok': True})\n",
            "requirements.txt": "flask\n",
        },
        "expected_files": ["app.py", "requirements.txt"],
    },
    {
        "id": "react_app",
        "task": "crie um modal de produto no app react",
        "files": {
            "package.json": "{\"scripts\":{\"build\":\"echo build-ok\"},\"dependencies\":{\"react\":\"latest\"},\"devDependencies\":{}}",
            "src/App.tsx": "export default function App() { return <main><h1>Produtos</h1></main>; }\n",
        },
        "expected_files": ["src/App.tsx", "package.json"],
    },
    {
        "id": "electron_app",
        "task": "adicione menu e tela de configuracoes mantendo electron seguro",
        "files": {
            "package.json": "{\"scripts\":{\"build\":\"echo build-ok\"},\"dependencies\":{\"electron\":\"latest\"}}",
            "src/main.ts": "const win = new BrowserWindow({ webPreferences: { contextIsolation: true, nodeIntegration: false, preload: 'preload.js' } });\n",
            "src/preload.ts": "window.addEventListener('DOMContentLoaded', () => {});\n",
        },
        "expected_files": ["src/main.ts", "src/preload.ts", "package.json"],
    },
    {
        "id": "broken_python",
        "task": "encontre e corrija o bug de sintaxe",
        "files": {
            "app.py": "def soma(a, b)\n    return a + b\n",
            "README.md": "# Broken app\n",
        },
        "expected_files": ["app.py"],
        "expect_tests_ok": False,
    },
]


def write_fixture(root: Path, fixture: dict) -> Path:
    project = root / fixture["id"]
    project.mkdir(parents=True, exist_ok=True)
    for rel, content in fixture["files"].items():
        path = project / rel
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(content, encoding="utf-8")
    return project


def ensure_fixtures(root: Path = BENCH_DIR) -> list[dict]:
    root.mkdir(parents=True, exist_ok=True)
    projects = []
    for fixture in FIXTURES:
        project_dir = write_fixture(root, fixture)
        item = dict(fixture)
        item["project_dir"] = str(project_dir)
        projects.append(item)
    return projects


def score_context(selected: list[str], expected: list[str]) -> dict:
    expected_set = set(expected)
    selected_set = set(selected)
    hits = sorted(expected_set & selected_set)
    missing = sorted(expected_set - selected_set)
    return {
        "hits": hits,
        "missing": missing,
        "score": round(len(hits) / max(1, len(expected_set)), 3),
    }


def run_repo_benchmark(
    *,
    with_model: bool = False,
    config: str = "",
    retries: int = 0,
    bench_dir: str | Path = BENCH_DIR,
) -> dict:
    projects = ensure_fixtures(Path(bench_dir))
    cases = []
    for fixture in projects:
        context = build_repo_context(fixture["project_dir"], fixture["task"])
        tests = run_project_tests(fixture["project_dir"])
        context_score = score_context(context["selected_files"], fixture["expected_files"])
        case = {
            "id": fixture["id"],
            "project_dir": fixture["project_dir"],
            "task": fixture["task"],
            "stack": context["index"].get("stack", []),
            "selected_files": context["selected_files"],
            "expected_files": fixture["expected_files"],
            "context_score": context_score,
            "tests_ok": tests["ok"],
            "test_commands": tests["commands"],
        }
        if with_model:
            case["repo_task"] = run_repo_task(
                fixture["project_dir"],
                fixture["task"],
                config=config or str(BASE_DIR / "config.micro-instruct-fullstack.behavior.json"),
                retries=retries,
                use_memory=False,
            )
        cases.append(case)

    aggregate = {
        "case_count": len(cases),
        "avg_context_score": round(sum(item["context_score"]["score"] for item in cases) / max(1, len(cases)), 3),
        "tests_ok_count": sum(1 for item in cases if item["tests_ok"]),
        "with_model": with_model,
    }
    return {"generated_at": time.strftime("%Y-%m-%d %H:%M:%S"), "aggregate": aggregate, "cases": cases}


def write_report(payload: dict) -> tuple[Path, Path]:
    LOG_DIR.mkdir(parents=True, exist_ok=True)
    stamp = int(time.time())
    json_path = LOG_DIR / f"repo_benchmark_{stamp}.json"
    md_path = LOG_DIR / f"repo_benchmark_{stamp}.md"
    json_path.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")
    lines = [
        "# NexusAI Repo Benchmark",
        "",
        f"Generated at: {payload['generated_at']}",
        "",
        "## Aggregate",
        "",
    ]
    for key, value in payload["aggregate"].items():
        lines.append(f"- {key}: `{value}`")
    lines.extend(["", "## Cases", ""])
    for case in payload["cases"]:
        lines.extend(
            [
                f"### {case['id']}",
                "",
                f"- Task: {case['task']}",
                f"- Stack: `{case['stack']}`",
                f"- Selected: `{case['selected_files']}`",
                f"- Expected: `{case['expected_files']}`",
                f"- Context score: `{case['context_score']['score']}`",
                f"- Missing: `{case['context_score']['missing']}`",
                f"- Tests ok: `{case['tests_ok']}`",
                "",
            ]
        )
    md_path.write_text("\n".join(lines), encoding="utf-8")
    return json_path, md_path


def main() -> None:
    parser = argparse.ArgumentParser(description="Run project-level NexusAI repo benchmark.")
    parser.add_argument("--with_model", action="store_true")
    parser.add_argument("--config", default=str(BASE_DIR / "config.micro-instruct-fullstack.behavior.json"))
    parser.add_argument("--retries", type=int, default=0)
    parser.add_argument("--bench_dir", default=str(BENCH_DIR))
    args = parser.parse_args()
    payload = run_repo_benchmark(
        with_model=args.with_model,
        config=args.config,
        retries=args.retries,
        bench_dir=args.bench_dir,
    )
    json_path, md_path = write_report(payload)
    print(f"JSON: {json_path}")
    print(f"Report: {md_path}")
    print(json.dumps(payload["aggregate"], ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
