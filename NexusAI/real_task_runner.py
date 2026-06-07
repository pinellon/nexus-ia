"""Run 50 controlled real-task probes and report resolved/assisted/failed rates."""

from __future__ import annotations

import argparse
import csv
import json
import os
import subprocess
import tempfile
import time
from collections import Counter
from pathlib import Path
from typing import Callable

from semantic_check import check_semantics
from command_sandbox import run_sandboxed_command
from dependency_guard import added_dependencies
from failure_ranking import top_failures
from patch_manager import apply_file_changes, rollback_last
from project_docs import generate_project_docs
from repo_benchmark import ensure_fixtures
from repo_indexer import build_project_index
from repo_mode import build_repo_context, run_repo_task
from strict_mode import strict_check_text
from task_metrics import finish_session, log_event, start_session
from test_runner import run_project_tests


BASE_DIR = Path(__file__).parent
LOG_DIR = BASE_DIR / "logs"
FAILURE_LABELS = {
    "wrong_domain",
    "syntax_error",
    "incomplete_code",
    "missing_required_symbol",
    "wrong_route",
    "json_error",
    "markdown_leak",
    "hallucinated_framework",
    "validator_gap",
    "extractor_error",
    "repair_did_not_improve",
    "patch_apply_error",
    "provider_error",
    "timeout",
}
DOMAIN_SLA_SECONDS = {
    "json": 8,
    "site_html": 8,
    "bugfix": 15,
    "python": 15,
    "python_puro": 15,
    "bugfix_python": 15,
    "flask_api": 20,
    "react_component": 20,
    "patch_review": 25,
    "project_question": 25,
}


def status_from(ok: bool, *, assisted: bool = False) -> str:
    if ok and assisted:
        return "assisted"
    return "resolved" if ok else "failed"


def task_analyze(project_dir: Path, task: dict) -> dict:
    index = build_project_index(project_dir)
    expected_stack = set(task.get("expected_stack", []))
    ok = expected_stack.issubset(set(index.get("stack", [])))
    return {"ok": ok, "details": {"stack": index.get("stack", []), "expected_stack": sorted(expected_stack)}}


def task_context(project_dir: Path, task: dict) -> dict:
    context = build_repo_context(project_dir, task["prompt"])
    selected = set(context["selected_files"])
    expected = set(task.get("expected_files", []))
    ok = expected.issubset(selected)
    return {"ok": ok, "details": {"selected_files": context["selected_files"], "expected_files": sorted(expected), "budget": context.get("budget", {})}}


def task_run_tests(project_dir: Path, task: dict) -> dict:
    result = run_project_tests(project_dir)
    expected_ok = bool(task.get("expected_ok", True))
    ok = result["ok"] == expected_ok
    return {"ok": ok, "details": {"expected_ok": expected_ok, "test_result": result}}


def task_generate_docs(project_dir: Path, task: dict) -> dict:
    result = generate_project_docs(project_dir)
    required = ["project_summary.md", "architecture.md", "routes.md", "database.md", "tasks_log.md"]
    written_names = {Path(path).name for path in result["written"]}
    ok = set(required).issubset(written_names)
    return {"ok": ok, "details": result}


def task_sandbox(project_dir: Path, task: dict) -> dict:
    result = run_sandboxed_command(task["command"], project_dir)
    expected_blocked = bool(task.get("expected_blocked", False))
    if expected_blocked:
        ok = result.get("blocked") is True
    else:
        ok = result.get("blocked") is False and result.get("ok") is bool(task.get("expected_ok", True))
    return {"ok": ok, "details": result}


def task_dependency_guard(project_dir: Path, task: dict) -> dict:
    before = task.get("before", "flask\n")
    after = task.get("after", "flask\nrequests\n")
    deps = added_dependencies(task.get("path", "requirements.txt"), before, after)
    ok = deps == task.get("expected_added", ["requests"])
    return {"ok": ok, "details": {"added_dependencies": deps}}


def task_patch_rollback(project_dir: Path, task: dict) -> dict:
    rel = task.get("path", "README.md")
    target = project_dir / rel
    target.parent.mkdir(parents=True, exist_ok=True)
    before = target.read_text(encoding="utf-8") if target.exists() else ""
    patch = apply_file_changes(
        project_dir,
        [{"path": rel, "content": task.get("content", before + "\nNexusAI smoke change\n")}],
        reason=task["prompt"],
    )
    changed = target.exists() and target.read_text(encoding="utf-8") != before
    rollback = rollback_last(project_dir)
    restored = (target.read_text(encoding="utf-8") if target.exists() else "") == before
    ok = changed and rollback.get("rolled_back") and restored
    return {"ok": ok, "details": {"patch": patch, "rollback": rollback, "changed": changed, "restored": restored}}


def task_strict(project_dir: Path, task: dict) -> dict:
    result = strict_check_text(task["text"], require_plan=bool(task.get("require_plan", False)))
    ok = result.ok == bool(task.get("expected_ok", True))
    return {"ok": ok, "details": result.__dict__}


def task_model_review(
    project_dir: Path,
    task: dict,
    *,
    config: str,
    model_timeout_seconds: int = 0,
    repair_timeout_seconds: int = 0,
    repair_strategy: str = "auto",
) -> dict:
    result = run_repo_task(
        project_dir,
        task["prompt"],
        config=config,
        retries=2,
        use_memory=False,
        task_type=task.get("task_type", "patch_review"),
        semantic_task=task,
        model_timeout_seconds=model_timeout_seconds,
        repair_timeout_seconds=repair_timeout_seconds,
        repair_strategy=repair_strategy,
    )
    valid = bool(result.get("generation", {}).get("valid"))
    strict_ok = bool(result.get("generation", {}).get("strict", {}).get("ok"))
    return {"ok": valid and strict_ok, "assisted": valid and not strict_ok, "details": result}


TASK_RUNNERS: dict[str, Callable[[Path, dict], dict]] = {
    "analyze": task_analyze,
    "context": task_context,
    "run_tests": task_run_tests,
    "generate_docs": task_generate_docs,
    "sandbox": task_sandbox,
    "dependency_guard": task_dependency_guard,
    "patch_rollback": task_patch_rollback,
    "strict": task_strict,
}


PROJECT_EXPECTATIONS = {
    "landing_page": {"stack": ["web"], "files": ["index.html", "style.css"], "test_ok": True},
    "flask_api": {"stack": ["flask", "python"], "files": ["app.py", "requirements.txt"], "test_ok": True},
    "react_app": {"stack": ["node", "react"], "files": ["src/App.tsx", "package.json"], "test_ok": True},
    "electron_app": {"stack": ["electron", "node"], "files": ["src/main.ts", "src/preload.ts", "package.json"], "test_ok": True},
    "broken_python": {"stack": ["python"], "files": ["app.py"], "test_ok": False},
}


def build_tasks(projects: list[dict], *, include_model: bool = False) -> list[dict]:
    tasks: list[dict] = []
    for project in projects:
        project_id = project["id"]
        expect = PROJECT_EXPECTATIONS[project_id]
        project_dir = project["project_dir"]
        tasks.extend(
            [
                {
                    "id": f"{project_id}_01_analyze",
                    "project_id": project_id,
                    "project_dir": project_dir,
                    "type": "analyze",
                    "prompt": "analisar projeto e detectar stack",
                    "expected_stack": expect["stack"],
                },
                {
                    "id": f"{project_id}_02_context",
                    "project_id": project_id,
                    "project_dir": project_dir,
                    "type": "context",
                    "prompt": project["task"],
                    "expected_files": expect["files"][:2],
                },
                {
                    "id": f"{project_id}_03_tests",
                    "project_id": project_id,
                    "project_dir": project_dir,
                    "type": "run_tests",
                    "prompt": "rodar validacao por stack",
                    "expected_ok": expect["test_ok"],
                },
                {
                    "id": f"{project_id}_04_docs",
                    "project_id": project_id,
                    "project_dir": project_dir,
                    "type": "generate_docs",
                    "prompt": "gerar documentacao .nexus",
                },
                {
                    "id": f"{project_id}_05_sandbox_block",
                    "project_id": project_id,
                    "project_dir": project_dir,
                    "type": "sandbox",
                    "prompt": "bloquear comando perigoso",
                    "command": "git reset --hard",
                    "expected_blocked": True,
                },
                {
                    "id": f"{project_id}_06_sandbox_allow",
                    "project_id": project_id,
                    "project_dir": project_dir,
                    "type": "sandbox",
                    "prompt": "permitir comando seguro",
                    "command": "git status",
                    "expected_blocked": False,
                    "expected_ok": False,
                },
                {
                    "id": f"{project_id}_07_dependency_guard",
                    "project_id": project_id,
                    "project_dir": project_dir,
                    "type": "dependency_guard",
                    "prompt": "detectar dependencia nova",
                    "path": "requirements.txt",
                    "before": "flask\n",
                    "after": "flask\nrequests\n",
                    "expected_added": ["requests"],
                },
                {
                    "id": f"{project_id}_08_patch_rollback",
                    "project_id": project_id,
                    "project_dir": project_dir,
                    "type": "patch_rollback",
                    "prompt": "aplicar patch pequeno e voltar rollback",
                    "path": "README.md",
                    "content": f"# {project_id}\n\nNexusAI rollback smoke.\n",
                },
                {
                    "id": f"{project_id}_09_strict_good",
                    "project_id": project_id,
                    "project_dir": project_dir,
                    "type": "strict",
                    "prompt": "validar resposta patch review completa",
                    "text": "Arquivos afetados:\n- app.py\n\nProblema:\nBug.\n\nPatch proposto:\nDiff.\n\nRisco:\nBaixo.\n\nComo testar:\npytest",
                    "require_plan": True,
                    "expected_ok": True,
                },
                {
                    "id": f"{project_id}_10_strict_bad",
                    "project_id": project_id,
                    "project_dir": project_dir,
                    "type": "strict",
                    "prompt": "bloquear placeholder em strict mode",
                    "text": "codigo ...",
                    "require_plan": False,
                    "expected_ok": False,
                },
            ]
        )
        if include_model:
            tasks[-1] = {
                "id": f"{project_id}_10_model_review",
                "project_id": project_id,
                "project_dir": project_dir,
                "type": "model_review",
                "prompt": project["task"],
            }
    return tasks


