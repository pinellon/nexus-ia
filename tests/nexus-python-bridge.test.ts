import { EventEmitter } from "node:events";

import { describe, expect, it, vi } from "vitest";

import {
  buildNexusCommand,
  normalizeSuiteName,
  runNexusPython
} from "../src/app/ai/nexus-python-bridge.js";

function fakeProcess(stdout: string, stderr = "", code = 0) {
  const child = new EventEmitter() as EventEmitter & {
    stdout: EventEmitter;
    stderr: EventEmitter;
    kill: ReturnType<typeof vi.fn>;
  };
  child.stdout = new EventEmitter();
  child.stderr = new EventEmitter();
  child.kill = vi.fn();
  queueMicrotask(() => {
    if (stdout) child.stdout.emit("data", Buffer.from(stdout));
    if (stderr) child.stderr.emit("data", Buffer.from(stderr));
    child.emit("close", code);
  });
  return child;
}

describe("nexus-python-bridge", () => {
  it("builds arguments without shell for coder-task", async () => {
    const calls: Array<{ executable: string; args: string[]; options: Record<string, unknown> }> = [];
    const spawnImpl = vi.fn((executable, args, options) => {
      calls.push({ executable, args, options });
      return fakeProcess(JSON.stringify({ ok: true, auto_applied: true, final_origin: "fallback" }));
    });

    const result = await runNexusPython(
      { mode: "coder-task", task: "review project structure" },
      { spawnImpl: spawnImpl as never, providerMode: "fallback" }
    );

    expect(result.ok).toBe(true);
    expect(result.mode).toBe("coder-task");
    expect(result.auto_applied).toBe(false);
    expect(result.provider_mode).toBe("fallback");
    expect(calls[0].options.shell).toBe(false);
    expect(calls[0].args).toContain("coder-task");
    expect(calls[0].args).toContain("--task");
  });

  it("rejects unknown modes before spawning", async () => {
    const spawnImpl = vi.fn();
    const result = await runNexusPython({ mode: "v0.3", task: "nope" }, { spawnImpl: spawnImpl as never });

    expect(result.ok).toBe(false);
    expect(result.status).toBe("unsupported");
    expect(spawnImpl).not.toHaveBeenCalled();
  });

  it("normalizes supported benchmark paths and rejects traversal", () => {
    expect(normalizeSuiteName("benchmarks/smoke_25.json")).toBe("smoke_25");
    expect(() => normalizeSuiteName("../smoke_25.json")).toThrow("suite precisa");
  });

  it("uses the existing repo_mode task CLI shape", () => {
    const command = buildNexusCommand({
      mode: "task",
      task: "add validation for dangerous commands",
      options: { maxTaskSeconds: 20, modelTimeoutSeconds: 5, repairTimeoutSeconds: 5 }
    });

    expect(command.args.slice(0, 4)).toEqual(["NexusAI\\repo_mode.py", "task", ".", "add validation for dangerous commands"]);
    expect(command.args).toContain("--repair_strategy");
    expect(command.args).not.toContain("--task");
  });

  it("handles Python executable failures", async () => {
    const spawnImpl = vi.fn(() => {
      const child = new EventEmitter() as EventEmitter & {
        stdout: EventEmitter;
        stderr: EventEmitter;
        kill: ReturnType<typeof vi.fn>;
      };
      child.stdout = new EventEmitter();
      child.stderr = new EventEmitter();
      child.kill = vi.fn();
      queueMicrotask(() => child.emit("error", Object.assign(new Error("missing"), { code: "ENOENT" })));
      return child;
    });

    const result = await runNexusPython({ mode: "index" }, { spawnImpl: spawnImpl as never });

    expect(result.ok).toBe(false);
    expect(result.status).toBe("error");
    expect(result.errors.join("\n")).toContain("Python executable not found");
  });

  it("returns timeout status and kills the child", async () => {
    vi.useFakeTimers();
    const child = new EventEmitter() as EventEmitter & {
      stdout: EventEmitter;
      stderr: EventEmitter;
      kill: ReturnType<typeof vi.fn>;
    };
    child.stdout = new EventEmitter();
    child.stderr = new EventEmitter();
    child.kill = vi.fn();
    const spawnImpl = vi.fn(() => child);

    try {
      const pending = runNexusPython(
        { mode: "index", options: { timeoutMs: 10 } },
        { spawnImpl: spawnImpl as never }
      );
      await vi.advanceTimersByTimeAsync(1200);
      const result = await pending;

      expect(result.status).toBe("timeout");
      expect(child.kill).toHaveBeenCalled();
      expect(result.auto_applied).toBe(false);
    } finally {
      vi.useRealTimers();
    }
  });
});
