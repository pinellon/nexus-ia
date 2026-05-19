import { mkdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";

import { beforeEach, describe, expect, it } from "vitest";

import type { ActionRecord } from "../src/action-types.js";
import { buildPatchPayload, resolvePatchSides } from "../src/patch-payload.js";

const projectRoot = ".tmp-tests/patch-payload-project";
const absoluteProjectRoot = path.resolve(process.cwd(), projectRoot);

function baseAction(overrides: Partial<ActionRecord>): ActionRecord {
  return {
    id: "patch-1",
    sessionId: "session-1",
    type: "create_file",
    path: "src/example.ts",
    content: "export const ok = true;\n",
    reason: "test patch",
    riskLevel: "low",
    requiresConfirmation: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    status: "pending",
    projectRoot,
    ...overrides
  } as ActionRecord;
}

describe("patch-payload", () => {
  beforeEach(async () => {
    await rm(absoluteProjectRoot, { recursive: true, force: true });
    await mkdir(path.join(absoluteProjectRoot, "src"), { recursive: true });
  });

  it("returns empty before and proposed after for create_file", async () => {
    const sides = await resolvePatchSides(
      baseAction({ type: "create_file", path: "src/new.ts", content: "hello" })
    );
    expect(sides).toEqual({ path: "src/new.ts", before: "", after: "hello" });
  });

  it("returns current file as before for write_file", async () => {
    await writeFile(path.join(absoluteProjectRoot, "src/existing.ts"), "current", "utf8");
    const sides = await resolvePatchSides(
      baseAction({ type: "write_file", path: "src/existing.ts", content: "next" })
    );
    expect(sides.before).toBe("current");
    expect(sides.after).toBe("next");
  });

  it("returns before and after for patch_file", async () => {
    const sides = await resolvePatchSides(
      baseAction({
        type: "patch_file",
        path: "src/file.ts",
        before: "before",
        after: "after"
      })
    );
    expect(sides).toEqual({ path: "src/file.ts", before: "before", after: "after" });
  });

  it("returns current content before and empty after for delete_file", async () => {
    await writeFile(path.join(absoluteProjectRoot, "src/remove.ts"), "remove me", "utf8");
    const sides = await resolvePatchSides(
      baseAction({ type: "delete_file", path: "src/remove.ts" })
    );
    expect(sides.before).toBe("remove me");
    expect(sides.after).toBe("");
  });

  it("buildPatchPayload exposes before, after, diff and metadata", async () => {
    const payload = await buildPatchPayload(
      baseAction({ type: "patch_file", path: "src/a.ts", before: "a", after: "b" })
    );
    expect(payload.before).toBe("a");
    expect(payload.after).toBe("b");
    expect(payload.files_changed).toEqual(["src/a.ts"]);
    expect(payload.diff).toContain("-a");
    expect(payload.diff).toContain("+b");
    expect(payload.status).toBe("pending");
    expect(payload.action.type).toBe("patch_file");
  });
});