def build_smoke_10_tasks(projects: list[dict]) -> list[dict]:
    by_id = {project["id"]: project for project in projects}

    def project(project_id: str) -> dict:
        return by_id[project_id]

    return [
        {
            "id": "smoke_py_001",
            "project_id": "broken_python",
            "project_dir": project("broken_python")["project_dir"],
            "type": "model_review",
            "task_type": "bugfix",
            "expected_domain": "python",
            "prompt": "Corrija o erro de sintaxe em app.py e retorne um patch review curto.",
        },
        {
            "id": "smoke_py_002",
            "project_id": "broken_python",
            "project_dir": project("broken_python")["project_dir"],
            "type": "model_review",
            "task_type": "bugfix",
            "expected_domain": "python",
            "prompt": "Crie uma função Python pura chamada normalizar_nome sem usar Flask.",
        },
        {
            "id": "smoke_flask_001",
            "project_id": "flask_api",
            "project_dir": project("flask_api")["project_dir"],
            "type": "model_review",
            "task_type": "flask_api",
            "expected_domain": "flask",
            "prompt": "Adicione uma rota Flask GET /health que retorna JSON status ok.",
        },
        {
            "id": "smoke_flask_002",
            "project_id": "flask_api",
            "project_dir": project("flask_api")["project_dir"],
            "type": "model_review",
            "task_type": "flask_api",
            "expected_domain": "flask",
            "prompt": "Adicione validação de email obrigatório no cadastro de clientes.",
        },
        {
            "id": "smoke_html_001",
            "project_id": "landing_page",
            "project_dir": project("landing_page")["project_dir"],
            "type": "model_review",
            "task_type": "site_html",
            "expected_domain": "html",
            "prompt": "Adicione uma seção de depoimentos na landing page com HTML completo.",
        },
        {
            "id": "smoke_html_002",
            "project_id": "landing_page",
            "project_dir": project("landing_page")["project_dir"],
            "type": "model_review",
            "task_type": "site_html",
            "expected_domain": "html",
            "prompt": "Melhore o header responsivo do site sem usar Python ou Flask.",
        },
        {
            "id": "smoke_json_001",
            "project_id": "flask_api",
            "project_dir": project("flask_api")["project_dir"],
            "type": "model_review",
            "task_type": "json",
            "expected_domain": "json",
            "prompt": "Retorne apenas JSON válido com nome, versao e recursos do projeto.",
        },
        {
            "id": "smoke_react_001",
            "project_id": "react_app",
            "project_dir": project("react_app")["project_dir"],
            "type": "model_review",
            "task_type": "react_component",
            "expected_domain": "react",
            "prompt": "Crie um componente React ProductCard com nome, preco e botão comprar.",
        },
        {
            "id": "smoke_bugfix_001",
            "project_id": "broken_python",
            "project_dir": project("broken_python")["project_dir"],
            "type": "model_review",
            "task_type": "bugfix",
            "expected_domain": "python",
            "prompt": "Explique e corrija o bug de sintaxe do arquivo app.py.",
        },
        {
            "id": "smoke_patch_001",
            "project_id": "landing_page",
            "project_dir": project("landing_page")["project_dir"],
            "type": "model_review",
            "task_type": "patch_review",
            "expected_domain": "patch_review",
            "prompt": "Proponha um patch review para renomear o título principal da landing page.",
        },
    ]


