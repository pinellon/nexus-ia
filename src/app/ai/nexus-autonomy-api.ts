import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

const OUTPUT_CAP_BYTES = 1_000_000;
const DEFAULT_TIMEOUT_MS = 30_000;
const EXECUTE_TIMEOUT_MS = 90_000;

export interface NexusAutonomyResult {
  ok: boolean;
  data?: unknown;
  error?: string;
  status?: "success" | "error" | "timeout";
  stdout?: string;
  stderr?: string;
  auto_applied: false;
}

type SpawnLike = typeof spawn;

function repoRoot() {
  return path.resolve(process.cwd());
}

function repoModePath(baseRoot = repoRoot()) {
  return path.join(baseRoot, "NexusAI", "repo_mode.py");
}

function cleanString(value: unknown, max = 500) {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

function cleanLongString(value: unknown, max = 20_000) {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function inside(parent: string, child: string) {
  const relative = path.relative(parent, child);
  return relative === "" || (!relative.startsWith("..") && !path.isAbsolute(relative));
}

function normalizeRoot(inputRoot: unknown, baseRoot = repoRoot()) {
  const requested = cleanString(inputRoot) || ".";
  if (requested.includes("\0")) {
    throw new Error("root invalido");
  }
  const resolved = path.resolve(baseRoot, requested);
  if (!inside(baseRoot, resolved)) {
    throw new Error("root precisa ficar dentro do repositorio");
  }
  return path.relative(baseRoot, resolved) || ".";
}

function assertId(name: string, value: unknown) {
  const cleaned = cleanString(value, 120);
  if (!/^[a-zA-Z0-9_-]+$/.test(cleaned)) {
    throw new Error(`${name} invalido`);
  }
  return cleaned;
}

function appendCapped(chunks: string[], value: Buffer | string) {
  const current = chunks.reduce((total, item) => total + Buffer.byteLength(item), 0);
  if (current >= OUTPUT_CAP_BYTES) return;
  chunks.push(String(value).slice(0, OUTPUT_CAP_BYTES - current));
}

function parseStdout(stdout: string) {
  const trimmed = stdout.trim();
  if (!trimmed) return null;
  try {
    return JSON.parse(trimmed);
  } catch {
    const firstBrace = trimmed.indexOf("{");
    const lastBrace = trimmed.lastIndexOf("}");
    if (firstBrace >= 0 && lastBrace > firstBrace) {
      try {
        return JSON.parse(trimmed.slice(firstBrace, lastBrace + 1));
      } catch {
        return { stdout: trimmed };
      }
    }
    return { stdout: trimmed };
  }
}

async function runRepoMode(
  args: string[],
  options: { timeoutMs?: number; spawnImpl?: SpawnLike; baseRoot?: string } = {}
): Promise<NexusAutonomyResult> {
  const baseRoot = options.baseRoot ?? repoRoot();
  const executable = process.env.PYTHON || "python";
  const repoMode = repoModePath(baseRoot);
  if (!existsSync(repoMode)) {
    return { ok: false, error: "NexusAI/repo_mode.py nao encontrado", auto_applied: false };
  }

  return new Promise((resolve) => {
    const stdoutChunks: string[] = [];
    const stderrChunks: string[] = [];
    let finished = false;
    let child: ChildProcessWithoutNullStreams;

    const finish = (status: "success" | "error" | "timeout", exitCode?: number | null, spawnError?: Error) => {
      if (finished) return;
      finished = true;
      clearTimeout(timer);
      const stdout = stdoutChunks.join("");
      const stderr = stderrChunks.join("");
      const parsed = parseStdout(stdout);
      const parsedFailure = isPlainObject(parsed) && parsed.ok === false;
      const ok = status === "success" && !spawnError && (exitCode === 0 || exitCode == null) && !parsedFailure;
      resolve({
        ok,
        data: parsed,
        error: spawnError?.message || (parsedFailure && typeof parsed.error === "string" ? parsed.error : undefined) || (!ok ? stderr.trim() || `Nexus CLI exited with code ${exitCode}` : undefined),
        status,
        stdout: stdout.slice(0, OUTPUT_CAP_BYTES),
        stderr: stderr.slice(0, OUTPUT_CAP_BYTES),
        auto_applied: false
      });
    };

    const timer = setTimeout(() => {
      child.kill();
      finish("timeout", null);
    }, options.timeoutMs ?? DEFAULT_TIMEOUT_MS);

    try {
      child = (options.spawnImpl ?? spawn)(executable, [repoMode, ...args], {
        cwd: baseRoot,
        shell: false,
        windowsHide: true,
        env: process.env
      }) as ChildProcessWithoutNullStreams;
    } catch (error) {
      clearTimeout(timer);
      resolve({
        ok: false,
        error: error instanceof Error ? error.message : "Falha ao iniciar Python",
        status: "error",
        auto_applied: false
      });
      return;
    }

    child.stdout.on("data", (chunk) => appendCapped(stdoutChunks, chunk));
    child.stderr.on("data", (chunk) => appendCapped(stderrChunks, chunk));
    child.on("error", (error) => finish("error", null, error));
    child.on("close", (code) => finish(code === 0 ? "success" : "error", code));
  });
}

export async function listAutonomyTasks(status?: unknown) {
  const args = ["autonomy-tasks"];
  const cleaned = cleanString(status, 40);
  if (cleaned) args.push("--status", cleaned);
  return runRepoMode(args);
}

export async function createAutonomyPlan(task: unknown, root: unknown = ".") {
  const cleanedTask = cleanLongString(task);
  if (!cleanedTask) throw new Error("task e obrigatoria");
  return runRepoMode(["autonomy-plan", "--task", cleanedTask, "--root", normalizeRoot(root)]);
}

export async function getAutonomyStatus(taskId: unknown) {
  return runRepoMode(["autonomy-status", "--task-id", assertId("task_id", taskId)]);
}

export async function approveAutonomyStep(taskId: unknown, stepId: unknown, reason?: unknown) {
  const args = ["autonomy-approve", "--task-id", assertId("task_id", taskId), "--step-id", assertId("step_id", stepId)];
  const cleanedReason = cleanLongString(reason, 2000);
  if (cleanedReason) args.push("--reason", cleanedReason);
  return runRepoMode(args);
}

export async function rejectAutonomyStep(taskId: unknown, stepId: unknown, reason?: unknown) {
  const args = ["autonomy-reject", "--task-id", assertId("task_id", taskId), "--step-id", assertId("step_id", stepId)];
  const cleanedReason = cleanLongString(reason, 2000);
  if (cleanedReason) args.push("--reason", cleanedReason);
  return runRepoMode(args);
}

export async function requestAutonomyChanges(taskId: unknown, stepId: unknown, reason?: unknown) {
  const args = ["autonomy-request-changes", "--task-id", assertId("task_id", taskId), "--step-id", assertId("step_id", stepId)];
  const cleanedReason = cleanLongString(reason, 2000);
  if (cleanedReason) args.push("--reason", cleanedReason);
  return runRepoMode(args);
}

export async function cancelAutonomyTask(taskId: unknown, reason?: unknown) {
  const args = ["autonomy-cancel", "--task-id", assertId("task_id", taskId)];
  const cleanedReason = cleanLongString(reason, 2000);
  if (cleanedReason) args.push("--reason", cleanedReason);
  return runRepoMode(args);
}

export async function executeAutonomyStep(body: unknown) {
  if (!isPlainObject(body)) throw new Error("body precisa ser um objeto JSON");
  const taskId = assertId("task_id", body.task_id);
  const stepId = assertId("step_id", body.step_id);
  const root = normalizeRoot(body.root ?? ".");
  const reason = cleanLongString(body.reason, 2000);
  const args = ["autonomy-execute", "--task-id", taskId, "--step-id", stepId, "--root", root];
  if (reason) args.push("--reason", reason);

  const hasChanges = Array.isArray(body.changes);
  const command = cleanString(body.command, 200);
  const wantsRollback = body.rollback === true;
  const selected = Number(hasChanges) + Number(Boolean(command)) + Number(wantsRollback);
  if (selected !== 1) {
    throw new Error("choose exactly one of changes, command or rollback=true");
  }

  let changesFile: string | null = null;
  if (hasChanges) {
    const tmpRoot = await mkdtemp(path.join(tmpdir(), "nexus-autonomy-"));
    changesFile = path.join(tmpRoot, "changes.json");
    await writeFile(changesFile, JSON.stringify(body.changes), "utf-8");
    args.push("--changes-json", changesFile);
  } else if (command) {
    args.push("--command", command);
  } else {
    args.push("--rollback");
  }

  return runRepoMode(args, { timeoutMs: EXECUTE_TIMEOUT_MS });
}

export async function rollbackAutonomy(root: unknown = ".") {
  return runRepoMode(["rollback", normalizeRoot(root)], { timeoutMs: EXECUTE_TIMEOUT_MS });
}

export async function getAutonomyAudit(taskId: unknown) {
  return runRepoMode(["autonomy-audit", "--task-id", assertId("task_id", taskId)]);
}
