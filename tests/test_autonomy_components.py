"""Unit tests for NexusAI controlled autonomy v0.3 Step 1.

Covers:
- Task queue: UUID creation, status transitions, list/get/update
- Autonomy plan: mutable → requires_approval, action_type validation
- Approval gate: approve/reject/request_changes, is_approved, default blocked
- Audit log: event writing and secret sanitisation
- Controller: JSON responses, auto_applied always False
- CLI: autonomy-plan returns task_id; approve/cancel work with real IDs
"""

from __future__ import annotations

import json
import os
import sys
import tempfile
import unittest
import uuid
from pathlib import Path
from unittest.mock import patch

# -----------------------------------------------------------------------
# Ensure NexusAI package is importable
# -----------------------------------------------------------------------
_NEXUS_DIR = Path(__file__).parent.parent / "NexusAI"
if str(_NEXUS_DIR) not in sys.path:
    sys.path.insert(0, str(_NEXUS_DIR))


# -----------------------------------------------------------------------
# Helpers: use a temp dir so tests don't pollute real memory files
# -----------------------------------------------------------------------

def _patch_memory(tmp_dir: str):
    """Return a context-manager that redirects memory I/O to tmp_dir."""
    from unittest.mock import patch as _patch
    tmp = Path(tmp_dir)
    (tmp / "memory").mkdir(parents=True, exist_ok=True)
    return _patch.multiple(
        "task_queue",
        _MEMORY_DIR=tmp / "memory",
        _QUEUE_FILE=tmp / "memory" / "task_queue.json",
    )


# -----------------------------------------------------------------------
# Task Queue Tests
# -----------------------------------------------------------------------

class TestTaskQueue(unittest.TestCase):

    def setUp(self):
        import task_queue as tq
        # Fresh queue backed by a temp file
        self.tmp = tempfile.mkdtemp()
        self._orig_dir = tq._MEMORY_DIR
        self._orig_file = tq._QUEUE_FILE
        tq._MEMORY_DIR = Path(self.tmp) / "memory"
        tq._QUEUE_FILE = tq._MEMORY_DIR / "task_queue.json"
        tq._default_queue = None  # reset singleton

    def tearDown(self):
        import task_queue as tq
        tq._MEMORY_DIR = self._orig_dir
        tq._QUEUE_FILE = self._orig_file
        tq._default_queue = None

    def test_create_task_returns_uuid_v4(self):
        import task_queue as tq
        q = tq.TaskQueue()
        task = q.create_task("do something")
        tid = task["task_id"]
        # Must parse as a valid UUID
        parsed = uuid.UUID(tid, version=4)
        self.assertEqual(str(parsed), tid)

    def test_create_task_initial_status_pending(self):
        import task_queue as tq
        q = tq.TaskQueue()
        task = q.create_task("initial status check")
        self.assertEqual(task["status"], tq.TaskStatus.PENDING.value)

    def test_get_task_returns_copy(self):
        import task_queue as tq
        q = tq.TaskQueue()
        task = q.create_task("get copy")
        fetched = q.get_task(task["task_id"])
        self.assertIsNotNone(fetched)
        self.assertEqual(fetched["task_id"], task["task_id"])

    def test_get_task_missing_returns_none(self):
        import task_queue as tq
        q = tq.TaskQueue()
        self.assertIsNone(q.get_task("not-a-real-id"))

    def test_update_status_valid_transition(self):
        import task_queue as tq
        q = tq.TaskQueue()
        task = q.create_task("transition test")
        updated = q.update_status(task["task_id"], tq.TaskStatus.PLANNED)
        self.assertEqual(updated["status"], tq.TaskStatus.PLANNED.value)

    def test_update_status_invalid_transition_raises(self):
        import task_queue as tq
        q = tq.TaskQueue()
        task = q.create_task("invalid transition")
        with self.assertRaises(ValueError):
            q.update_status(task["task_id"], tq.TaskStatus.COMPLETED)

    def test_list_tasks_all(self):
        import task_queue as tq
        q = tq.TaskQueue()
        q.create_task("task A")
        q.create_task("task B")
        tasks = q.list_tasks()
        self.assertEqual(len(tasks), 2)

    def test_list_tasks_filtered_by_status(self):
        import task_queue as tq
        q = tq.TaskQueue()
        t1 = q.create_task("pending task")
        q.create_task("another pending task")
        q.update_status(t1["task_id"], tq.TaskStatus.CANCELLED)
        cancelled = q.list_tasks(tq.TaskStatus.CANCELLED)
        self.assertEqual(len(cancelled), 1)

    def test_save_and_load_round_trip(self):
        import task_queue as tq
        q = tq.TaskQueue()
        task = q.create_task("persist me")
        q.save()
        q2 = tq.TaskQueue()
        fetched = q2.get_task(task["task_id"])
        self.assertIsNotNone(fetched)
        self.assertEqual(fetched["prompt"], "persist me")

    def test_task_id_is_not_sequential(self):
        import task_queue as tq
        q = tq.TaskQueue()
        ids = {q.create_task(f"task {i}")["task_id"] for i in range(5)}
        # None of them should be "1", "2", "3", etc.
        self.assertNotIn("1", ids)
        self.assertNotIn("2", ids)
        self.assertEqual(len(ids), 5)  # all unique


