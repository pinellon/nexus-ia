import request from "supertest";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

describe("nexus python bridge api", () => {
  beforeAll(() => {
    process.env.NODE_ENV = "test";
  });

  beforeEach(() => {
    vi.resetModules();
  });

  it("reports Nexus bridge health", async () => {
    const { app } = await import("../src/server.js");

    const response = await request(app).get("/api/nexus/health").expect(200);

    expect(response.body).toMatchObject({
      ok: true,
      python_available: expect.any(Boolean),
      nexusai_available: expect.any(Boolean),
      supported_modes: expect.arrayContaining(["task", "suite", "index", "plan", "coder-task"]),
      auto_apply_enabled: false
    });
    expect(response.body.provider_health).toBeTruthy();
  });

  it("rejects invalid run bodies with the v0.2 contract", async () => {
    const { app } = await import("../src/server.js");

    const response = await request(app)
      .post("/api/nexus/run")
      .set("Content-Type", "application/json")
      .send("[]")
      .expect(400);

    expect(response.body).toMatchObject({
      ok: false,
      mode: "unknown",
      status: "error",
      auto_applied: false
    });
  });

  it("rejects unsupported modes without starting v0.3 behavior", async () => {
    const { app } = await import("../src/server.js");

    const response = await request(app)
      .post("/api/nexus/run")
      .send({ mode: "autonomous-v0.3", task: "apply patches" })
      .expect(400);

    expect(response.body).toMatchObject({
      ok: false,
      mode: "unknown",
      status: "unsupported",
      auto_applied: false
    });
    expect(response.body.errors.join("\n")).toContain("modo Nexus nao suportado");
  });
});