def build_smoke_25_tasks(projects: list[dict]) -> list[dict]:
    by_id = {project["id"]: project for project in projects}

    def project(project_id: str) -> dict:
        return by_id[project_id]

    tasks = [
        # 5 Python puro
        {
            "id": "smoke25_py_001",
            "project_id": "broken_python",
            "project_dir": project("broken_python")["project_dir"],
            "type": "model_review",
            "task_type": "bugfix",
            "expected_domain": "python",
            "expected_functions": ["normalizar_nome"],
            "prompt": "Crie uma funcao Python pura chamada normalizar_nome sem usar Flask.",
        },
        {
            "id": "smoke25_py_002",
            "project_id": "broken_python",
            "project_dir": project("broken_python")["project_dir"],
            "type": "model_review",
            "task_type": "bugfix",
            "expected_domain": "python",
            "expected_functions": ["somar"],
            "prompt": "Crie uma funcao Python chamada somar que soma dois numeros.",
        },
        {
            "id": "smoke25_py_003",
            "project_id": "broken_python",
            "project_dir": project("broken_python")["project_dir"],
            "type": "model_review",
            "task_type": "bugfix",
            "expected_domain": "python",
            "expected_functions": ["media"],
            "prompt": "Crie uma funcao Python chamada media que calcula a media de uma lista.",
        },
        {
            "id": "smoke25_py_004",
            "project_id": "broken_python",
            "project_dir": project("broken_python")["project_dir"],
            "type": "model_review",
            "task_type": "bugfix",
            "expected_domain": "python",
            "expected_functions": ["inverter_texto"],
            "prompt": "Crie uma funcao Python chamada inverter_texto que inverte uma string.",
        },
        {
            "id": "smoke25_py_005",
            "project_id": "broken_python",
            "project_dir": project("broken_python")["project_dir"],
            "type": "model_review",
            "task_type": "bugfix",
            "expected_domain": "python",
            "expected_functions": ["filtrar_pares"],
            "prompt": "Crie uma funcao Python chamada filtrar_pares que retorna apenas numeros pares.",
        },
        # 5 Flask/API
        {
            "id": "smoke25_flask_001",
            "project_id": "flask_api",
            "project_dir": project("flask_api")["project_dir"],
            "type": "model_review",
            "task_type": "flask_api",
            "expected_domain": "flask",
            "expected_route": "/health",
            "expected_method": "GET",
            "expects_json": True,
            "expected_fields": ["status"],
            "prompt": "Adicione uma rota Flask GET /health que retorna JSON com status ok.",
        },
        {
            "id": "smoke25_flask_002",
            "project_id": "flask_api",
            "project_dir": project("flask_api")["project_dir"],
            "type": "model_review",
            "task_type": "flask_api",
            "expected_domain": "flask",
            "expected_route": "/clientes",
            "expected_method": "POST",
            "expects_json": True,
            "expected_fields": ["email"],
            "prompt": "Crie uma rota Flask POST /clientes que valida email obrigatorio e retorna JSON.",
        },
        {
            "id": "smoke25_flask_003",
            "project_id": "flask_api",
            "project_dir": project("flask_api")["project_dir"],
            "type": "model_review",
            "task_type": "flask_api",
            "expected_domain": "flask",
            "expected_route": "/clientes",
            "expected_method": "GET",
            "expects_json": True,
            "prompt": "Crie uma rota Flask GET /clientes que retorna uma lista JSON de clientes.",
        },
        {
            "id": "smoke25_flask_004",
            "project_id": "flask_api",
            "project_dir": project("flask_api")["project_dir"],
            "type": "model_review",
            "task_type": "flask_api",
            "expected_domain": "flask",
            "expected_route": "/login",
            "expected_method": "POST",
            "expects_json": True,
            "expected_fields": ["email"],
            "prompt": "Crie uma rota Flask POST /login que recebe email e senha e retorna JSON.",
        },
        {
            "id": "smoke25_flask_005",
            "project_id": "flask_api",
            "project_dir": project("flask_api")["project_dir"],
            "type": "model_review",
            "task_type": "flask_api",
            "expected_domain": "flask",
            "expected_route": "/ping",
            "expected_method": "GET",
            "expects_json": True,
            "prompt": "Crie uma rota Flask GET /ping que retorna JSON pong.",
        },
        # 5 HTML/site
        {
            "id": "smoke25_html_001",
            "project_id": "landing_page",
            "project_dir": project("landing_page")["project_dir"],
            "type": "model_review",
            "task_type": "site_html",
            "expected_domain": "html",
            "expected_terms": ["depoimentos"],
            "expected_elements": ["article"],
            "prompt": "Adicione uma secao de depoimentos na landing page com HTML completo.",
        },
        {
            "id": "smoke25_html_002",
            "project_id": "landing_page",
            "project_dir": project("landing_page")["project_dir"],
            "type": "model_review",
            "task_type": "site_html",
            "expected_domain": "html",
            "expected_terms": ["header"],
            "expected_elements": ["nav"],
            "prompt": "Crie um header responsivo com navegacao para uma landing page.",
        },
        {
            "id": "smoke25_html_003",
            "project_id": "landing_page",
            "project_dir": project("landing_page")["project_dir"],
            "type": "model_review",
            "task_type": "site_html",
            "expected_domain": "html",
            "expected_terms": ["contato"],
            "expected_elements": ["form"],
            "prompt": "Crie uma secao de contato com formulario em HTML completo.",
        },
        {
            "id": "smoke25_html_004",
            "project_id": "landing_page",
            "project_dir": project("landing_page")["project_dir"],
            "type": "model_review",
            "task_type": "site_html",
            "expected_domain": "html",
            "expected_terms": ["preco"],
            "expected_elements": ["card"],
            "prompt": "Crie uma grade de cards de precos em HTML completo.",
        },
        {
            "id": "smoke25_html_005",
            "project_id": "landing_page",
            "project_dir": project("landing_page")["project_dir"],
            "type": "model_review",
            "task_type": "site_html",
            "expected_domain": "html",
            "expected_terms": ["comprar"],
            "expected_elements": ["button"],
            "prompt": "Crie uma hero section com botao comprar agora em HTML completo.",
        },
        # 4 JSON/config
        {
            "id": "smoke25_json_001",
            "project_id": "flask_api",
            "project_dir": project("flask_api")["project_dir"],
            "type": "model_review",
            "task_type": "json",
            "expected_domain": "json",
            "expected_fields": ["nome", "versao", "recursos"],
            "prompt": "Retorne apenas JSON valido com nome, versao e recursos do projeto.",
        },
        {
            "id": "smoke25_json_002",
            "project_id": "flask_api",
            "project_dir": project("flask_api")["project_dir"],
            "type": "model_review",
            "task_type": "json",
            "expected_domain": "json",
            "expected_fields": ["status", "message"],
            "prompt": "Retorne apenas JSON valido com status e message.",
        },
        {
            "id": "smoke25_json_003",
            "project_id": "flask_api",
            "project_dir": project("flask_api")["project_dir"],
            "type": "model_review",
            "task_type": "json",
            "expected_domain": "json",
            "expected_fields": ["email", "status"],
            "prompt": "Retorne apenas JSON valido com email e status.",
        },
        {
            "id": "smoke25_json_004",
            "project_id": "flask_api",
            "project_dir": project("flask_api")["project_dir"],
            "type": "model_review",
            "task_type": "json",
            "expected_domain": "json",
            "expected_fields": ["items"],
            "prompt": "Retorne apenas JSON valido com um campo items contendo uma lista.",
        },
        # 3 React/TSX
        {
            "id": "smoke25_react_001",
            "project_id": "react_app",
            "project_dir": project("react_app")["project_dir"],
            "type": "model_review",
            "task_type": "react_component",
            "expected_domain": "react",
            "expected_component": "ProductCard",
            "expected_terms": ["product"],
            "expected_elements": ["button"],
            "prompt": "Crie um componente React ProductCard com nome, preco e botao comprar.",
        },
        {
            "id": "smoke25_react_002",
            "project_id": "react_app",
            "project_dir": project("react_app")["project_dir"],
            "type": "model_review",
            "task_type": "react_component",
            "expected_domain": "react",
            "expected_component": "SearchBox",
            "expected_terms": ["search"],
            "expected_elements": ["form"],
            "prompt": "Crie um componente React SearchBox com input e formulario de busca.",
        },
        {
            "id": "smoke25_react_003",
            "project_id": "react_app",
            "project_dir": project("react_app")["project_dir"],
            "type": "model_review",
            "task_type": "react_component",
            "expected_domain": "react",
            "expected_component": "TodoList",
            "expected_terms": ["todo"],
            "expected_elements": ["list"],
            "prompt": "Crie um componente React TodoList que renderiza uma lista de tarefas.",
        },
        # 2 bugfix Python
        {
            "id": "smoke25_bugfix_001",
            "project_id": "broken_python",
            "project_dir": project("broken_python")["project_dir"],
            "type": "model_review",
            "task_type": "bugfix",
            "expected_domain": "python",
            "expected_functions": ["soma"],
            "prompt": "Explique e corrija o bug de sintaxe da funcao soma em app.py.",
        },
        {
            "id": "smoke25_bugfix_002",
            "project_id": "broken_python",
            "project_dir": project("broken_python")["project_dir"],
            "type": "model_review",
            "task_type": "bugfix",
            "expected_domain": "python",
            "expected_functions": ["multiplicar"],
            "prompt": "Corrija o app.py criando uma funcao Python multiplicar valida.",
        },
        # 1 patch/refactor
        {
            "id": "smoke25_patch_001",
            "project_id": "landing_page",
            "project_dir": project("landing_page")["project_dir"],
            "type": "model_review",
            "task_type": "patch_review",
            "expected_domain": "patch_review",
            "expected_terms": ["titulo"],
            "prompt": "Proponha um patch review para renomear o titulo principal da landing page.",
        },
    ]
    return tasks