# -----------------------------------------------------------------------
# Autonomy Plan Tests
# -----------------------------------------------------------------------

class TestAutonomyPlan(unittest.TestCase):

    def test_mutable_step_forces_requires_approval(self):
        from autonomy_plan import PlanStep
        step = PlanStep(description="write file", action_type="write_request", mutable=True, requires_approval=False)
        self.assertTrue(step.requires_approval, "mutable step must require approval")

    def test_patch_proposal_is_inherently_mutable(self):
        from autonomy_plan import PlanStep
        step = PlanStep(description="propose patch", action_type="patch_proposal")
        self.assertTrue(step.mutable)
        self.assertTrue(step.requires_approval)

    def test_read_only_step_not_mutable(self):
        from autonomy_plan import PlanStep
        step = PlanStep(description="read file", action_type="read_only")
        self.assertFalse(step.mutable)
        self.assertFalse(step.requires_approval)

    def test_invalid_action_type_raises(self):
        from autonomy_plan import PlanStep
        with self.assertRaises(ValueError):
            PlanStep(description="bad", action_type="make_coffee")

    def test_step_id_is_uuid(self):
        from autonomy_plan import PlanStep
        step = PlanStep(description="check uuid", action_type="analysis")
        parsed = uuid.UUID(step.step_id, version=4)
        self.assertEqual(str(parsed), step.step_id)

    def test_plan_serialisation_round_trip(self):
        from autonomy_plan import AutonomyPlan, PlanStep
        plan = AutonomyPlan(task_id="test-task-id")
        plan.add_step("read files", "read_only")
        plan.add_step("propose patch", "patch_proposal")
        data = plan.to_dict()
        plan2 = AutonomyPlan.from_dict(data)
        self.assertEqual(len(plan2.steps), 2)
        self.assertTrue(plan2.steps[1].mutable)

    def test_build_default_plan_has_mutable_steps_for_add_task(self):
        from autonomy_plan import build_default_plan
        plan = build_default_plan("fake-task-id", "add validation for dangerous commands")
        mutable = [s for s in plan.steps if s.mutable]
        self.assertGreater(len(mutable), 0, "Expected at least one mutable step for an 'add' task")

    def test_build_default_plan_all_mutable_require_approval(self):
        from autonomy_plan import build_default_plan
        plan = build_default_plan("fake-task-id", "update configuration file")
        for step in plan.steps:
            if step.mutable:
                self.assertTrue(step.requires_approval, f"Step {step.description!r} is mutable but does not require approval")


# -----------------------------------------------------------------------
# Approval Gate Tests
# -----------------------------------------------------------------------

