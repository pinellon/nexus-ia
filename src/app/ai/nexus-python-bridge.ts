import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import { existsSync } from "node:fs";
import path from "node:path";

export const SUPPORTED_NEXUS_MODES = ["task", "suite", "index", "plan", "coder-task"] as const;
export type NexusMode = (typeof SUPPORTED_NEXUS_MODES)[number];
export type NexusStatus = "success" | "error" | "timeout" | "unsupported";

export interface NexusRunOptions {
  maxTaskSeconds?: number;
  maxSuiteSeconds?: number;
  modelTimeoutSeconds?: number;
  repairTimeoutSeconds?: number;
  timeoutMs?: number;
}

export interface NexusRunRequest {
  mode?: unknown;
  task?: unknown;
  suite?: unknown;
  root?: unknown;
  options?: NexusRunOptions;
}

export interface NexusRunResponse {
  ok: boolean;
  mode: NexusMode | "unknown";
  status: NexusStatus;
  final_origin: string | null;
  provider_mode: "real" | "mock" | "fallback" | "unavailable";
  task: string | null;
  result: unknown;
  metrics: Record<string, unknown>;
  logs: string[];
  errors: string[];
  duration_ms: number;
  auto_applied: false;
}

export interface NexusCommand {
  executable: string;
  args: string[];
  cwd: string;
  timeoutMs: number;
  mode: NexusMode;
  task: string | null;
}

type SpawnLike = typeof spawn;

const OUTPUT_CAP_BYTES = 1_000_000;
const DEFAULT_TIMEOUT_MS = 120_000;
const MAX_TIMEOUT_MS = 30 * 60 * 1000;
const SUPPORTED_SUITES = new Set(["smoke_10", "smoke_25", "smoke_50"]);

function repoRoot() {
  return path.resolve(process.cwd());
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function cleanString(value: unknown, maxLength = 10_000) {
  if (typeof value !== "string") {
    return "";
  }
  return value.trim().slice(0, maxLength);
}

function asPositiveSeconds(value: unknown, fallback: number, max = 1800) {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return fallback;
  }
  return Math.min(Math.max(Math.round(value), 1), max);
}

function inside(parent: string, child: string) {
  const relative = path.relative(parent, child);
  return relative === "" || (!relative.startsWith("..") && !path.isAbsolute(relative));
}

export function resolveNexusRoot(inputRoot: unknown, baseRoot = repoRoot()) {
  const requested = cleanString(inputRoot, 500) || ".";
  if (requested.includes("\0")) {
    throw new Error("root invalido");
  }
  const resolved = path.resolve(baseRoot, requested);
  if (!inside(baseRoot, resolved)) {
    throw new Error("root precisa ficar dentro do repositorio");
  }
  return { absolute: resolved, relative: path.relative(baseRoot, resolved) || "." };
}

export function normalizeSuiteName(inputSuite: unknown) {
  const raw = cleanString(inputSuite, 300) || "smoke_25";
  if (raw.includes("\0")) {
    throw new Error("suite invalida");
  }
  const normalizedSlashes = raw.replace(/\\/g, "/");
  const baseName = path.posix.basename(normalizedSlashes);
  const suite = baseName.endsWith(".json") ? baseName.slice(0, -5) : baseName;
  const directory = path.posix.dirname(normalizedSlashes);
  const allowedPath = directory === "." || directory === "benchmarks";
  if (!allowedPath || normalizedSlashes.includes("..") || path.isAbsolute(raw) || !SUPPORTED_SUITES.has(suite)) {
    throw new Error("suite precisa ser smoke_10, smoke_25 ou smoke_50");
  }
  return suite;
}

function emptyResponse(mode: NexusMode | "unknown", status: NexusStatus, startedAt: number): NexusRunResponse {
  return {
    ok: false,
    mode,
    status,
    final_origin: null,
    provider_mode: "unavailable",
    task: null,
    result: null,
    metrics: {},
    logs: [],
    errors: [],
    duration_ms: Date.now() - startedAt,
    auto_applied: false
  };
}

function extractFinalOrigin(parsed: unknown) {
  if (!isPlainObject(parsed)) {
    return null;
  }
  const direct = parsed.final_origin;
  if (typeof direct === "string") {
    return direct;
  }
  const generation = parsed.generation;
  if (isPlainObject(generation)) {
    const trace = generation.trace;
    if (isPlainObject(trace) && typeof trace.final_origin === "string") {
      return trace.final_origin;
    }
  }
  return null;
}

function extractMetrics(parsed: unknown) {
  if (!isPlainObject(parsed)) {
    return {};
  }
  const metrics: Record<string, unknown> = {};
  for (const key of ["summary", "model_flow", "strict", "context", "budget"]) {
    if (parsed[key] !== undefined) {
      metrics[key] = parsed[key];
    }
  }
  if (isPlainObject(parsed.generation)) {
    metrics.generation_valid = parsed.generation.valid;
    metrics.generation_errors = parsed.generation.errors;
  }
  return metrics;
}