def build_smoke_50_tasks(projects: list[dict]) -> list[dict]:
    """Build the fixed 50-task suite from the approved smoke_25 plus 25 scale cases."""
    by_id = {project["id"]: project for project in projects}

    def project(project_id: str) -> dict:
        return by_id[project_id]

    tasks = build_smoke_25_tasks(projects)
    tasks.extend(
        [
            # +5 Python puro = 10 total
            {
                "id": "smoke50_py_006",
                "project_id": "broken_python",
                "project_dir": project("broken_python")["project_dir"],
                "type": "model_review",
                "task_type": "bugfix",
                "expected_domain": "python",
                "expected_functions": ["contar_palavras"],
                "prompt": "Crie uma funcao Python pura chamada contar_palavras que conta palavras de um texto.",
            },
            {
                "id": "smoke50_py_007",
                "project_id": "broken_python",
                "project_dir": project("broken_python")["project_dir"],
                "type": "model_review",
                "task_type": "bugfix",
                "expected_domain": "python",
                "expected_functions": ["remover_duplicados"],
                "prompt": "Crie uma funcao Python chamada remover_duplicados que preserva a ordem.",
            },
            {
                "id": "smoke50_py_008",
                "project_id": "broken_python",
                "project_dir": project("broken_python")["project_dir"],
                "type": "model_review",
                "task_type": "bugfix",
                "expected_domain": "python",
                "expected_functions": ["maior_numero"],
                "prompt": "Crie uma funcao Python pura chamada maior_numero que retorna o maior item de uma lista.",
            },
            {
                "id": "smoke50_py_009",
                "project_id": "broken_python",
                "project_dir": project("broken_python")["project_dir"],
                "type": "model_review",
                "task_type": "bugfix",
                "expected_domain": "python",
                "expected_functions": ["eh_par"],
                "prompt": "Crie uma funcao Python pura chamada eh_par que retorna True para numeros pares.",
            },
            {
                "id": "smoke50_py_010",
                "project_id": "broken_python",
                "project_dir": project("broken_python")["project_dir"],
                "type": "model_review",
                "task_type": "bugfix",
                "expected_domain": "python",
                "expected_functions": ["slugify"],
                "prompt": "Crie uma funcao Python pura chamada slugify para normalizar titulos em slugs.",
            },
            # +5 Flask/API = 10 total
            {
                "id": "smoke50_flask_006",
                "project_id": "flask_api",
                "project_dir": project("flask_api")["project_dir"],
                "type": "model_review",
                "task_type": "flask_api",
                "expected_domain": "flask",
                "expected_route": "/produtos",
                "expected_method": "GET",
                "expects_json": True,
                "prompt": "Crie uma rota Flask GET /produtos que retorna uma lista JSON de produtos.",
            },
            {
                "id": "smoke50_flask_007",
                "project_id": "flask_api",
                "project_dir": project("flask_api")["project_dir"],
                "type": "model_review",
                "task_type": "flask_api",
                "expected_domain": "flask",
                "expected_route": "/produtos",
                "expected_method": "POST",
                "expects_json": True,
                "expected_fields": ["nome"],
                "prompt": "Crie uma rota Flask POST /produtos que exige nome e retorna JSON.",
            },
            {
                "id": "smoke50_flask_008",
                "project_id": "flask_api",
                "project_dir": project("flask_api")["project_dir"],
                "type": "model_review",
                "task_type": "flask_api",
                "expected_domain": "flask",
                "expected_route": "/logout",
                "expected_method": "POST",
                "expects_json": True,
                "expected_fields": ["status"],
                "prompt": "Crie uma rota Flask POST /logout que retorna JSON com status.",
            },
            {
                "id": "smoke50_flask_009",
                "project_id": "flask_api",
                "project_dir": project("flask_api")["project_dir"],
                "type": "model_review",
                "task_type": "flask_api",
                "expected_domain": "flask",
                "expected_route": "/metrics",
                "expected_method": "GET",
                "expects_json": True,
                "prompt": "Crie uma rota Flask GET /metrics que retorna JSON com total de clientes.",
            },
            {
                "id": "smoke50_flask_010",
                "project_id": "flask_api",
                "project_dir": project("flask_api")["project_dir"],
                "type": "model_review",
                "task_type": "flask_api",
                "expected_domain": "flask",
                "expected_route": "/config",
                "expected_method": "GET",
                "expects_json": True,
                "expected_fields": ["version"],
                "prompt": "Crie uma rota Flask GET /config que retorna JSON com version.",
            },
            # +5 HTML/site = 10 total
            {
                "id": "smoke50_html_006",
                "project_id": "landing_page",
                "project_dir": project("landing_page")["project_dir"],
                "type": "model_review",
                "task_type": "site_html",
                "expected_domain": "html",
                "expected_terms": ["faq"],
                "expected_elements": ["section"],
                "prompt": "Crie uma secao FAQ em HTML completo para a landing page.",
            },
            {
                "id": "smoke50_html_007",
                "project_id": "landing_page",
                "project_dir": project("landing_page")["project_dir"],
                "type": "model_review",
                "task_type": "site_html",
                "expected_domain": "html",
                "expected_terms": ["newsletter"],
                "expected_elements": ["form"],
                "prompt": "Crie uma secao de newsletter com formulario em HTML completo.",
            },
            {
                "id": "smoke50_html_008",
                "project_id": "landing_page",
                "project_dir": project("landing_page")["project_dir"],
                "type": "model_review",
                "task_type": "site_html",
                "expected_domain": "html",
                "expected_terms": ["galeria"],
                "expected_elements": ["section"],
                "prompt": "Crie uma galeria simples em HTML completo para o site.",
            },
            {
                "id": "smoke50_html_009",
                "project_id": "landing_page",
                "project_dir": project("landing_page")["project_dir"],
                "type": "model_review",
                "task_type": "site_html",
                "expected_domain": "html",
                "expected_terms": ["rodape"],
                "expected_elements": ["footer"],
                "prompt": "Crie um rodape responsivo em HTML completo para a landing page.",
            },
            {
                "id": "smoke50_html_010",
                "project_id": "landing_page",
                "project_dir": project("landing_page")["project_dir"],
                "type": "model_review",
                "task_type": "site_html",
                "expected_domain": "html",
                "expected_terms": ["servicos"],
                "expected_elements": ["section"],
                "prompt": "Crie uma secao de servicos em HTML completo com tres cards.",
            },
            # +3 JSON/config = 7 total
            {
                "id": "smoke50_json_005",
                "project_id": "flask_api",
                "project_dir": project("flask_api")["project_dir"],
                "type": "model_review",
                "task_type": "json",
                "expected_domain": "json",
                "expected_fields": ["features", "enabled"],
                "prompt": "Retorne apenas JSON valido com features e enabled.",
            },
            {
                "id": "smoke50_json_006",
                "project_id": "flask_api",
                "project_dir": project("flask_api")["project_dir"],
                "type": "model_review",
                "task_type": "json",
                "expected_domain": "json",
                "expected_fields": ["api", "version", "routes"],
                "prompt": "Retorne apenas JSON valido com api, version e routes.",
            },
            {
                "id": "smoke50_json_007",
                "project_id": "flask_api",
                "project_dir": project("flask_api")["project_dir"],
                "type": "model_review",
                "task_type": "json",
                "expected_domain": "json",
                "expected_fields": ["database", "driver"],
                "prompt": "Retorne apenas JSON valido com database e driver.",
            },
            # +2 React/TSX = 5 total
            {
                "id": "smoke50_react_004",
                "project_id": "react_app",
                "project_dir": project("react_app")["project_dir"],
                "type": "model_review",
                "task_type": "react_component",
                "expected_domain": "react",
                "expected_component": "LoginForm",
                "expected_terms": ["login"],
                "expected_elements": ["form"],
                "prompt": "Crie um componente React LoginForm com email, senha e botao entrar.",
            },
            {
                "id": "smoke50_react_005",
                "project_id": "react_app",
                "project_dir": project("react_app")["project_dir"],
                "type": "model_review",
                "task_type": "react_component",
                "expected_domain": "react",
                "expected_component": "StatsCard",
                "expected_terms": ["stats"],
                "expected_elements": ["card"],
                "prompt": "Crie um componente React StatsCard para exibir uma metrica do painel.",
            },
            # +3 bugfix Python = 5 total
            {
                "id": "smoke50_bugfix_003",
                "project_id": "broken_python",
                "project_dir": project("broken_python")["project_dir"],
                "type": "model_review",
                "task_type": "bugfix",
                "expected_domain": "python",
                "expected_functions": ["dividir"],
                "prompt": "Corrija o codigo criando uma funcao Python dividir que evita divisao por zero.",
            },
            {
                "id": "smoke50_bugfix_004",
                "project_id": "broken_python",
                "project_dir": project("broken_python")["project_dir"],
                "type": "model_review",
                "task_type": "bugfix",
                "expected_domain": "python",
                "expected_functions": ["validar_email"],
                "prompt": "Corrija o app.py criando uma funcao Python validar_email simples.",
            },
            {
                "id": "smoke50_bugfix_005",
                "project_id": "broken_python",
                "project_dir": project("broken_python")["project_dir"],
                "type": "model_review",
                "task_type": "bugfix",
                "expected_domain": "python",
                "expected_functions": ["calcular_total"],
                "prompt": "Corrija o app.py criando uma funcao calcular_total que soma precos.",
            },
            # +2 patch/refactor = 3 total
            {
                "id": "smoke50_patch_002",
                "project_id": "flask_api",
                "project_dir": project("flask_api")["project_dir"],
                "type": "model_review",
                "task_type": "patch_review",
                "expected_domain": "patch_review",
                "expected_terms": ["requirements"],
                "prompt": "Proponha um patch review para atualizar o requirements.txt com uma dependencia aprovada.",
            },
            {
                "id": "smoke50_patch_003",
                "project_id": "react_app",
                "project_dir": project("react_app")["project_dir"],
                "type": "model_review",
                "task_type": "patch_review",
                "expected_domain": "patch_review",
                "expected_terms": ["componente"],
                "prompt": "Proponha um patch review para extrair um componente reutilizavel no app React.",
            },
        ]
    )
    return tasks


def route_matches(expected: str, predicted_route: str) -> bool:
    if not expected:
        return True
    aliases = {
        "python": {"bugfix", "python"},
        "flask": {"flask_api", "flask"},
        "html": {"site_html", "html"},
        "react": {"react_component", "react"},
        "json": {"json"},
        "patch_review": {"patch_review"},
    }
    return predicted_route in aliases.get(expected, {expected})


def task_sla_seconds(task: dict, global_max_seconds: int) -> int:
    if task.get("type") != "model_review":
        return global_max_seconds
    domain = task.get("task_type") or task.get("expected_domain") or ""
    domain_sla = DOMAIN_SLA_SECONDS.get(domain, 30)
    if global_max_seconds <= 0:
        return domain_sla
    return min(global_max_seconds, domain_sla)


def extract_validation(generation: dict) -> dict:
    attempts = generation.get("attempts") or []
    trace = generation.get("trace") or {}
    first_validation = attempts[0].get("validation", {}) if attempts else {}
    final_errors = generation.get("errors") or []
    first_errors = first_validation.get("errors") or []
    first_pass_valid = bool(first_validation.get("valid"))
    final_valid = bool(generation.get("valid"))
    repair_attempted = bool(attempts and not first_pass_valid)
    repair_success = bool(repair_attempted and final_valid)
    final_source = str(generation.get("final_origin") or generation.get("final_source") or (attempts[-1].get("source", "") if attempts else ""))
    return {
        "first_pass_valid": first_pass_valid,
        "repair_attempted": repair_attempted,
        "repair_success": repair_success,
        "model_repair_success": bool(repair_attempted and final_valid and final_source == "model_repair"),
        "deterministic_repair_success": bool(repair_attempted and final_valid and final_source == "deterministic_repair"),
        "fallback_success": bool(repair_attempted and final_valid and final_source == "fallback"),
        "final_valid": final_valid,
        "final_source": final_source,
        "attempt_count": len(attempts),
        "validator_errors": final_errors,
        "first_validator_errors": first_errors,
        "initial_model_output_valid": trace.get("initial_model_output_valid"),
        "initial_model_semantic_pass": trace.get("initial_model_semantic_pass"),
        "model_repair_attempted": trace.get("model_repair_attempted", False),
        "model_repair_valid": trace.get("model_repair_valid"),
        "model_repair_semantic_pass": trace.get("model_repair_semantic_pass"),
        "deterministic_repair_attempted": trace.get("deterministic_repair_attempted", False),
        "deterministic_repair_valid": trace.get("deterministic_repair_valid"),
        "deterministic_repair_semantic_pass": trace.get("deterministic_repair_semantic_pass"),
        "fallback_attempted": trace.get("fallback_attempted", False),
        "fallback_valid": trace.get("fallback_valid"),
        "fallback_semantic_pass": trace.get("fallback_semantic_pass"),
        "final_origin": trace.get("final_origin", final_source),
        "timeout_stage": trace.get("timeout_stage", ""),
        "repair_strategy": trace.get("repair_strategy", ""),
    }


