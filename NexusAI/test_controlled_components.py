"""Smoke tests for NexusAI controlled production components."""

from __future__ import annotations

import unittest
import tempfile
from pathlib import Path

from app import app
from command_sandbox import is_command_allowed
from failure_ranking import top_failures
from git_tools import commit_message_from_diff
from dependency_guard import added_dependencies
from failure_store import ensure_failures_table
from patch_manager import apply_file_changes, rollback_last
from project_docs import generate_project_docs
from preview_writer import write_html_preview
from repo_indexer import build_project_index
from repo_mode import build_repo_context
from strict_mode import strict_check_text
from task_metrics import finish_session, log_event, replay_session, start_session, task_success_summary
from test_runner import run_project_tests
from task_router import classify_task
from validators import validate_output
from controlled_generate import deterministic_patch_review


class ControlledComponentsTest(unittest.TestCase):
    def test_task_router(self) -> None:
        cases = {
            "cria um site bonito pra uma barbearia": "site_html",
            "faz uma api flask de cadastro": "flask_api",
            "cria um componente react de produto": "react_component",
            "faz app electron seguro": "electron_app",
            "gere um patch revisavel": "patch_review",
            "explique esse erro: ModuleNotFoundError: No module named flask": "explain_error",
        }
        for prompt, expected in cases.items():
            with self.subTest(prompt=prompt):
                self.assertEqual(classify_task(prompt), expected)

    def test_validators_accept_good_outputs(self) -> None:
        html = "<!DOCTYPE html><html><head><title>x</title></head><body><h1>Oi</h1></body></html>"
        flask = (
            "from flask import Flask, jsonify\n"
            "app = Flask(__name__)\n"
            "@app.route('/health')\n"
            "def health():\n"
            "    return jsonify({'ok': True})\n"
        )
        electron = (
            "const win = new BrowserWindow({ webPreferences: { "
            "contextIsolation: true, nodeIntegration: false, preload: preloadPath } });"
        )
        patch = "Arquivos afetados:\n- app.py\n\nProblema:\nBug.\n\nMudança proposta:\nCorrigir a função.\n\nRisco:\nBaixo.\n\nComo testar:\npytest"
        self.assertTrue(validate_output("site_html", html).valid)
        self.assertTrue(validate_output("flask_api", flask).valid)
        self.assertTrue(validate_output("electron_app", electron).valid)
        self.assertTrue(validate_output("patch_review", patch).valid)
        self.assertFalse(validate_output("patch_review", "Problema:\n...").valid)
        fallback = deterministic_patch_review(
            "--- FILE: index.html ---\n<html></html>\n\nPEDIDO_DO_USUARIO:\nadicione uma secao de depoimentos na landing page",
            ["missing patch review section: problema"],
        )
        self.assertTrue(validate_output("patch_review", fallback, original_prompt="landing page html").valid)

    def test_preview_writer(self) -> None:
        html = "<!DOCTYPE html><html><head><title>x</title></head><body><h1>Oi</h1></body></html>"
        result = write_html_preview(html, name="unit smoke")
        self.assertTrue(result["created"])
        self.assertTrue(result["path"].endswith("index.html"))

    def test_failure_store_init(self) -> None:
        ensure_failures_table()

    def test_flask_validation_routes(self) -> None:
        client = app.test_client()
        self.assertEqual(client.get("/health").status_code, 200)
        self.assertEqual(client.get("/openapi.json").status_code, 200)
        self.assertEqual(client.post("/generate-controlled", json={}).status_code, 400)
        self.assertEqual(client.post("/repo/apply", json={"project_dir": ".", "changes": []}).status_code, 403)

    def test_repo_mode_index_patch_test_and_rollback(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            app_file = root / "app.py"
            app_file.write_text("def health():\n    return 'ok'\n", encoding="utf-8")
            (root / "requirements.txt").write_text("flask\n", encoding="utf-8")

            index = build_project_index(root)
            self.assertIn("python", index["stack"])
            context = build_repo_context(root, "adicione rota health")
            self.assertIn("app.py", context["selected_files"])
            test_result = run_project_tests(root)
            self.assertTrue(test_result["ok"])

            apply_file_changes(root, [{"path": "app.py", "content": "def health():\n    return 'changed'\n"}])
            self.assertIn("changed", app_file.read_text(encoding="utf-8"))
            rollback = rollback_last(root)
            self.assertTrue(rollback["rolled_back"])
            self.assertNotIn("changed", app_file.read_text(encoding="utf-8"))

            client = app.test_client()
            apply_resp = client.post(
                "/repo/apply",
                json={
                    "project_dir": str(root),
                    "approved": True,
                    "reason": "unit test",
                    "changes": [{"path": "app.py", "content": "def health():\n    return 'api'\n"}],
                },
            )
            self.assertEqual(apply_resp.status_code, 200)
            self.assertIn("api", app_file.read_text(encoding="utf-8"))
            rollback_resp = client.post("/repo/rollback", json={"project_dir": str(root)})
            self.assertEqual(rollback_resp.status_code, 200)

    def test_dependency_guard_blocks_new_requirements(self) -> None:
        self.assertEqual(added_dependencies("requirements.txt", "flask\n", "flask\nrequests\n"), ["requests"])
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            (root / "requirements.txt").write_text("flask\n", encoding="utf-8")
            with self.assertRaises(ValueError):
                apply_file_changes(root, [{"path": "requirements.txt", "content": "flask\nrequests\n"}])

    def test_patch_manager_blocks_sensitive_paths_and_rolls_back_created_files(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            for rel in (".env", ".git/config", "node_modules/pkg/index.js", "NexusAI/memory/audit_log.jsonl", "../escape.txt"):
                with self.subTest(rel=rel):
                    with self.assertRaises(ValueError):
                        apply_file_changes(root, [{"path": rel, "content": "blocked\n"}])

            patch = apply_file_changes(root, [{"path": "created.txt", "content": "hello\n"}])
            self.assertTrue((root / "created.txt").is_file())
            rollback = rollback_last(root)
            self.assertTrue(rollback["rolled_back"])
            self.assertFalse((root / "created.txt").exists())
            second = rollback_last(root)
            self.assertFalse(second["rolled_back"])
            self.assertTrue(second.get("already_rolled_back"))

    def test_metrics_replay_strict_and_sandbox(self) -> None:
        session_id = start_session("teste real", project_dir=".")
        log_event(session_id, "files_read", {"files": ["app.py"]})
        finish_session(session_id, "resolved", result_summary="ok")
        replay = replay_session(session_id)
        self.assertEqual(replay["session"]["status"], "resolved")
        self.assertGreaterEqual(task_success_summary()["total"], 1)
        self.assertFalse(strict_check_text("codigo ...", require_plan=False).ok)
        self.assertTrue(is_command_allowed("python -m py_compile app.py")[0])
        self.assertFalse(is_command_allowed("rm -rf .")[0])

    def test_project_docs_git_helpers_and_api_metrics(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            (root / "app.py").write_text(
                "from flask import Flask\napp = Flask(__name__)\n@app.route('/health')\ndef health():\n    return 'ok'\n",
                encoding="utf-8",
            )
            docs = generate_project_docs(root)
            self.assertTrue(any(path.endswith("project_summary.md") for path in docs["written"]))
            self.assertEqual(commit_message_from_diff("diff --git a/app.py b/app.py\n+fix"), "fix: update app.py")
            client = app.test_client()
            self.assertEqual(client.get("/metrics/tasks").status_code, 200)
            self.assertEqual(client.get("/failures/ranking").status_code, 200)
            self.assertEqual(client.post("/command", json={"project_dir": str(root), "command": "/analyze-project"}).status_code, 200)
            self.assertIsInstance(top_failures(), list)


if __name__ == "__main__":
    unittest.main()
