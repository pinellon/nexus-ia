import { readFile, rm } from "node:fs/promises";
import path from "node:path";

import request from "supertest";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const dataDir = path.resolve(process.cwd(), ".tmp-tests/active-project-boundary-data");
const workspaceTestRoot = path.resolve(process.cwd(), "workspace/__active-project-boundary__");

function flattenTree(nodes: Array<{ path: string; children?: unknown[] }>, paths: string[] = []) {
  for (const node of nodes) {
    paths.push(node.path);
    if (Array.isArray(node.children)) {
      flattenTree(node.children as Array<{ path: string; children?: unknown[] }>, paths);
    }
  }
  return paths;
}

describe("active project boundary", () => {
  beforeEach(async () => {
    process.env.NEXUS_DATA_DIR = dataDir;
    process.env.NODE_ENV = "test";
    await rm(dataDir, { recursive: true, force: true });
    await rm(workspaceTestRoot, { recursive: true, force: true });
    vi.resetModules();
  });

  afterEach(async () => {
    await rm(workspaceTestRoot, { recursive: true, force: true });
  });

  it("defaults the active project to workspace/", async () => {
    const { app } = await import("../src/server.js");

    const response = await request(app).get("/api/project/current").expect(200);

    expect(response.body).toMatchObject({
      ok: true,
      project: {
        name: "workspace",
        root: "workspace",
        type: "workspace"
      }
    });
    expect(response.body.project.absoluteRoot).toContain(`${path.sep}workspace`);
  });

  it("lists the workspace tree without exposing Nexus source files", async () => {
    const { app } = await import("../src/server.js");

    const response = await request(app).get("/api/project/tree").expect(200);
    const paths = flattenTree(response.body.tree || []);

    expect(paths).not.toContain("src/server.ts");
    expect(paths).not.toContain("package.json");
    expect(paths).not.toContain(".github");
  });

  it("does not let Git status from workspace climb into the Nexus repository", async () => {
    const { app } = await import("../src/server.js");

    const response = await request(app).get("/api/git/status").expect(200);
    const statusLines = response.body.data?.statusLines || [];

    expect(response.body.data?.branch).toBe("Sem Git");
    expect(statusLines.join("\n")).not.toContain("../");
    expect(statusLines.join("\n")).not.toContain("src/server.ts");
  });

  it("creates and saves files inside workspace/ by default", async () => {
    const { app } = await import("../src/server.js");
    const targetPath = "__active-project-boundary__/note.md";

    await request(app)
      .post("/api/project/file")
      .send({ path: targetPath, content: "primeira versao" })
      .expect(201);

    expect(await readFile(path.join(workspaceTestRoot, "note.md"), "utf8")).toBe("primeira versao");

    await request(app)
      .put("/api/project/file")
      .send({ path: targetPath, content: "segunda versao" })
      .expect(200);

    expect(await readFile(path.join(workspaceTestRoot, "note.md"), "utf8")).toBe("segunda versao");
  });

  it("blocks path traversal for project file operations", async () => {
    const { app } = await import("../src/server.js");

    const response = await request(app)
      .post("/api/project/file")
      .send({ path: "../outside.md", content: "blocked" })
      .expect(400);

    expect(response.body.error).toMatch(/Caminho invalido|Root de projeto invalido/);
  });

  it("blocks selecting the Nexus repository root as the active project", async () => {
    const { app } = await import("../src/server.js");

    const response = await request(app)
      .post("/api/project/current")
      .send({ root: "." })
      .expect(400);

    expect(response.body.error).toContain("root interno do Nexus");
  });

  it("blocks project tree access to the Nexus repository root", async () => {
    const { app } = await import("../src/server.js");

    const response = await request(app).get("/api/project/tree?projectRoot=.").expect(400);

    expect(response.body.error).toContain("root interno do Nexus");
  });

  it("blocks patch application outside the active project", async () => {
    const { createPendingAction } = await import("../src/pending-actions-store.js");
    const { app } = await import("../src/server.js");

    const action = await createPendingAction("session-boundary", {
      type: "create_file",
      sessionId: "session-boundary",
      projectRoot: ".",
      path: "docs/unsafe.md",
      content: "unsafe",
      reason: "outside active project",
      riskLevel: "low",
      requiresConfirmation: true
    });

    const response = await request(app).post(`/api/patches/${action.id}/apply`).expect(400);

    expect(response.body.error).toContain("fora do projeto ativo");
  });
});