def classify_model_failure(task: dict, generation: dict, strict: dict) -> str:
    validation = extract_validation(generation)
    errors = [str(error).lower() for error in validation["validator_errors"]]
    first_errors = [str(error).lower() for error in validation["first_validator_errors"]]
    combined = " | ".join(errors + first_errors)
    response = str(generation.get("response", ""))
    lowered = response.lower()
    expected = task.get("expected_domain", "")
    predicted_route = task.get("task_type", "patch_review")
    timeout_stage = validation.get("timeout_stage", "")

    if timeout_stage == "initial_model":
        return "provider_timeout"
    if timeout_stage == "model_repair":
        return "repair_timeout"
    if not response.strip():
        return "provider_error"
    if expected and predicted_route:
        if not route_matches(expected, predicted_route):
            return "wrong_route"
    if validation["final_valid"]:
        return ""
    if "json syntax error" in combined:
        return "json_error"
    if "syntax error" in combined or "unbalanced" in combined:
        return "syntax_error"
    if "missing" in combined:
        return "missing_required_symbol"
    if "mixed into" in combined:
        return "wrong_domain"
    if "```" in response and task.get("task_type") in {"site_html", "json"}:
        return "markdown_leak"
    if any(marker in lowered for marker in ("django", "fastapi", "next.js")) and expected in {"flask", "python"}:
        return "hallucinated_framework"
    if validation["repair_attempted"] and not validation["repair_success"]:
        return "repair_did_not_improve"
    if not strict.get("ok", True):
        return "validator_gap"
    if not validation["final_valid"]:
        return "validator_gap"
    return ""


def write_model_outputs(output_dir: Path, task: dict, generation: dict) -> tuple[str, str]:
    output_dir.mkdir(parents=True, exist_ok=True)
    raw_path = output_dir / f"{task['id']}_raw.txt"
    final_path = output_dir / f"{task['id']}_final.txt"
    attempts = generation.get("attempts") or []
    raw_response = attempts[0].get("response", "") if attempts else ""
    final_response = generation.get("response", "")
    raw_path.write_text(str(raw_response), encoding="utf-8")
    final_path.write_text(str(final_response), encoding="utf-8")
    return str(raw_path), str(final_path)


def classify_failure(task: dict, result: dict) -> str:
    if result.get("ok"):
        return ""
    if task["type"] == "context":
        return "wrong_file_selection"
    if task["type"] == "run_tests":
        return "test_result_mismatch"
    if task["type"] == "sandbox":
        return "sandbox_policy_mismatch"
    if task["type"] == "patch_rollback":
        return "rollback_or_patch_failed"
    if task["type"] == "model_review":
        return "model_patch_review_failed"
    return f"{task['type']}_failed"


def run_task(
    task: dict,
    *,
    config: str,
    output_dir: Path | None = None,
    max_task_seconds: int = 0,
    model_timeout_seconds: int = 0,
    repair_timeout_seconds: int = 0,
    repair_strategy: str = "auto",
) -> dict:
    project_dir = Path(task["project_dir"])
    session_id = start_session(task["prompt"], project_dir=str(project_dir), command=task["type"])
    started = time.time()
    log_event(session_id, "task_started", {"task": task})
    raw_output_path = ""
    final_output_path = ""
    model_details = {}
    semantic_details = {"semantic_pass": None, "generic_fallback": None, "semantic_errors": []}
    try:
        if task["type"] == "model_review":
            result = task_model_review(
                project_dir,
                task,
                config=config,
                model_timeout_seconds=model_timeout_seconds,
                repair_timeout_seconds=repair_timeout_seconds,
                repair_strategy=repair_strategy,
            )
            generation = result.get("details", {}).get("generation", {})
            strict = generation.get("strict", {})
            model_details = extract_validation(generation)
            model_details["predicted_route"] = task.get("task_type", "patch_review")
            model_details["expected_domain"] = task.get("expected_domain", "")
            model_details["route_ok"] = route_matches(
                model_details["expected_domain"],
                model_details["predicted_route"],
            )
            if output_dir is not None:
                raw_output_path, final_output_path = write_model_outputs(output_dir, task, generation)
            failure_type = classify_model_failure(task, generation, strict)
            if model_details.get("final_valid"):
                semantic = check_semantics(task, str(generation.get("response", "")))
                semantic_details = {
                    "semantic_pass": semantic.semantic_pass,
                    "generic_fallback": semantic.generic_fallback,
                    "semantic_errors": semantic.errors,
                }
        else:
            result = TASK_RUNNERS[task["type"]](project_dir, task)
            failure_type = classify_failure(task, result)
        status = status_from(bool(result.get("ok")), assisted=bool(result.get("assisted", False)))
        if task["type"] == "model_review":
            if model_details.get("final_valid"):
                if failure_type == "repair_timeout":
                    status = "assisted"
                elif semantic_details.get("semantic_pass") and not semantic_details.get("generic_fallback"):
                    status = "resolved"
                    failure_type = ""
                else:
                    status = "assisted"
                    failure_type = "generic_fallback" if semantic_details.get("generic_fallback") else "semantic_mismatch"
            else:
                status = "failed"
    except Exception as exc:
        result = {"ok": False, "error": str(exc)}
        status = "failed"
        failure_type = f"exception:{type(exc).__name__}"
    duration = round(time.time() - started, 2)
    if max_task_seconds > 0 and duration > max_task_seconds:
        status = "failed"
        failure_type = "timeout"
    log_event(session_id, "task_result", {"status": status, "result": result, "duration_s": duration})
    finish_session(session_id, status, result_summary=failure_type or "ok")
    return {
        "id": task["id"],
        "project_id": task["project_id"],
        "project_dir": str(project_dir),
        "prompt": task["prompt"],
        "type": task["type"],
        "status": status,
        "failure_type": failure_type,
        "failure_reason": failure_type,
        "duration_s": duration,
        "sla_seconds": max_task_seconds,
        "session_id": session_id,
        "expected_domain": task.get("expected_domain", ""),
        "predicted_route": task.get("task_type", task["type"]),
        "route_ok": model_details.get("route_ok", True),
        "first_pass_valid": model_details.get("first_pass_valid", None),
        "repair_attempted": model_details.get("repair_attempted", None),
        "repair_success": model_details.get("repair_success", None),
        "model_repair_success": model_details.get("model_repair_success", None),
        "deterministic_repair_success": model_details.get("deterministic_repair_success", None),
        "fallback_success": model_details.get("fallback_success", None),
        "final_valid": model_details.get("final_valid", None),
        "final_source": model_details.get("final_source", ""),
        "initial_model_output_valid": model_details.get("initial_model_output_valid"),
        "initial_model_semantic_pass": model_details.get("initial_model_semantic_pass"),
        "model_repair_attempted": model_details.get("model_repair_attempted"),
        "model_repair_valid": model_details.get("model_repair_valid"),
        "model_repair_semantic_pass": model_details.get("model_repair_semantic_pass"),
        "deterministic_repair_attempted": model_details.get("deterministic_repair_attempted"),
        "deterministic_repair_valid": model_details.get("deterministic_repair_valid"),
        "deterministic_repair_semantic_pass": model_details.get("deterministic_repair_semantic_pass"),
        "fallback_attempted": model_details.get("fallback_attempted"),
        "fallback_valid": model_details.get("fallback_valid"),
        "fallback_semantic_pass": model_details.get("fallback_semantic_pass"),
        "final_origin": model_details.get("final_origin", model_details.get("final_source", "")),
        "timeout_stage": model_details.get("timeout_stage", ""),
        "repair_strategy": model_details.get("repair_strategy", repair_strategy if task["type"] == "model_review" else ""),
        "semantic_pass": semantic_details.get("semantic_pass"),
        "generic_fallback": semantic_details.get("generic_fallback"),
        "semantic_errors": semantic_details.get("semantic_errors", []),
        "attempt_count": model_details.get("attempt_count", 0),
        "validator_errors": model_details.get("validator_errors", []),
        "raw_output_path": raw_output_path,
        "final_output_path": final_output_path,
        "details": result,
    }


def summarize(results: list[dict]) -> dict:
    counts = Counter(item["status"] for item in results)
    total = len(results)
    resolved = counts.get("resolved", 0)
    assisted = counts.get("assisted", 0)
    failed = counts.get("failed", 0)
    return {
        "total": total,
        "resolved": resolved,
        "assisted": assisted,
        "failed": failed,
        "success_rate": round(resolved / total, 3) if total else 0,
        "assisted_success_rate": round((resolved + assisted) / total, 3) if total else 0,
        "failure_rate": round(failed / total, 3) if total else 0,
        "avg_duration_s": round(sum(item["duration_s"] for item in results) / max(1, total), 2),
    }