class TestApprovalGate(unittest.TestCase):

    def _fresh_gate(self):
        from approval_gate import ApprovalGate
        return ApprovalGate()

    def test_default_is_not_approved(self):
        gate = self._fresh_gate()
        self.assertFalse(gate.is_approved("task-1", "step-1"))

    def test_approve_returns_approved_decision(self):
        gate = self._fresh_gate()
        result = gate.approve("task-1", "step-1", reason="looks good")
        self.assertEqual(result["decision"], "approved")
        self.assertTrue(result["is_approved"])

    def test_approve_auto_applied_is_false(self):
        gate = self._fresh_gate()
        result = gate.approve("task-1", "step-1")
        self.assertFalse(result["auto_applied"])

    def test_is_approved_after_approve(self):
        gate = self._fresh_gate()
        gate.approve("task-1", "step-1")
        self.assertTrue(gate.is_approved("task-1", "step-1"))

    def test_reject_blocks_step(self):
        gate = self._fresh_gate()
        result = gate.reject("task-1", "step-1", reason="not safe")
        self.assertEqual(result["decision"], "rejected")
        self.assertFalse(result["is_approved"])
        self.assertFalse(gate.is_approved("task-1", "step-1"))

    def test_request_changes_records_state(self):
        gate = self._fresh_gate()
        result = gate.request_changes("task-1", "step-1", reason="needs redesign")
        self.assertEqual(result["decision"], "changes_requested")
        self.assertFalse(result["is_approved"])

    def test_get_decision_no_decision(self):
        gate = self._fresh_gate()
        d = gate.get_decision("task-x", "step-x")
        self.assertEqual(d["decision"], "pending")
        self.assertFalse(d["is_approved"])

    def test_approve_does_not_execute_action(self):
        """After approve(), no side-effect functions should have been called."""
        gate = self._fresh_gate()
        # We verify by checking there is no 'execute' or 'apply' attribute triggered
        with patch("builtins.open", side_effect=Exception("should not open files")) as mock_open:
            # approve() should NOT open any files (only audit_log does)
            # We override audit_log to prevent it from writing
            with patch("audit_log._write_entry"):
                gate.approve("task-1", "step-1")
        # If we reach here, no unexpected file I/O happened during approve itself


# -----------------------------------------------------------------------
# Audit Log Tests
# -----------------------------------------------------------------------

class TestAuditLog(unittest.TestCase):

    def setUp(self):
        import audit_log as al
        self.tmp = tempfile.mkdtemp()
        self._orig_dir = al._MEMORY_DIR
        self._orig_file = al._LOG_FILE
        al._MEMORY_DIR = Path(self.tmp) / "memory"
        al._LOG_FILE = al._MEMORY_DIR / "audit_log.jsonl"

    def tearDown(self):
        import audit_log as al
        al._MEMORY_DIR = self._orig_dir
        al._LOG_FILE = self._orig_file

    def test_log_event_creates_file(self):
        import audit_log as al
        al.log_event("task_created", task_id="t1")
        self.assertTrue(al._LOG_FILE.is_file())

    def test_list_events_empty_when_no_file(self):
        import audit_log as al
        events = al.list_events()
        self.assertEqual(events, [])

    def test_log_and_list_round_trip(self):
        import audit_log as al
        al.log_event("task_created", task_id="t1", details={"prompt": "do thing"})
        events = al.list_events(task_id="t1")
        self.assertEqual(len(events), 1)
        self.assertEqual(events[0]["event_type"], "task_created")

    def test_sanitises_password(self):
        import audit_log as al
        al.log_event("task_created", task_id="t2", details={"password": "supersecret"})
        events = al.list_events(task_id="t2")
        self.assertEqual(events[0]["details"]["password"], "****")

    def test_sanitises_token(self):
        import audit_log as al
        al.log_event("task_created", task_id="t3", details={"token": "abc123", "prompt": "safe"})
        events = al.list_events(task_id="t3")
        self.assertEqual(events[0]["details"]["token"], "****")
        self.assertEqual(events[0]["details"]["prompt"], "safe")

    def test_sanitises_all_secret_keys(self):
        import audit_log as al
        secret_fields = {
            "token": "t", "secret": "s", "password": "p", "api_key": "a",
            "private_key": "pk", "credential": "c", "authorization": "auth",
            "access_token": "at", "refresh_token": "rt",
        }
        al.log_event("task_created", task_id="t4", details=secret_fields)
        events = al.list_events(task_id="t4")
        for key in secret_fields:
            self.assertEqual(events[0]["details"][key], "****", f"Key {key!r} was not sanitised")

    def test_safe_fields_not_redacted(self):
        import audit_log as al
        al.log_event("task_created", task_id="t5", details={"prompt": "hello", "step_count": 3})
        events = al.list_events(task_id="t5")
        self.assertEqual(events[0]["details"]["prompt"], "hello")
        self.assertEqual(events[0]["details"]["step_count"], 3)

    def test_invalid_event_type_raises(self):
        import audit_log as al
        with self.assertRaises(ValueError):
            al.log_event("fake_event_xyz", task_id="t6")

    def test_filter_by_task_id(self):
        import audit_log as al
        al.log_event("task_created", task_id="t-a")
        al.log_event("task_created", task_id="t-b")
        events = al.list_events(task_id="t-a")
        self.assertEqual(len(events), 1)
        self.assertEqual(events[0]["task_id"], "t-a")


