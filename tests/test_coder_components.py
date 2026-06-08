"""Tests for NexusAI v0.1.1 deterministic coder tools."""

from __future__ import annotations

import json
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
NEXUS_DIR = ROOT / "NexusAI"
sys.path.insert(0, str(NEXUS_DIR))

from code_reviewer import review_coder_change  # noqa: E402
from coder_agent import run_coder_task  # noqa: E402
from context_builder import build_context  # noqa: E402
from diff_utils import represent_patch, validate_patch_paths  # noqa: E402
from planner import PLAN_STEP_IDS, create_plan  # noqa: E402
from repo_indexer import build_project_index  # noqa: E402
from test_suggester import suggest_tests  # noqa: E402


class CoderComponentsTest(unittest.TestCase):
    def make_project(self) -> tempfile.TemporaryDirectory:
        tmp = tempfile.TemporaryDirectory()
        root = Path(tmp.name)
        (root / ".git").mkdir()
        (root / ".git" / "config").write_text("secret", encoding="utf-8")
        (root / "node_modules" / "leftpad").mkdir(parents=True)
        (root / "node_modules" / "leftpad" / "index.js").write_text("module.exports = 1", encoding="utf-8")
        (root / "NexusAI").mkdir()
        (root / "NexusAI" / "app.py").write_text("def health():\n    return 'ok'\n", encoding="utf-8")
        (root / "NexusAI" / "test_controlled_components.py").write_text("import unittest\n", encoding="utf-8")
        (root / "src").mkdir()
        (root / "src" / "server.ts").write_text("export const ok = true;\n", encoding="utf-8")
        (root / "package.json").write_text('{"scripts":{"test":"vitest run"}}\n', encoding="utf-8")
        (root / "README.md").write_text("# Demo\n", encoding="utf-8")
        return tmp

    def test_repo_indexer_ignores_git_and_node_modules(self) -> None:
        with self.make_project() as tmp:
            index = build_project_index(tmp)
            paths = {item["path"] for item in index["files"]}
            self.assertIn("NexusAI/app.py", paths)
            self.assertIn("package.json", paths)
            self.assertNotIn(".git/config", paths)
            self.assertNotIn("node_modules/leftpad/index.js", paths)
            app_info = next(item for item in index["files"] if item["path"] == "NexusAI/app.py")
            self.assertEqual(app_info["extension"], ".py")
            self.assertEqual(app_info["probable_type"], "python")
            self.assertIn("summary", app_info)

    def test_context_builder_selects_relevant_files(self) -> None:
        with self.make_project() as tmp:
            context = build_context(tmp, "add validation in app.py and suggest python tests")
            paths = [item["path"] for item in context["selected_files"]]
            self.assertIn("NexusAI/app.py", paths)
            self.assertTrue(all(item["priority"] > 0 for item in context["selected_files"]))
            self.assertTrue(any("path matches" in item["reason"] or "python" in item["reason"] for item in context["selected_files"]))

    def test_planner_returns_structured_steps(self) -> None:
        with self.make_project() as tmp:
            plan = create_plan(tmp, "add validation for dangerous commands")
            self.assertEqual([step["id"] for step in plan["steps"]], PLAN_STEP_IDS)
            self.assertIn("selected_files", plan)

    def test_diff_utils_blocks_dangerous_path(self) -> None:
        with self.make_project() as tmp:
            result = validate_patch_paths(tmp, [{"path": ".env", "content": "TOKEN=1"}])
            self.assertFalse(result["ok"])
            patch = represent_patch(tmp, [{"path": "scripts/run.sh", "before": "", "after": "rm -rf .\n"}])
            self.assertFalse(patch["ok"])
            self.assertFalse(patch["auto_applied"])

    def test_code_reviewer_detects_high_risk(self) -> None:
        with self.make_project() as tmp:
            review = review_coder_change(
                tmp,
                task="delete everything with rm -rf",
                selected_files=[".env"],
                changes=[{"path": ".env", "content": "SECRET=1"}],
                suggested_tests=[],
            )
            self.assertEqual(review["severity"], "high")
            self.assertEqual(review["recommendation"], "block")

    def test_test_suggester_suggests_python_and_node_tests(self) -> None:
        with self.make_project() as tmp:
            commands = suggest_tests(tmp, "update python and typescript files", ["NexusAI/app.py", "src/server.ts"])
            self.assertIn("python -m py_compile NexusAI/*.py", commands)
            self.assertIn("cd NexusAI && python -m unittest test_controlled_components.py", commands)
            self.assertIn("npm run typecheck", commands)
            self.assertIn("npm run build", commands)
            self.assertIn("npm test", commands)

    def test_coder_agent_returns_complete_json_without_auto_apply(self) -> None:
        with self.make_project() as tmp:
            result = run_coder_task(tmp, "review project structure and suggest tests")
            self.assertEqual(result["auto_applied"], False)
            self.assertIn("selected_files", result)
            self.assertIn("plan", result)
            self.assertIn("suggested_tests", result)
            self.assertIn("risks", result)
            self.assertIn(result["final_status"], {"ready_for_review", "needs_context", "blocked"})

    def test_repo_mode_cli_index_plan_and_coder_task(self) -> None:
        with self.make_project() as tmp:
            commands = [
                [sys.executable, str(NEXUS_DIR / "repo_mode.py"), "index", "--root", tmp],
                [sys.executable, str(NEXUS_DIR / "repo_mode.py"), "plan", "--root", tmp, "--task", "add validation"],
                [sys.executable, str(NEXUS_DIR / "repo_mode.py"), "coder-task", "--root", tmp, "--task", "review project"],
            ]
            for command in commands:
                with self.subTest(command=command):
                    completed = subprocess.run(command, cwd=ROOT, text=True, capture_output=True, check=True)
                    parsed = json.loads(completed.stdout)
                    self.assertIsInstance(parsed, dict)


if __name__ == "__main__":
    unittest.main()