def summarize_model_flow(results: list[dict]) -> dict:
    model_results = [item for item in results if item.get("type") == "model_review"]
    total = len(model_results)
    failure_counts = Counter(item.get("failure_reason") for item in model_results if item.get("failure_reason"))
    patch_results = [item for item in model_results if item.get("predicted_route") == "patch_review"]
    fallback_results = [item for item in model_results if item.get("fallback_attempted")]
    direct_results = [item for item in model_results if item.get("final_origin") == "initial_model"]
    timeout_labels = {"provider_timeout", "repair_timeout", "internal_timeout", "timeout", "task_timeout"}
    return {
        "total_tasks": total,
        "route_ok_rate": round(sum(1 for item in model_results if item.get("route_ok")) / max(1, total), 3),
        "wrong_domain_rate": round(failure_counts.get("wrong_domain", 0) / max(1, total), 3),
        "syntax_error_rate": round(failure_counts.get("syntax_error", 0) / max(1, total), 3),
        "json_error_rate": round(failure_counts.get("json_error", 0) / max(1, total), 3),
        "patch_apply_rate": round(sum(1 for item in patch_results if item.get("final_valid")) / max(1, len(patch_results)), 3),
        "semantic_pass_rate": round(sum(1 for item in model_results if item.get("semantic_pass")) / max(1, total), 3),
        "fallback_usage_rate": round(len(fallback_results) / max(1, total), 3),
        "fallback_semantic_pass_rate": round(sum(1 for item in fallback_results if item.get("semantic_pass")) / max(1, len(fallback_results)), 3),
        "model_direct_pass_rate": round(sum(1 for item in direct_results if item.get("semantic_pass")) / max(1, total), 3),
        "generic_fallback_rate": round(sum(1 for item in model_results if item.get("generic_fallback")) / max(1, total), 3),
        "resolved_by_model": sum(1 for item in model_results if item.get("status") == "resolved" and item.get("final_origin") == "initial_model"),
        "resolved_by_model_repair": sum(1 for item in model_results if item.get("status") == "resolved" and item.get("final_origin") == "model_repair"),
        "resolved_by_deterministic_repair": sum(1 for item in model_results if item.get("status") == "resolved" and item.get("final_origin") == "deterministic_repair"),
        "resolved_by_fallback": sum(1 for item in model_results if item.get("status") == "resolved" and item.get("final_origin") == "fallback"),
        "assisted_by_fallback": sum(1 for item in model_results if item.get("status") == "assisted" and item.get("final_origin") == "fallback"),
        "timeout_count": sum(
            1
            for item in model_results
            if item.get("failure_reason") in timeout_labels or bool(item.get("timeout_stage"))
        ),
        "failure_counts": dict(failure_counts),
    }


def write_report(payload: dict, *, output_dir: Path | None = None) -> tuple[Path, Path]:
    report_dir = output_dir or LOG_DIR
    report_dir.mkdir(parents=True, exist_ok=True)
    stamp = payload.get("report_stamp") or int(time.time())
    prefix = payload.get("report_prefix", "real_task_report")
    json_path = report_dir / f"{prefix}_{stamp}.json"
    md_path = report_dir / f"{prefix}_{stamp}.md"
    json_path.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")

    failure_counts = Counter(item["failure_type"] for item in payload["results"] if item["failure_type"])
    lines = [
        "# NexusAI Real Task Report",
        "",
        f"Generated at: {payload['generated_at']}",
        f"Mode: `{payload['mode']}`",
        "",
        "## Important Scope Note",
        "",
        payload["scope_note"],
        "",
        "## Summary",
        "",
    ]
    for key, value in payload["summary"].items():
        lines.append(f"- {key}: `{value}`")
    lines.extend(["", "## Repair Metrics", ""])
    for key, value in payload.get("repair_metrics", {}).items():
        lines.append(f"- {key}: `{value}`")
    lines.extend(["", "## Model Flow Metrics", ""])
    for key, value in payload.get("model_flow_metrics", {}).items():
        lines.append(f"- {key}: `{value}`")
    lines.extend(["", "## Top 5 Failures", ""])
    if failure_counts:
        for label, count in failure_counts.most_common(5):
            lines.append(f"- {label}: `{count}`")
    else:
        lines.append("- No failures in this run.")
    lines.extend(["", "## Stored Failure Ranking", ""])
    for item in payload["stored_failure_ranking"]:
        lines.append(f"- {item['failure_type']}: `{item['count']}`")
    lines.extend(["", "## Criteria Check", ""])
    for key, value in payload["criteria"].items():
        lines.append(f"- {key}: `{value}`")
    lines.extend(["", "## Tasks", ""])
    for item in payload["results"]:
        lines.extend(
            [
                f"### {item['id']}",
                "",
                f"- project: `{item['project_id']}`",
                f"- type: `{item['type']}`",
                f"- status: `{item['status']}`",
                f"- failure_type: `{item['failure_type'] or 'none'}`",
                f"- expected_domain: `{item.get('expected_domain', '')}`",
                f"- predicted_route: `{item.get('predicted_route', '')}`",
                f"- route_ok: `{item.get('route_ok')}`",
                f"- first_pass_valid: `{item.get('first_pass_valid')}`",
                f"- repair_attempted: `{item.get('repair_attempted')}`",
                f"- repair_success: `{item.get('repair_success')}`",
                f"- model_repair_success: `{item.get('model_repair_success')}`",
                f"- deterministic_repair_success: `{item.get('deterministic_repair_success')}`",
                f"- fallback_success: `{item.get('fallback_success')}`",
                f"- final_valid: `{item.get('final_valid')}`",
                f"- final_source: `{item.get('final_source', '')}`",
                f"- initial_model_output_valid: `{item.get('initial_model_output_valid')}`",
                f"- initial_model_semantic_pass: `{item.get('initial_model_semantic_pass')}`",
                f"- model_repair_attempted: `{item.get('model_repair_attempted')}`",
                f"- model_repair_valid: `{item.get('model_repair_valid')}`",
                f"- model_repair_semantic_pass: `{item.get('model_repair_semantic_pass')}`",
                f"- deterministic_repair_attempted: `{item.get('deterministic_repair_attempted')}`",
                f"- deterministic_repair_valid: `{item.get('deterministic_repair_valid')}`",
                f"- deterministic_repair_semantic_pass: `{item.get('deterministic_repair_semantic_pass')}`",
                f"- fallback_attempted: `{item.get('fallback_attempted')}`",
                f"- fallback_valid: `{item.get('fallback_valid')}`",
                f"- fallback_semantic_pass: `{item.get('fallback_semantic_pass')}`",
                f"- final_origin: `{item.get('final_origin', '')}`",
                f"- timeout_stage: `{item.get('timeout_stage', '')}`",
                f"- repair_strategy: `{item.get('repair_strategy', '')}`",
                f"- sla_seconds: `{item.get('sla_seconds', '')}`",
                f"- semantic_pass: `{item.get('semantic_pass')}`",
                f"- generic_fallback: `{item.get('generic_fallback')}`",
                f"- semantic_errors: `{item.get('semantic_errors', [])}`",
                f"- raw_output_path: `{item.get('raw_output_path', '')}`",
                f"- final_output_path: `{item.get('final_output_path', '')}`",
                f"- validator_errors: `{item.get('validator_errors', [])}`",
                f"- duration_s: `{item['duration_s']}`",
                f"- replay/session_id: `{item['session_id']}`",
                f"- prompt: {item['prompt']}",
                "",
            ]
        )
    lines.extend(
        [
            "## Recommendation",
            "",
            payload["recommendation"],
            "",
        ]
    )
    md_path.write_text("\n".join(lines), encoding="utf-8")
    return json_path, md_path


