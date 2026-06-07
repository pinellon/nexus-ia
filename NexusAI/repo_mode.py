"""Repo mode orchestration for NexusAI."""

from __future__ import annotations

import argparse
import json
from pathlib import Path

from controlled_generate import controlled_generate
from context_budget import apply_context_budget, default_budget_for_project
from failure_store import add_failure
from patch_manager import apply_file_changes, rollback_last
from repo_indexer import build_project_index, read_small_text, resolve_project_dir
from strict_mode import strict_check_text
from task_metrics import finish_session, log_event, start_session
from test_runner import run_project_tests


TASK_KEYWORDS = {
    "login": ["app.py", "routes", "auth", "user", "users", "template", "login"],
    "api": ["app.py", "server", "route", "routes", "controller", "requirements"],
    "site": ["index.html", "style", "css", "public", "template"],
    "html": ["index.html", "template", "public"],
    "css": ["style", ".css"],
    "react": ["app.tsx", "app.jsx", "component", "src"],
    "electron": ["main.ts", "main.js", "preload", "electron"],
    "bug": ["test", "error", "app", "main", "src"],
}


def select_relevant_files(index: dict, request: str, *, limit: int = 8) -> list[str]:
    text = request.lower()
    candidates = list(index.get("important_files", []))
    candidates.extend(file["path"] for file in index.get("files", []) if file.get("important"))
    candidates.extend(file["path"] for file in index.get("files", [])[:120])

    keywords: set[str] = set()
    for trigger, words in TASK_KEYWORDS.items():
        if trigger in text:
            keywords.update(words)
    request_terms = {term.strip(".,:;()[]{}") for term in text.split() if len(term) > 3}
    keywords.update(request_terms)

    scored: list[tuple[int, str]] = []
    seen: set[str] = set()
    for rel in candidates:
        if rel in seen:
            continue
        seen.add(rel)
        lowered = rel.lower()
        score = 0
        if rel in index.get("important_files", []):
            score += 5
        for keyword in keywords:
            if keyword and keyword in lowered:
                score += 3
        if lowered.endswith((".py", ".ts", ".tsx", ".js", ".jsx", ".html", ".css")):
            score += 1
        if score:
            scored.append((score, rel))

    return [rel for _, rel in sorted(scored, key=lambda item: (-item[0], item[1]))[:limit]]


def build_repo_context(project_dir: str | Path, request: str, *, limit: int = 8, max_chars: int | None = None) -> dict:
    root = resolve_project_dir(project_dir)
    index = build_project_index(root)
    selected = select_relevant_files(index, request, limit=limit)
    docs = {}
    for rel in (".nexus/decisions.md", ".nexus/style_guide.md"):
        path = root / rel
        if path.is_file():
            docs[rel] = read_small_text(path, limit=6000)
    files = []
    for rel in selected:
        path = root / rel
        if path.is_file():
            files.append({"path": rel, "content": read_small_text(path, limit=12000)})
    raw_context = {"index": index, "selected_files": selected, "docs": docs, "files": files}
    return apply_context_budget(raw_context, max_chars=max_chars or default_budget_for_project(root))


def repo_prompt(project_dir: str | Path, request: str, context: dict, *, task_type: str = "patch_review") -> str:
    index = context["index"]
    file_blocks = []
    for item in context["files"]:
        file_blocks.append(f"--- FILE: {item['path']} ---\n{item['content']}")
    doc_blocks = []
    for rel, text in context["docs"].items():
        doc_blocks.append(f"--- DOC: {rel} ---\n{text}")
    if task_type == "patch_review":
        mode_instructions = (
            "Voce esta trabalhando em modo repo real. Gere uma resposta de patch review, nao aplique nada sozinho.\n"
            "Inclua arquivos afetados, problema, patch proposto, risco e como testar.\n"
            "Nao invente arquivos que nao aparecem no indice. Se faltar contexto, diga exatamente quais arquivos precisa ler.\n\n"
        )
    else:
        mode_instructions = (
            "Voce esta trabalhando em modo repo real. Use o contexto abaixo apenas para orientar a resposta.\n"
            "Responda ao pedido no formato do tipo controlado, sem aplicar alteracoes sozinho.\n"
            "Nao invente arquivos que nao aparecem no indice. Se faltar contexto, diga exatamente quais arquivos precisa ler.\n\n"
        )
    return (
        mode_instructions
        +
        f"PROJETO: {index['project_name']}\n"
        f"STACK: {', '.join(index.get('stack', [])) or 'unknown'}\n"
        f"ENTRYPOINTS: {json.dumps(index.get('entrypoints', {}), ensure_ascii=False)}\n"
        f"ARQUIVOS_IMPORTANTES: {json.dumps(index.get('important_files', [])[:30], ensure_ascii=False)}\n\n"
        + "\n\n".join(doc_blocks)
        + "\n\n"
        + "\n\n".join(file_blocks)
        + f"\n\nPEDIDO_DO_USUARIO:\n{request}"
    )