export function buildNexusCommand(request: NexusRunRequest, baseRoot = repoRoot()): NexusCommand {
  const mode = cleanString(request.mode, 50) as NexusMode;
  if (!SUPPORTED_NEXUS_MODES.includes(mode)) {
    throw new Error("modo Nexus nao suportado");
  }

  const root = resolveNexusRoot(request.root, baseRoot);
  const options = isPlainObject(request.options) ? request.options : {};
  const maxTaskSeconds = asPositiveSeconds(options.maxTaskSeconds, 60);
  const maxSuiteSeconds = asPositiveSeconds(options.maxSuiteSeconds, 1200);
  const modelTimeoutSeconds = asPositiveSeconds(options.modelTimeoutSeconds, 30);
  const repairTimeoutSeconds = asPositiveSeconds(options.repairTimeoutSeconds, 20);
  const timeoutMs = Math.min(
    Math.max(
      typeof options.timeoutMs === "number" && Number.isFinite(options.timeoutMs)
        ? Math.round(options.timeoutMs)
        : mode === "suite"
          ? (maxSuiteSeconds + 15) * 1000
          : DEFAULT_TIMEOUT_MS,
      1000
    ),
    MAX_TIMEOUT_MS
  );
  const python = process.env.PYTHON || "python";
  const repoMode = path.join("NexusAI", "repo_mode.py");
  const realTaskRunner = path.join("NexusAI", "real_task_runner.py");
  const task = cleanString(request.task, 20_000);

  if (mode === "index") {
    return {
      executable: python,
      args: [repoMode, "index", "--root", root.relative],
      cwd: baseRoot,
      timeoutMs,
      mode,
      task: null
    };
  }

  if (mode === "plan" || mode === "coder-task") {
    if (!task) {
      throw new Error("task e obrigatoria para este modo");
    }
    return {
      executable: python,
      args: [repoMode, mode, "--root", root.relative, "--task", task],
      cwd: baseRoot,
      timeoutMs,
      mode,
      task
    };
  }

  if (mode === "task") {
    if (!task) {
      throw new Error("task e obrigatoria para este modo");
    }
    return {
      executable: python,
      args: [
        repoMode,
        "task",
        root.relative,
        task,
        "--model_timeout_seconds",
        String(modelTimeoutSeconds),
        "--repair_timeout_seconds",
        String(repairTimeoutSeconds),
        "--repair_strategy",
        "fast"
      ],
      cwd: baseRoot,
      timeoutMs: Math.min((maxTaskSeconds + modelTimeoutSeconds + repairTimeoutSeconds + 15) * 1000, timeoutMs),
      mode,
      task
    };
  }

  const suite = normalizeSuiteName(request.suite);
  return {
    executable: python,
    args: [
      realTaskRunner,
      "--with_model",
      "--suite",
      suite,
      "--max_task_seconds",
      String(maxTaskSeconds),
      "--max_suite_seconds",
      String(maxSuiteSeconds),
      "--model_timeout_seconds",
      String(modelTimeoutSeconds),
      "--repair_timeout_seconds",
      String(repairTimeoutSeconds),
      "--repair_strategy",
      "fast"
    ],
    cwd: baseRoot,
    timeoutMs,
    mode,
    task: suite
  };
}

function appendCapped(chunks: string[], value: Buffer | string) {
  const current = chunks.reduce((total, item) => total + Buffer.byteLength(item), 0);
  if (current >= OUTPUT_CAP_BYTES) {
    return;
  }
  const text = String(value);
  const remaining = OUTPUT_CAP_BYTES - current;
  chunks.push(text.slice(0, remaining));
}