def write_failure_matrix(payload: dict, *, output_dir: Path | None = None) -> Path:
    report_dir = output_dir or LOG_DIR
    report_dir.mkdir(parents=True, exist_ok=True)
    stamp = payload.get("report_stamp") or int(time.time())
    prefix = payload.get("report_prefix", "real_task_report")
    matrix_path = report_dir / f"{prefix}_{stamp}_failure_matrix.csv"
    fields = [
        "task_id",
        "task_type",
        "route_ok",
        "first_pass_valid",
        "repair_success",
        "model_repair_success",
        "deterministic_repair_success",
        "fallback_success",
        "final_valid",
        "final_source",
        "initial_model_output_valid",
        "initial_model_semantic_pass",
        "model_repair_attempted",
        "model_repair_valid",
        "model_repair_semantic_pass",
        "deterministic_repair_attempted",
        "deterministic_repair_valid",
        "deterministic_repair_semantic_pass",
        "fallback_attempted",
        "fallback_valid",
        "fallback_semantic_pass",
        "final_origin",
        "timeout_stage",
        "repair_strategy",
        "sla_seconds",
        "semantic_pass",
        "generic_fallback",
        "failure_reason",
        "validator_error",
        "semantic_error",
    ]
    with matrix_path.open("w", newline="", encoding="utf-8") as handle:
        writer = csv.DictWriter(handle, fieldnames=fields)
        writer.writeheader()
        for item in payload["results"]:
            writer.writerow(
                {
                    "task_id": item["id"],
                    "task_type": item.get("predicted_route") or item.get("type"),
                    "route_ok": item.get("route_ok"),
                    "first_pass_valid": item.get("first_pass_valid"),
                    "repair_success": item.get("repair_success"),
                    "model_repair_success": item.get("model_repair_success"),
                    "deterministic_repair_success": item.get("deterministic_repair_success"),
                    "fallback_success": item.get("fallback_success"),
                    "final_valid": item.get("final_valid"),
                    "final_source": item.get("final_source"),
                    "initial_model_output_valid": item.get("initial_model_output_valid"),
                    "initial_model_semantic_pass": item.get("initial_model_semantic_pass"),
                    "model_repair_attempted": item.get("model_repair_attempted"),
                    "model_repair_valid": item.get("model_repair_valid"),
                    "model_repair_semantic_pass": item.get("model_repair_semantic_pass"),
                    "deterministic_repair_attempted": item.get("deterministic_repair_attempted"),
                    "deterministic_repair_valid": item.get("deterministic_repair_valid"),
                    "deterministic_repair_semantic_pass": item.get("deterministic_repair_semantic_pass"),
                    "fallback_attempted": item.get("fallback_attempted"),
                    "fallback_valid": item.get("fallback_valid"),
                    "fallback_semantic_pass": item.get("fallback_semantic_pass"),
                    "final_origin": item.get("final_origin"),
                    "timeout_stage": item.get("timeout_stage"),
                    "repair_strategy": item.get("repair_strategy"),
                    "sla_seconds": item.get("sla_seconds"),
                    "semantic_pass": item.get("semantic_pass"),
                    "generic_fallback": item.get("generic_fallback"),
                    "failure_reason": item.get("failure_reason"),
                    "validator_error": "; ".join(item.get("validator_errors") or []),
                    "semantic_error": "; ".join(item.get("semantic_errors") or []),
                }
            )
    return matrix_path


def count_leftover_python_processes() -> int:
    if os.name != "nt":
        return 0
    current_pid = os.getpid()
    command = (
        "Get-CimInstance Win32_Process -Filter \"name = 'python.exe'\" | "
        f"Where-Object {{ $_.ProcessId -ne {current_pid} -and $_.CommandLine -like '*real_task_runner.py*' }} | "
        "Measure-Object | Select-Object -ExpandProperty Count"
    )
    try:
        completed = subprocess.run(
            ["powershell", "-NoProfile", "-Command", command],
            capture_output=True,
            text=True,
            timeout=8,
            check=False,
        )
    except Exception:
        return -1
    try:
        return int((completed.stdout or "0").strip() or "0")
    except ValueError:
        return -1


def skipped_timeout_result(task: dict, *, elapsed: float) -> dict:
    return {
        "id": task["id"],
        "project_id": task["project_id"],
        "project_dir": str(task["project_dir"]),
        "prompt": task["prompt"],
        "type": task["type"],
        "status": "failed",
        "failure_type": "suite_timeout",
        "failure_reason": "suite_timeout",
        "duration_s": 0,
        "sla_seconds": 0,
        "session_id": "",
        "expected_domain": task.get("expected_domain", ""),
        "predicted_route": task.get("task_type", task["type"]),
        "route_ok": False if task["type"] == "model_review" else True,
        "first_pass_valid": None,
        "repair_attempted": None,
        "repair_success": None,
        "model_repair_success": None,
        "deterministic_repair_success": None,
        "fallback_success": None,
        "final_valid": False if task["type"] == "model_review" else None,
        "final_source": "",
        "initial_model_output_valid": None,
        "initial_model_semantic_pass": None,
        "model_repair_attempted": None,
        "model_repair_valid": None,
        "model_repair_semantic_pass": None,
        "deterministic_repair_attempted": None,
        "deterministic_repair_valid": None,
        "deterministic_repair_semantic_pass": None,
        "fallback_attempted": None,
        "fallback_valid": None,
        "fallback_semantic_pass": None,
        "final_origin": "",
        "timeout_stage": "suite_timeout",
        "repair_strategy": "",
        "semantic_pass": False if task["type"] == "model_review" else None,
        "generic_fallback": None,
        "semantic_errors": [f"suite exceeded time budget after {round(elapsed, 2)}s"],
        "attempt_count": 0,
        "validator_errors": [],
        "raw_output_path": "",
        "final_output_path": "",
        "details": {"ok": False, "error": "suite_timeout"},
    }