# -----------------------------------------------------------------------
# Autonomy Controller Tests
# -----------------------------------------------------------------------

class TestAutonomyController(unittest.TestCase):

    def setUp(self):
        import task_queue as tq
        import audit_log as al
        import autonomy_controller as ac
        self.tmp = tempfile.mkdtemp()
        # Redirect memory files
        tq._MEMORY_DIR = Path(self.tmp) / "memory"
        tq._QUEUE_FILE = tq._MEMORY_DIR / "task_queue.json"
        tq._default_queue = None
        al._MEMORY_DIR = Path(self.tmp) / "memory"
        al._LOG_FILE = al._MEMORY_DIR / "audit_log.jsonl"
        ac._MEMORY_DIR = Path(self.tmp) / "memory"
        ac._PLANS_FILE = ac._MEMORY_DIR / "autonomy_plans.json"
        ac._default_controller = None

    def tearDown(self):
        import task_queue as tq
        import audit_log as al
        import autonomy_controller as ac
        from pathlib import Path
        tq._MEMORY_DIR = Path(_NEXUS_DIR) / "memory"
        tq._QUEUE_FILE = tq._MEMORY_DIR / "task_queue.json"
        tq._default_queue = None
        al._MEMORY_DIR = Path(_NEXUS_DIR) / "memory"
        al._LOG_FILE = al._MEMORY_DIR / "audit_log.jsonl"
        ac._MEMORY_DIR = Path(_NEXUS_DIR) / "memory"
        ac._PLANS_FILE = ac._MEMORY_DIR / "autonomy_plans.json"
        ac._default_controller = None

    def _fresh_controller(self):
        from autonomy_controller import AutonomyController
        return AutonomyController()

    def _first_mutable_step(self, result, action_type=None):
        for step in result["steps"]:
            if step.get("mutable") and (action_type is None or step.get("action_type") == action_type):
                return step
        self.fail(f"No mutable step found for action_type={action_type!r}")

    def test_create_task_and_plan_returns_uuid_task_id(self):
        ctrl = self._fresh_controller()
        result = ctrl.create_task_and_plan("add input validation")
        tid = result["task_id"]
        parsed = uuid.UUID(tid, version=4)
        self.assertEqual(str(parsed), tid)

    def test_auto_applied_always_false_after_plan(self):
        ctrl = self._fresh_controller()
        result = ctrl.create_task_and_plan("fix bug")
        self.assertFalse(result["auto_applied"])

    def test_auto_applied_always_false_after_approve(self):
        ctrl = self._fresh_controller()
        plan_result = ctrl.create_task_and_plan("refactor module")
        task_id = plan_result["task_id"]
        steps = plan_result["steps"]
        # Find a mutable step
        mutable_steps = [s for s in steps if s.get("mutable")]
        if mutable_steps:
            step_id = mutable_steps[0]["step_id"]
            approve_result = ctrl.approve_step(task_id, step_id, reason="test approval")
            self.assertFalse(approve_result["auto_applied"])

    def test_mutable_step_starts_waiting_approval(self):
        ctrl = self._fresh_controller()
        result = ctrl.create_task_and_plan("update config file")
        mutable = [s for s in result["steps"] if s.get("mutable")]
        for step in mutable:
            self.assertEqual(step["status"], "waiting_approval",
                             f"Mutable step {step['step_id']!r} should be waiting_approval, not {step['status']!r}")

    def test_approve_changes_step_to_approved_not_running(self):
        ctrl = self._fresh_controller()
        result = ctrl.create_task_and_plan("add feature")
        mutable = [s for s in result["steps"] if s.get("mutable")]
        if mutable:
            step_id = mutable[0]["step_id"]
            ctrl.approve_step(result["task_id"], step_id, reason="approved")
            status_result = ctrl.get_status(result["task_id"])
            approved_step = next(s for s in status_result["steps"] if s["step_id"] == step_id)
            self.assertEqual(approved_step["status"], "approved")
            # Must NOT be running – approval never triggers execution
            self.assertNotEqual(approved_step["status"], "running")

    def test_cancel_task_marks_cancelled(self):
        ctrl = self._fresh_controller()
        result = ctrl.create_task_and_plan("task to cancel")
        task_id = result["task_id"]
        cancel_result = ctrl.cancel_task(task_id, reason="testing cancellation")
        self.assertFalse(cancel_result["auto_applied"])
        self.assertEqual(cancel_result["action"], "cancelled")
        status = ctrl.get_status(task_id)
        self.assertEqual(status["status"], "cancelled")

    def test_without_approval_mutable_step_not_approved(self):
        ctrl = self._fresh_controller()
        result = ctrl.create_task_and_plan("delete old files")
        for step in result["steps"]:
            if step.get("mutable"):
                self.assertFalse(step.get("is_approved", False),
                                 "Mutable step should not be approved without explicit approval call")

    def test_reject_step_blocks_it(self):
        ctrl = self._fresh_controller()
        result = ctrl.create_task_and_plan("deploy to production")
        mutable = [s for s in result["steps"] if s.get("mutable")]
        if mutable:
            step_id = mutable[0]["step_id"]
            reject_result = ctrl.reject_step(result["task_id"], step_id, reason="too risky")
            self.assertEqual(reject_result["action"], "rejected")
            self.assertFalse(reject_result["auto_applied"])
            # Step should be cancelled now
            status = ctrl.get_status(result["task_id"])
            rejected_step = next(s for s in status["steps"] if s["step_id"] == step_id)
            self.assertEqual(rejected_step["status"], "cancelled")

    def test_get_status_returns_auto_applied_false(self):
        ctrl = self._fresh_controller()
        result = ctrl.create_task_and_plan("analyse code")
        status = ctrl.get_status(result["task_id"])
        self.assertFalse(status["auto_applied"])

    def test_audit_log_records_task_created(self):
        import audit_log as al
        ctrl = self._fresh_controller()
        result = ctrl.create_task_and_plan("log test task")
        task_id = result["task_id"]
        events = al.list_events(task_id=task_id)
        event_types = [e["event_type"] for e in events]
        self.assertIn("task_created", event_types)
        self.assertIn("plan_created", event_types)

    def test_audit_log_records_approval_granted(self):
        import audit_log as al
        ctrl = self._fresh_controller()
        result = ctrl.create_task_and_plan("audit approval test")
        task_id = result["task_id"]
        mutable = [s for s in result["steps"] if s.get("mutable")]
        if mutable:
            step_id = mutable[0]["step_id"]
            ctrl.approve_step(task_id, step_id, reason="audit test")
            events = al.list_events(task_id=task_id)
            event_types = [e["event_type"] for e in events]
            self.assertIn("approval_granted", event_types)

    def test_execute_approved_patch_creates_snapshot_and_audit_log(self):
        import audit_log as al
        ctrl = self._fresh_controller()
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            app_file = root / "app.py"
            app_file.write_text("def health():\n    return 'ok'\n", encoding="utf-8")
            plan = ctrl.create_task_and_plan("add validation")
            step = self._first_mutable_step(plan, "patch_proposal")
            ctrl.approve_step(plan["task_id"], step["step_id"], reason="approved for test")

            result = ctrl.execute_approved_step(
                plan["task_id"],
                step["step_id"],
                root=str(root),
                payload={"changes": [{"path": "app.py", "content": "def health():\n    return 'changed'\n"}]},
                reason="unit test patch",
            )

            self.assertTrue(result["ok"])
            self.assertFalse(result["auto_applied"])
            self.assertIn("changed", app_file.read_text(encoding="utf-8"))
            self.assertTrue((root / ".nexus" / "patch_history.json").is_file())
            events = al.list_events(task_id=plan["task_id"])
            event_types = [event["event_type"] for event in events]
            self.assertIn("snapshot_created", event_types)
            self.assertIn("patch_applied", event_types)

    def test_execute_unapproved_step_is_blocked(self):
        ctrl = self._fresh_controller()
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            (root / "app.py").write_text("def health():\n    return 'ok'\n", encoding="utf-8")
            plan = ctrl.create_task_and_plan("add validation")
            step = self._first_mutable_step(plan, "patch_proposal")

            result = ctrl.execute_approved_step(
                plan["task_id"],
                step["step_id"],
                root=str(root),
                payload={"changes": [{"path": "app.py", "content": "changed\n"}]},
            )

            self.assertFalse(result["ok"])
            self.assertTrue(result["blocked"])
            self.assertIn("approval", result["error"].lower())

    def test_execute_patch_rolls_back_when_verification_fails(self):
        ctrl = self._fresh_controller()
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            app_file = root / "app.py"
            app_file.write_text("def health():\n    return 'ok'\n", encoding="utf-8")
            plan = ctrl.create_task_and_plan("add validation")
            step = self._first_mutable_step(plan, "patch_proposal")
            ctrl.approve_step(plan["task_id"], step["step_id"], reason="approved for rollback test")

            result = ctrl.execute_approved_step(
                plan["task_id"],
                step["step_id"],
                root=str(root),
                payload={
                    "changes": [{"path": "app.py", "content": "def broken(:\n"}],
                    "verify_command": "python -m py_compile app.py",
                },
            )

            self.assertFalse(result["ok"])
            self.assertIsNotNone(result["rollback"])
            self.assertTrue(result["rollback"]["rolled_back"])
            self.assertIn("return 'ok'", app_file.read_text(encoding="utf-8"))

    def test_execute_sandboxed_command_allowed_and_dangerous_blocked(self):
        ctrl = self._fresh_controller()
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            (root / "app.py").write_text("def health():\n    return 'ok'\n", encoding="utf-8")
            plan = ctrl.create_task_and_plan("run command")
            step = self._first_mutable_step(plan, "command_request")
            ctrl.approve_step(plan["task_id"], step["step_id"], reason="approved command")

            allowed = ctrl.execute_approved_step(
                plan["task_id"],
                step["step_id"],
                root=str(root),
                payload={"command": "python -m py_compile app.py"},
            )
            self.assertTrue(allowed["ok"])

            plan2 = ctrl.create_task_and_plan("run command")
            step2 = self._first_mutable_step(plan2, "command_request")
            ctrl.approve_step(plan2["task_id"], step2["step_id"], reason="approved command")
            blocked = ctrl.execute_approved_step(
                plan2["task_id"],
                step2["step_id"],
                root=str(root),
                payload={"command": "rm -rf ."},
            )
            self.assertFalse(blocked["ok"])
            self.assertIn("blocked", blocked["error"])

    def test_autonomy_execute_api_requires_approved_true(self):
        from app import app
        client = app.test_client()
        response = client.post(
            "/repo/autonomy/execute",
            json={
                "project_dir": ".",
                "task_id": "task",
                "step_id": "step",
                "approved": False,
                "changes": [{"path": "app.py", "content": ""}],
            },
        )
        self.assertEqual(response.status_code, 403)


