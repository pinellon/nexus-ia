import request from "supertest";
import { mkdir, rm } from "node:fs/promises";
import path from "node:path";
import { beforeAll, describe, expect, it } from "vitest";

describe("nexus autonomy api v0.3.3", () => {
  beforeAll(() => {
    process.env.NODE_ENV = "test";
  });

  async function app() {
    return (await import("../src/server.js")).app;
  }

  async function createPlan(task = `add validation ${Date.now()}`) {
    const response = await request(await app())
      .post("/api/nexus/autonomy/plan")
      .send({ task, root: "." })
      .expect(200);

    expect(response.body.auto_applied).toBe(false);
    const data = response.body.data;
    expect(data.auto_applied).toBe(false);
    return data;
  }

  function firstMutableStep(plan: { steps: Array<{ step_id: string; mutable?: boolean; action_type?: string }> }, actionType?: string) {
    const step = plan.steps.find((item) => item.mutable && (!actionType || item.action_type === actionType));
    expect(step).toBeTruthy();
    return step!;
  }

  it("lists tasks with auto_applied false", async () => {
    const response = await request(await app()).get("/api/nexus/autonomy/tasks").expect(200);

    expect(response.body.ok).toBe(true);
    expect(response.body.auto_applied).toBe(false);
    expect(response.body.data.auto_applied).toBe(false);
    expect(Array.isArray(response.body.data.tasks)).toBe(true);
  });

  it("rejects invalid plan body", async () => {
    const response = await request(await app())
      .post("/api/nexus/autonomy/plan")
      .send({ task: "" })
      .expect(400);

    expect(response.body.auto_applied).toBe(false);
  });

  it("creates plan and reads status", async () => {
    const plan = await createPlan();
    const response = await request(await app())
      .get(`/api/nexus/autonomy/status/${plan.task_id}`)
      .expect(200);

    expect(response.body.auto_applied).toBe(false);
    expect(response.body.data.task_id).toBe(plan.task_id);
    expect(response.body.data.steps.length).toBeGreaterThan(0);
  });

  it("approve records decision without auto apply", async () => {
    const plan = await createPlan("add api validation");
    const step = firstMutableStep(plan, "patch_proposal");

    const response = await request(await app())
      .post("/api/nexus/autonomy/approve")
      .send({ task_id: plan.task_id, step_id: step.step_id, reason: "api test" })
      .expect(200);

    expect(response.body.auto_applied).toBe(false);
    expect(response.body.data.auto_applied).toBe(false);
    expect(response.body.data.action).toBe("approved");
  });

  it("reject and request changes record feedback", async () => {
    const rejectPlan = await createPlan("add rejected validation");
    const rejectStep = firstMutableStep(rejectPlan, "patch_proposal");
    const reject = await request(await app())
      .post("/api/nexus/autonomy/reject")
      .send({ task_id: rejectPlan.task_id, step_id: rejectStep.step_id, reason: "not now" })
      .expect(200);
    expect(reject.body.data.action).toBe("rejected");
    expect(reject.body.auto_applied).toBe(false);

    const changesPlan = await createPlan("add changed validation");
    const changesStep = firstMutableStep(changesPlan, "patch_proposal");
    const changes = await request(await app())
      .post("/api/nexus/autonomy/request-changes")
      .send({ task_id: changesPlan.task_id, step_id: changesStep.step_id, reason: "revise scope" })
      .expect(200);
    expect(changes.body.data.action).toBe("changes_requested");
    expect(changes.body.auto_applied).toBe(false);
  }, 15_000);

  it("execute requires approved true in the API request", async () => {
    const plan = await createPlan("add approval guard");
    const step = firstMutableStep(plan, "patch_proposal");

    const response = await request(await app())
      .post("/api/nexus/autonomy/execute")
      .send({
        task_id: plan.task_id,
        step_id: step.step_id,
        changes: [{ path: "docs/api-test.md", content: "blocked\n" }]
      })
      .expect(403);

    expect(response.body.auto_applied).toBe(false);
    expect(response.body.error).toContain("approved:true");
  });

  it("execute still requires an approved step", async () => {
    const plan = await createPlan("add approval guard");
    const step = firstMutableStep(plan, "patch_proposal");

    const response = await request(await app())
      .post("/api/nexus/autonomy/execute")
      .send({
        task_id: plan.task_id,
        step_id: step.step_id,
        approved: true,
        changes: [{ path: "docs/api-test.md", content: "blocked\n" }]
      })
      .expect(400);

    expect(response.body.auto_applied).toBe(false);
    expect(response.body.error).toContain("approval");
  });

  it("cancel works and audit returns events", async () => {
    const plan = await createPlan("cancel api task");
    const cancel = await request(await app())
      .post("/api/nexus/autonomy/cancel")
      .send({ task_id: plan.task_id, reason: "api cancel" })
      .expect(200);
    expect(cancel.body.auto_applied).toBe(false);
    expect(cancel.body.data.action).toBe("cancelled");

    const audit = await request(await app())
      .get(`/api/nexus/autonomy/audit/${plan.task_id}`)
      .expect(200);
    expect(audit.body.auto_applied).toBe(false);
    expect(Array.isArray(audit.body.data.events)).toBe(true);
    expect(audit.body.data.events.some((event: { event_type?: string }) => event.event_type === "task_cancelled")).toBe(true);
  });

  it("rollback endpoint returns explicit no-snapshot result", async () => {
    const root = path.join(".tmp-tests", `autonomy-api-${Date.now()}`);
    await mkdir(root, { recursive: true });
    const response = await request(await app())
      .post("/api/nexus/autonomy/rollback")
      .send({ root })
      .expect(200);
    await rm(root, { recursive: true, force: true });

    expect(response.body.auto_applied).toBe(false);
    expect(response.body.data).toHaveProperty("rolled_back");
  });
});
