import { randomUUID } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { readProjectFile, writeProjectFile } from "../../project-file-store.js";
import { nowIso } from "../agents/utils.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DATA_DIR = path.resolve(__dirname, "../../../data");
const DB_PATH = path.join(DATA_DIR, "staged-files.json");

export interface StagedFileVersion {
  version_id: string;
  content: string;
  created_at: string;
}

export interface StagedFile {
  id: string;
  path: string;
  language: string;
  content: string;
  status: "created" | "modified" | "pending_apply";
  source: string;
  run_id?: string;
  createdAt: string;
  versions: StagedFileVersion[];
}

const store = new Map<string, StagedFile>();

let loaded = false;

async function loadDb() {
  if (loaded) return;
  try {
    await mkdir(DATA_DIR, { recursive: true });
    const data = await readFile(DB_PATH, "utf-8");
    const parsed = JSON.parse(data) as StagedFile[];
    for (const f of parsed) {
      store.set(f.id, f);
    }
  } catch (err: any) {
    if (err.code !== "ENOENT") console.error("Error loading staged files", err);
  } finally {
    loaded = true;
  }
}

async function saveDb() {
  await mkdir(DATA_DIR, { recursive: true });
  const data = Array.from(store.values());
  await writeFile(DB_PATH, JSON.stringify(data, null, 2));
}

export async function addStagedFile(input: Omit<StagedFile, "id" | "createdAt" | "status" | "versions"> & { status?: StagedFile["status"] }): Promise<StagedFile> {
  await loadDb();
  let existingId: string | null = null;
  
  for (const [key, f] of store.entries()) {
    if (f.path === input.path) {
      existingId = key;
      break;
    }
  }

  const id = existingId || `stg_${randomUUID().slice(0, 8)}`;
  const existing = store.get(id);

  const version: StagedFileVersion = {
    version_id: `v_${randomUUID().slice(0, 8)}`,
    content: input.content,
    created_at: nowIso()
  };

  const file: StagedFile = {
    ...input,
    id,
    status: input.status || (existing ? "modified" : "created"),
    createdAt: existing?.createdAt || nowIso(),
    versions: [...(existing?.versions || []), version]
  };
  
  store.set(id, file);
  await saveDb();
  return file;
}

export async function listStagedFiles(): Promise<StagedFile[]> {
  await loadDb();
  return Array.from(store.values()).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function getStagedFile(id: string): Promise<StagedFile | null> {
  await loadDb();
  return store.get(id) ?? null;
}

export async function removeStagedFile(id: string) {
  await loadDb();
  store.delete(id);
  await saveDb();
}

export async function clearStagedFiles() {
  await loadDb();
  store.clear();
  await saveDb();
}

export async function applyStagedFile(projectRoot: string, id: string) {
  await loadDb();
  const file = store.get(id);
  if (!file) throw new Error(`Staged file não encontrado: ${id}`);
  
  await writeProjectFile(projectRoot, file.path, file.content);
  store.delete(id);
  await saveDb();
  return file;
}