# -----------------------------------------------------------------------
# CLI Tests (subprocess-level)
# -----------------------------------------------------------------------

class TestCLI(unittest.TestCase):
    """Tests that invoke repo_mode.py as a subprocess and verify JSON output."""

    def _run(self, args: list[str]) -> dict:
        import subprocess
        cmd = [sys.executable, str(_NEXUS_DIR / "repo_mode.py")] + args
        result = subprocess.run(cmd, capture_output=True, text=True, cwd=str(_NEXUS_DIR))
        try:
            return json.loads(result.stdout)
        except json.JSONDecodeError:
            self.fail(
                f"CLI did not return valid JSON.\nSTDOUT:\n{result.stdout}\nSTDERR:\n{result.stderr}"
            )

    def test_autonomy_plan_returns_uuid_task_id(self):
        data = self._run(["autonomy-plan", "--task", "add validation for dangerous commands", "--root", "."])
        self.assertIn("task_id", data)
        parsed = uuid.UUID(data["task_id"], version=4)
        self.assertEqual(str(parsed), data["task_id"])

    def test_autonomy_plan_auto_applied_false(self):
        data = self._run(["autonomy-plan", "--task", "refactor config", "--root", "."])
        self.assertFalse(data.get("auto_applied"), "auto_applied must be False in autonomy-plan output")

    def test_autonomy_plan_has_steps(self):
        data = self._run(["autonomy-plan", "--task", "add feature X", "--root", "."])
        self.assertIn("steps", data)
        self.assertIsInstance(data["steps"], list)
        self.assertGreater(len(data["steps"]), 0)

    def test_autonomy_status_returns_json(self):
        plan = self._run(["autonomy-plan", "--task", "status check task", "--root", "."])
        task_id = plan["task_id"]
        status = self._run(["autonomy-status", "--task-id", task_id])
        self.assertEqual(status["task_id"], task_id)
        self.assertFalse(status["auto_applied"])

    def test_autonomy_approve_uses_real_step_id(self):
        plan = self._run(["autonomy-plan", "--task", "implement logging", "--root", "."])
        task_id = plan["task_id"]
        mutable = [s for s in plan["steps"] if s.get("mutable")]
        if mutable:
            step_id = mutable[0]["step_id"]
            result = self._run([
                "autonomy-approve",
                "--task-id", task_id,
                "--step-id", step_id,
                "--reason", "manual approval test",
            ])
            self.assertEqual(result["action"], "approved")
            self.assertFalse(result["auto_applied"])

    def test_autonomy_cancel_returns_cancelled(self):
        plan = self._run(["autonomy-plan", "--task", "task to be cancelled", "--root", "."])
        task_id = plan["task_id"]
        result = self._run(["autonomy-cancel", "--task-id", task_id, "--reason", "manual cancellation test"])
        self.assertEqual(result["action"], "cancelled")
        self.assertFalse(result["auto_applied"])

    def test_autonomy_execute_cli_applies_approved_patch(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            target = root / "app.py"
            target.write_text("def health():\n    return 'ok'\n", encoding="utf-8")
            changes_file = root / "changes.json"
            changes_file.write_text(
                json.dumps([{"path": "app.py", "content": "def health():\n    return 'cli'\n"}]),
                encoding="utf-8",
            )

            plan = self._run(["autonomy-plan", "--task", "add validation", "--root", str(root)])
            mutable = [s for s in plan["steps"] if s.get("action_type") == "patch_proposal"]
            self.assertTrue(mutable)
            approve = self._run([
                "autonomy-approve",
                "--task-id", plan["task_id"],
                "--step-id", mutable[0]["step_id"],
                "--reason", "cli approval",
            ])
            self.assertEqual(approve["action"], "approved")

            result = self._run([
                "autonomy-execute",
                "--task-id", plan["task_id"],
                "--step-id", mutable[0]["step_id"],
                "--root", str(root),
                "--changes-json", str(changes_file),
                "--reason", "cli execute",
            ])
            self.assertTrue(result["ok"])
            self.assertFalse(result["auto_applied"])
            self.assertIn("return 'cli'", target.read_text(encoding="utf-8"))


if __name__ == "__main__":
    unittest.main()