def run_repo_task(
    project_dir: str | Path,
    request: str,
    *,
    config: str | Path,
    retries: int = 1,
    use_memory: bool = True,
    task_type: str = "patch_review",
    semantic_task: dict | None = None,
    model_timeout_seconds: int = 0,
    repair_timeout_seconds: int = 0,
    repair_strategy: str = "auto",
) -> dict:
    session_id = start_session(request, project_dir=str(project_dir), command="repo_task")
    context = build_repo_context(project_dir, request)
    log_event(session_id, "context_selected", {"selected_files": context["selected_files"], "stack": context["index"].get("stack", [])})
    prompt = repo_prompt(project_dir, request, context, task_type=task_type)
    result = controlled_generate(
        prompt,
        config=config,
        task_type=task_type,
        max_retries=retries,
        use_memory=use_memory,
        semantic_task=semantic_task,
        model_timeout_seconds=model_timeout_seconds,
        repair_timeout_seconds=repair_timeout_seconds,
        repair_strategy=repair_strategy,
    )
    strict = strict_check_text(result.get("response", ""), require_plan=task_type == "patch_review")
    result["strict"] = strict.__dict__
    log_event(session_id, "generation", {"valid": result["valid"], "errors": result["errors"], "strict": strict.__dict__})
    if not result["valid"]:
        add_failure(
            prompt=prompt,
            bad_response=result["response"],
            failure_type="repo_task_invalid: " + "; ".join(result["errors"]),
            task_type=task_type,
        )
        finish_session(session_id, "failed", result_summary="invalid repo task generation")
    else:
        finish_session(session_id, "resolved" if strict.ok else "assisted", result_summary="repo task generated controlled output")
    return {
        "session_id": session_id,
        "context": {"selected_files": context["selected_files"], "stack": context["index"].get("stack", [])},
        "generation": result,
    }


def main() -> None:
    parser = argparse.ArgumentParser(description="NexusAI repo mode.")
    sub = parser.add_subparsers(dest="cmd", required=True)
    index_cmd = sub.add_parser("index")
    index_cmd.add_argument("project_dir", nargs="?", default=".")
    context_cmd = sub.add_parser("context")
    context_cmd.add_argument("project_dir")
    context_cmd.add_argument("request")
    context_cmd.add_argument("--max_chars", type=int, default=0)
    task_cmd = sub.add_parser("task")
    task_cmd.add_argument("project_dir")
    task_cmd.add_argument("request")
    task_cmd.add_argument("--config", default=str(Path(__file__).parent / "config.micro-instruct-fullstack.behavior.json"))
    task_cmd.add_argument("--retries", type=int, default=1)
    task_cmd.add_argument("--task_type", default="patch_review")
    task_cmd.add_argument("--model_timeout_seconds", type=int, default=0)
    task_cmd.add_argument("--repair_timeout_seconds", type=int, default=0)
    task_cmd.add_argument("--repair_strategy", default="auto", choices=("auto", "deterministic_only", "fast", "full"))
    test_cmd = sub.add_parser("test")
    test_cmd.add_argument("project_dir", nargs="?", default=".")
    rollback_cmd = sub.add_parser("rollback")
    rollback_cmd.add_argument("project_dir", nargs="?", default=".")
    args = parser.parse_args()

    if args.cmd == "index":
        print(json.dumps(build_project_index(args.project_dir), ensure_ascii=False, indent=2))
    elif args.cmd == "context":
        print(json.dumps(build_repo_context(args.project_dir, args.request, max_chars=args.max_chars or None), ensure_ascii=False, indent=2))
    elif args.cmd == "task":
        print(json.dumps(
            run_repo_task(
                args.project_dir,
                args.request,
                config=args.config,
                retries=args.retries,
                task_type=args.task_type,
                model_timeout_seconds=args.model_timeout_seconds,
                repair_timeout_seconds=args.repair_timeout_seconds,
                repair_strategy=args.repair_strategy,
            ),
            ensure_ascii=False,
            indent=2,
        ))
    elif args.cmd == "test":
        print(json.dumps(run_project_tests(args.project_dir), ensure_ascii=False, indent=2))
    elif args.cmd == "rollback":
        print(json.dumps(rollback_last(args.project_dir), ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
