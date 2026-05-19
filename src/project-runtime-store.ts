import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { resolveProjectRoot } from "./project-file-store.js";

export interface LastCommandResult {
  ok: boolean;
  command: string;
  exit_code: number;
  stdout: string;
  stderr: string;
  duration_ms: number;
  created_at: string;
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const dataRoot = path.resolve(__dirname, "../data/projects");

function nowIso() {
  return new Date().toISOString();
}

async function ensureProjectDataDir(projectRootInput: string) {
  const { projectId } = resolveProjectRoot(projectRootInput);
  const dir = path.join(dataRoot, projectId);
  await mkdir(dir, { recursive: true });
  return {
    projectId,
    dir
  };
}

export async function saveLastCommandResult(projectRootInput: string, result: Omit<LastCommandResult, "created_at">) {
  const { dir } = await ensureProjectDataDir(projectRootInput);
  const payload: LastCommandResult = {
    ...result,
    created_at: nowIso()
  };
  await writeFile(path.join(dir, "last-test-result.json"), JSON.stringify(payload, null, 2), "utf8");
  return payload;
}

export async function readLastCommandResult(projectRootInput: string) {
  try {
    const { dir } = await ensureProjectDataDir(projectRootInput);
    const raw = await readFile(path.join(dir, "last-test-result.json"), "utf8");
    return JSON.parse(raw) as LastCommandResult;
  } catch {
    return null;
  }
}
