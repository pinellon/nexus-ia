import { mkdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";

import request from "supertest";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

const dataDir = path.resolve(process.cwd(), ".tmp-tests/patches-api-data");
const projectRoot = "workspace/__patches-api-project__";
const absoluteProjectRoot = path.resolve(process.cwd(), projectRoot);

describe("patches api", () => {
  beforeAll(async () => {
    process.env.NEXUS_DATA_DIR = dataDir;
    process.env.NODE_ENV = "test";
    await rm(dataDir, { recursive: true, force: true });
    vi.resetModules();
  });

  beforeEach(async () => {
    await rm(absoluteProjectRoot, { recursive: true, force: true });
    await mkdir(path.join(absoluteProjectRoot, "src"), { recursive: true });
    await rm(dataDir, { recursive: true, force: true });
    vi.resetModules();
  });

  afterEach(async () => {
    await rm(absoluteProjectRoot, { recursive: true, force: true });
  });

  it("GET /api/patches/:patchId returns before and after for Monaco diff", async () => {
    const { createPendingAction } = await import("../src/pending-actions-store.js");
    const { app } = await import("../src/server.js");

    await writeFile(path.join(absoluteProjectRoot, "src/example.ts"), "before", "utf8");
    const action = await createPendingAction("session-api", {
      type: "patch_file",
      sessionId: "session-api",
      sourceAgent: "builder",
      projectRoot,
      path: "src/example.ts",
      before: "before",
      after: "after",
      reason: "API patch payload",
      riskLevel: "low",
      requiresConfirmation: true
    });

    const response = await request(app).get(`/api/patches/${action.id}`).expect(200);

    expect(response.body).toMatchObject({
      ok: true,
      patch: {
        id: action.id,
        status: "pending",
        agent_id: "builder",
        summary: "API patch payload",
        risk: "low",
        files_changed: ["src/example.ts"],
        before: "before",
        after: "after"
      }
    });
    expect(response.body.patch.diff).toContain("-before");
    expect(response.body.patch.diff).toContain("+after");
    expect(response.body.data.before).toBe("before");
  });
});
