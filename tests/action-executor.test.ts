import { mkdir, rm } from "node:fs/promises";
import path from "node:path";

import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

type CreatePendingAction = typeof import("../src/pending-actions-store.js").createPendingAction;
type ApproveAction = typeof import("../src/pending-actions-store.js").approveAction;
type RejectAction = typeof import("../src/pending-actions-store.js").rejectAction;
type ApplyAction = typeof import("../src/action-executor.js").applyAction;
type WriteProjectFile = typeof import("../src/project-file-store.js").writeProjectFile;
type ReadProjectFile = typeof import("../src/project-file-store.js").readProjectFile;

const dataDir = path.resolve(process.cwd(), ".tmp-tests/action-data");
const projectRoot = ".tmp-tests/action-project";
const absoluteProjectRoot = path.resolve(process.cwd(), projectRoot);

let createPendingAction: CreatePendingAction;
let approveAction: ApproveAction;
let rejectAction: RejectAction;
let applyAction: ApplyAction;
let writeProjectFile: WriteProjectFile;
let readProjectFile: ReadProjectFile;

function createFileAction(pathName: string, content: string) {
  return {
    type: "create_file" as const,
    sessionId: "test-session",
    projectRoot,
    path: pathName,
    content,
    reason: "test action",
    riskLevel: "low" as const,
    requiresConfirmation: true as const
  };
}

describe("action-executor", () => {
  beforeAll(async () => {
    process.env.NEXUS_DATA_DIR = dataDir;
    await rm(dataDir, { recursive: true, force: true });
    vi.resetModules();
    ({ createPendingAction, approveAction, rejectAction } = await import("../src/pending-actions-store.js"));
    ({ applyAction } = await import("../src/action-executor.js"));
    ({ writeProjectFile, readProjectFile } = await import("../src/project-file-store.js"));
  });

  beforeEach(async () => {
    await rm(absoluteProjectRoot, { recursive: true, force: true });
    await mkdir(absoluteProjectRoot, { recursive: true });
  });

  it("does not apply a pending action before approval", async () => {
    const action = await createPendingAction("test-session", createFileAction("docs/pending.md", "pending"));

    await expect(applyAction(action.id)).rejects.toThrow("aprovada");
  });

  it("applies an approved action", async () => {
    const action = await createPendingAction("test-session", createFileAction("docs/applied.md", "applied"));
    await approveAction(action.id);

    await expect(applyAction(action.id)).resolves.toMatchObject({
      action: { status: "applied" }
    });
    await expect(readProjectFile(projectRoot, "docs/applied.md")).resolves.toMatchObject({ content: "applied" });
  });

  it("does not apply a rejected action", async () => {
    const action = await createPendingAction("test-session", createFileAction("docs/rejected.md", "rejected"));
    await rejectAction(action.id);

    await expect(applyAction(action.id)).rejects.toThrow("aprovada");
  });

  it("fails patch_file when current file differs from before", async () => {
    await writeProjectFile(projectRoot, "src/file.ts", "changed");
    const action = await createPendingAction("test-session", {
      type: "patch_file",
      sessionId: "test-session",
      projectRoot,
      path: "src/file.ts",
      before: "before",
      after: "after",
      reason: "stale patch",
      riskLevel: "medium",
      requiresConfirmation: true
    });
    await approveAction(action.id);

    await expect(applyAction(action.id)).rejects.toThrow("mudou desde a proposta");
  });
});