function parseStdout(stdout: string) {
  const trimmed = stdout.trim();
  if (!trimmed) {
    return null;
  }
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

export async function getNexusHealth(providerHealth?: Record<string, unknown>) {
  const baseRoot = repoRoot();
  const pythonCheck = await runProbe(["--version"], 3000);
  const nexusAvailable = existsSync(path.join(baseRoot, "NexusAI", "repo_mode.py")) &&
    existsSync(path.join(baseRoot, "NexusAI", "real_task_runner.py"));

  return {
    ok: true,
    python_available: pythonCheck.ok,
    python_version: pythonCheck.output || null,
    nexusai_available: nexusAvailable,
    provider_health: providerHealth ?? null,
    supported_modes: SUPPORTED_NEXUS_MODES,
    auto_apply_enabled: false,
    notes: [
      "Bridge v0.2 executa Python com spawn sem shell.",
      "auto_applied permanece false; patches continuam exigindo revisao humana."
    ]
  };
}

async function runProbe(args: string[], timeoutMs: number) {
  const executable = process.env.PYTHON || "python";
  return new Promise<{ ok: boolean; output: string }>((resolve) => {
    const child = spawn(executable, args, { shell: false, windowsHide: true });
    let output = "";
    const timer = setTimeout(() => {
      child.kill();
      resolve({ ok: false, output: "" });
    }, timeoutMs);

    child.stdout.on("data", (chunk) => {
      output += String(chunk).trim();
    });
    child.stderr.on("data", (chunk) => {
      if (!output) output += String(chunk).trim();
    });
    child.on("error", () => {
      clearTimeout(timer);
      resolve({ ok: false, output: "" });
    });
    child.on("close", (code) => {
      clearTimeout(timer);
      resolve({ ok: code === 0, output });
    });
  });
}

export async function runNexusPython(
  request: NexusRunRequest,
  overrides: { spawnImpl?: SpawnLike; baseRoot?: string; providerMode?: NexusRunResponse["provider_mode"] } = {}
): Promise<NexusRunResponse> {
  const startedAt = Date.now();
  const baseRoot = overrides.baseRoot ?? repoRoot();
  let command: NexusCommand;

  try {
    command = buildNexusCommand(request, baseRoot);
  } catch (error) {
    const response = emptyResponse("unknown", "unsupported", startedAt);
    response.errors.push(error instanceof Error ? error.message : "Requisicao Nexus invalida");
    return response;
  }

  if (!existsSync(path.join(baseRoot, "NexusAI", "repo_mode.py"))) {
    const response = emptyResponse(command.mode, "error", startedAt);
    response.task = command.task;
    response.errors.push("NexusAI/repo_mode.py nao encontrado");
    return response;
  }

  if (command.args[0].endsWith("real_task_runner.py") && !existsSync(path.join(baseRoot, "NexusAI", "real_task_runner.py"))) {
    const response = emptyResponse(command.mode, "error", startedAt);
    response.task = command.task;
    response.errors.push("NexusAI/real_task_runner.py nao encontrado");
    return response;
  }

  const spawnImpl = overrides.spawnImpl ?? spawn;

  return new Promise<NexusRunResponse>((resolve) => {
    const stdoutChunks: string[] = [];
    const stderrChunks: string[] = [];
    let finished = false;
    let timedOut = false;
    let child: ChildProcessWithoutNullStreams;

    const finish = (status: NexusStatus, exitCode?: number | null, spawnError?: Error) => {
      if (finished) return;
      finished = true;
      clearTimeout(timer);
      const stdout = stdoutChunks.join("");
      const stderr = stderrChunks.join("");
      const parsed = parseStdout(stdout);
      const response: NexusRunResponse = {
        ok: status === "success",
        mode: command.mode,
        status,
        final_origin: extractFinalOrigin(parsed),
        provider_mode: overrides.providerMode ?? "unavailable",
        task: command.task,
        result: parsed ?? { stdout },
        metrics: extractMetrics(parsed),
        logs: [stdout, stderr].filter(Boolean).map((item) => item.slice(0, OUTPUT_CAP_BYTES)),
        errors: [],
        duration_ms: Date.now() - startedAt,
        auto_applied: false
      };
      if (spawnError) {
        response.errors.push((spawnError as NodeJS.ErrnoException).code === "ENOENT" ? "Python executable not found" : spawnError.message);
      }
      if (timedOut) {
        response.errors.push("Nexus Python bridge timed out");
      }
      if (exitCode && exitCode !== 0) {
        response.errors.push(`Nexus Python exited with code ${exitCode}`);
      }
      if (stderr && status !== "success") {
        response.errors.push(stderr.slice(0, 4000));
      }
      resolve(response);
    };

    const timer = setTimeout(() => {
      timedOut = true;
      child.kill();
      finish("timeout");
    }, command.timeoutMs);

    try {
      child = spawnImpl(command.executable, command.args, {
        cwd: command.cwd,
        shell: false,
        windowsHide: true,
        env: process.env
      }) as ChildProcessWithoutNullStreams;
    } catch (error) {
      clearTimeout(timer);
      const response = emptyResponse(command.mode, "error", startedAt);
      response.task = command.task;
      response.errors.push(error instanceof Error ? error.message : "Falha ao iniciar Python");
      resolve(response);
      return;
    }

    child.stdout.on("data", (chunk) => appendCapped(stdoutChunks, chunk));
    child.stderr.on("data", (chunk) => appendCapped(stderrChunks, chunk));
    child.on("error", (error) => finish("error", null, error));
    child.on("close", (code) => finish(code === 0 ? "success" : "error", code));
  });
}