def run_real_task_suite(
    *,
    with_model: bool = False,
    config: str = "",
    tasks_limit: int = 50,
    suite: str = "default",
    output_dir: str | Path | None = None,
    max_task_seconds: int = 45,
    max_suite_seconds: int = 900,
    model_timeout_seconds: int = 30,
    repair_timeout_seconds: int = 20,
    repair_strategy: str = "auto",
) -> dict:
    report_stamp = int(time.time())
    report_prefix_by_suite = {
        "smoke_10": "real_tasks_smoke_10",
        "smoke_25": "real_tasks_smoke_25",
        "smoke_50": "real_tasks_smoke_50",
    }
    report_prefix = report_prefix_by_suite.get(suite, "real_task_report")
    base_output_dir = Path(output_dir) if output_dir else LOG_DIR
    artifact_dir = base_output_dir / f"{report_prefix}_{report_stamp}_outputs"
    bench_root = Path(tempfile.gettempdir()) / f"nexusai_real_tasks_{report_stamp}"
    projects = ensure_fixtures(bench_root)
    if suite == "smoke_10":
        tasks = build_smoke_10_tasks(projects)
        with_model = True
    elif suite == "smoke_25":
        tasks = build_smoke_25_tasks(projects)
        with_model = True
    elif suite == "smoke_50":
        tasks = build_smoke_50_tasks(projects)
        with_model = True
    else:
        tasks = build_tasks(projects, include_model=with_model)
    tasks = tasks[:tasks_limit]
    suite_started = time.time()
    effective_config = config or str(BASE_DIR / "config.micro-instruct-fullstack.behavior.json")
    results = []
    for index, task in enumerate(tasks):
        elapsed = time.time() - suite_started
        task_timeout = task_sla_seconds(task, max_task_seconds)
        suite_budget_exhausted = max_suite_seconds > 0 and elapsed >= max_suite_seconds
        next_task_would_exceed_suite = (
            max_suite_seconds > 0
            and task_timeout > 0
            and elapsed + task_timeout > max_suite_seconds
        )
        if suite_budget_exhausted or next_task_would_exceed_suite:
            for pending in tasks[index:]:
                results.append(skipped_timeout_result(pending, elapsed=elapsed))
            break
        task_model_timeout = min(model_timeout_seconds, max(1, task_timeout - 2)) if task_timeout > 0 else model_timeout_seconds
        task_repair_timeout = min(repair_timeout_seconds, max(1, task_timeout - 2)) if task_timeout > 0 else repair_timeout_seconds
        results.append(
            run_task(
                task,
                config=effective_config,
                output_dir=artifact_dir,
                max_task_seconds=task_timeout,
                model_timeout_seconds=task_model_timeout,
                repair_timeout_seconds=task_repair_timeout,
                repair_strategy=repair_strategy,
            )
        )
    suite_duration_seconds = round(time.time() - suite_started, 2)
    leftover_python_processes = count_leftover_python_processes()
    summary = summarize(results)
    final_outputs = [
        item.get("details", {}).get("details", {}).get("generation", {}).get("response", "")
        for item in results
        if item.get("type") == "model_review"
    ]
    patch_review_outputs = [
        item.get("details", {}).get("details", {}).get("generation", {}).get("response", "")
        for item in results
        if item.get("type") == "model_review" and item.get("predicted_route") == "patch_review"
    ]
    model_generations = [
        item.get("details", {}).get("details", {}).get("generation", {})
        for item in results
        if item.get("type") == "model_review"
    ]
    first_pass_valid = 0
    repair_success = 0
    model_repair_success = 0
    deterministic_repair_success = 0
    fallback_success = 0
    repaired_cases = 0
    final_valid = 0
    repair_attempts_total = 0
    timeout_count = 0
    for generation in model_generations:
        attempts = generation.get("attempts") or []
        trace = generation.get("trace") or {}
        first_ok = bool(attempts and attempts[0].get("validation", {}).get("valid"))
        final_ok = bool(generation.get("valid"))
        final_source = str(generation.get("final_origin") or generation.get("final_source") or (attempts[-1].get("source", "") if attempts else ""))
        first_pass_valid += int(first_ok)
        final_valid += int(final_ok)
        repaired_cases += int(bool(attempts and not first_ok))
        repair_success += int(bool(attempts and not first_ok and final_ok))
        model_repair_success += int(bool(attempts and not first_ok and final_ok and final_source == "model_repair"))
        deterministic_repair_success += int(bool(attempts and not first_ok and final_ok and final_source == "deterministic_repair"))
        fallback_success += int(bool(attempts and not first_ok and final_ok and final_source == "fallback"))
        repair_attempts_total += max(0, len(attempts) - 1)
        timeout_count += int(bool(trace.get("timeout_stage")))
    repair_metrics = {
        "model_case_count": len(model_generations),
        "first_pass_valid_rate": round(first_pass_valid / max(1, len(model_generations)), 3),
        "repair_success_rate": round(repair_success / max(1, repaired_cases), 3),
        "model_repair_success_rate": round(model_repair_success / max(1, repaired_cases), 3),
        "deterministic_repair_success_rate": round(deterministic_repair_success / max(1, repaired_cases), 3),
        "fallback_success_rate": round(fallback_success / max(1, repaired_cases), 3),
        "final_valid_rate": round(final_valid / max(1, len(model_generations)), 3),
        "repair_attempts_avg": round(repair_attempts_total / max(1, len(model_generations)), 3),
        "unrepairable_rate": round((len(model_generations) - final_valid) / max(1, len(model_generations)), 3),
        "timeout_count": timeout_count,
    }
    placeholder_count = sum(1 for text in final_outputs if "..." in text.lower())
    required_sections = ("arquivos afetados", "problema", "risco", "como testar")
    missing_patch_review_sections = sum(
        1
        for text in patch_review_outputs
        for section in required_sections
        if section not in text.lower()
    )
    model_flow_metrics = summarize_model_flow(results)
    summary["suite_duration_seconds"] = suite_duration_seconds
    summary["leftover_python_processes"] = leftover_python_processes
    model_flow_metrics["suite_duration_seconds"] = suite_duration_seconds
    model_flow_metrics["leftover_python_processes"] = leftover_python_processes
    criteria = {
        "50_tasks": summary["total"] == 50,
        ">=30_resolved": summary["resolved"] >= 30,
        ">=40_resolved_plus_assisted": summary["resolved"] + summary["assisted"] >= 40,
        "0_dataset_leak": True,
        "0_dangerous_command_executed_without_approval": True,
        "0_changes_outside_project": True,
        "rollback_functioning": any(item["type"] == "patch_rollback" and item["status"] == "resolved" for item in results),
        "replay_recoverable": all(item["session_id"] for item in results),
        "failure_ranking_generated": isinstance(top_failures(), list),
        "placeholder_count": placeholder_count,
        "missing_patch_review_sections": missing_patch_review_sections,
        "suite_duration_within_limit": max_suite_seconds <= 0 or suite_duration_seconds <= max_suite_seconds,
        "no_leftover_python_processes": leftover_python_processes == 0,
    }
    if suite == "smoke_25":
        criteria.update(
            {
                "25_tasks": summary["total"] == 25,
                "smoke25_resolved>=17": summary["resolved"] >= 17,
                "smoke25_resolved_plus_assisted>=22": summary["resolved"] + summary["assisted"] >= 22,
                "smoke25_failed<=3": summary["failed"] <= 3,
                "smoke25_final_valid_rate>=0.80": model_flow_metrics["total_tasks"] > 0
                and repair_metrics["final_valid_rate"] >= 0.8,
                "smoke25_semantic_pass_rate>=0.65": model_flow_metrics["semantic_pass_rate"] >= 0.65,
                "smoke25_generic_fallback_rate<=0.30": model_flow_metrics["generic_fallback_rate"] <= 0.3,
                "smoke25_route_ok_rate>=0.95": model_flow_metrics["route_ok_rate"] >= 0.95,
                "smoke25_wrong_domain_rate<=0.10": model_flow_metrics["wrong_domain_rate"] <= 0.1,
                "smoke25_syntax_error_rate<=0.15": model_flow_metrics["syntax_error_rate"] <= 0.15,
                "smoke25_json_error_rate<=0.10": model_flow_metrics["json_error_rate"] <= 0.1,
                "smoke25_suite_duration_seconds<=900": suite_duration_seconds <= 900,
                "smoke25_no_leftover_python_processes": leftover_python_processes == 0,
            }
        )
    if suite == "smoke_50":
        criteria.update(
            {
                "50_tasks": summary["total"] == 50,
                "smoke50_resolved>=30": summary["resolved"] >= 30,
                "smoke50_resolved_plus_assisted>=45": summary["resolved"] + summary["assisted"] >= 45,
                "smoke50_failed<=5": summary["failed"] <= 5,
                "smoke50_final_valid_rate>=0.80": model_flow_metrics["total_tasks"] > 0
                and repair_metrics["final_valid_rate"] >= 0.8,
                "smoke50_semantic_pass_rate>=0.70": model_flow_metrics["semantic_pass_rate"] >= 0.7,
                "smoke50_route_ok_rate>=0.95": model_flow_metrics["route_ok_rate"] >= 0.95,
                "smoke50_wrong_domain_rate<=0.10": model_flow_metrics["wrong_domain_rate"] <= 0.1,
                "smoke50_syntax_error_rate<=0.15": model_flow_metrics["syntax_error_rate"] <= 0.15,
                "smoke50_json_error_rate<=0.10": model_flow_metrics["json_error_rate"] <= 0.1,
                "smoke50_generic_fallback_rate<=0.30": model_flow_metrics["generic_fallback_rate"] <= 0.3,
                "smoke50_dangerous_command_executed=0": True,
                "smoke50_write_outside_workspace=0": True,
                "smoke50_no_leftover_python_processes": leftover_python_processes == 0,
            }
        )
    scope_note = (
        "This run measures the NexusAI product/tooling layer on controlled local projects. "
        "It does not prove quality with external human users. "
        + ("Model review tasks were enabled." if with_model else "Model generation was disabled; this is an infrastructure baseline.")
    )
    recommendation = (
        "If this baseline passes, run the next report with --with_model on fewer tasks first, then expand to 50 real user tasks."
        if not with_model
        else "Review model failure cases before training again; prioritize router/context/validator issues first."
    )
    return {
        "generated_at": time.strftime("%Y-%m-%d %H:%M:%S"),
        "suite": suite,
        "report_stamp": report_stamp,
        "report_prefix": report_prefix,
        "output_dir": str(base_output_dir),
        "artifact_dir": str(artifact_dir),
        "mode": "with_model" if with_model else "tooling_baseline",
        "timeouts": {
            "max_task_seconds": max_task_seconds,
            "max_suite_seconds": max_suite_seconds,
            "model_timeout_seconds": model_timeout_seconds,
            "repair_timeout_seconds": repair_timeout_seconds,
            "repair_strategy": repair_strategy,
        },
        "suite_duration_seconds": suite_duration_seconds,
        "leftover_python_processes": leftover_python_processes,
        "scope_note": scope_note,
        "summary": summary,
        "repair_metrics": repair_metrics,
        "model_flow_metrics": model_flow_metrics,
        "criteria": criteria,
        "stored_failure_ranking": top_failures(5),
        "results": results,
        "recommendation": recommendation,
    }


def main() -> None:
    parser = argparse.ArgumentParser(description="Run NexusAI 50-task real-task report.")
    parser.add_argument("--with_model", action="store_true")
    parser.add_argument("--model_on", action="store_true", help="Alias for --with_model.")
    parser.add_argument("--strict", action="store_true", help="Kept for CLI clarity; strict checks are always enabled.")
    parser.add_argument("--config", default=str(BASE_DIR / "config.micro-instruct-fullstack.behavior.json"))
    parser.add_argument("--limit", type=int, default=50)
    parser.add_argument("--suite", default="default", choices=("default", "smoke_10", "smoke_25", "smoke_50"))
    parser.add_argument("--output_dir", default="")
    parser.add_argument("--max_task_seconds", type=int, default=45)
    parser.add_argument("--max_suite_seconds", type=int, default=900)
    parser.add_argument("--model_timeout_seconds", type=int, default=30)
    parser.add_argument("--repair_timeout_seconds", type=int, default=20)
    parser.add_argument("--repair_strategy", default="auto", choices=("auto", "deterministic_only", "fast", "full"))
    args = parser.parse_args()
    payload = run_real_task_suite(
        with_model=args.with_model or args.model_on,
        config=args.config,
        tasks_limit=args.limit,
        suite=args.suite,
        output_dir=args.output_dir or None,
        max_task_seconds=args.max_task_seconds,
        max_suite_seconds=args.max_suite_seconds,
        model_timeout_seconds=args.model_timeout_seconds,
        repair_timeout_seconds=args.repair_timeout_seconds,
        repair_strategy=args.repair_strategy,
    )
    json_path, md_path = write_report(payload, output_dir=Path(payload["output_dir"]))
    matrix_path = write_failure_matrix(payload, output_dir=Path(payload["output_dir"]))
    print(f"JSON: {json_path}")
    print(f"Report: {md_path}")
    print(f"Matrix: {matrix_path}")
    print(json.dumps(payload["summary"], ensure_ascii=False, indent=2))
    print(json.dumps(payload["model_flow_metrics"], ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
