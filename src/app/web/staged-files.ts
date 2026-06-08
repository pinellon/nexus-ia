import { randomUUID } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { projectFileExists, readProjectFile, resolveProjectRoot, writeProjectFile } from "../../project-file-store.js";
import { nowIso } from "../agents/utils.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DATA_DIR = path.resolve(__dirname, "../../../data");
const DB_PATH = path.join(DATA_DIR, "staged-files.json");
const BACKUPS_DIR = path.join(DATA_DIR, "backups", "staged-files");

export interface StagedFileVersion {
  version_id: string;
  content: string;
  created_at: string;
}

export interface StagedFile {
  id: string;
  projectRoot?: string;
  path: string;
  language: string;
  content: string;
  baselineContent?: string | null;
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

function normalizeForStaleCheck(value: string) {
  return value.replace(/\r\n/g, "\n").trimEnd();
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
    baselineContent: Object.prototype.hasOwnProperty.call(input, "baselineContent")
      ? input.baselineContent
      : existing?.baselineContent,
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
  if (file?.projectRoot) {
    const activeRoot = resolveProjectRoot(projectRoot).absoluteRoot;
    const stagedRoot = resolveProjectRoot(file.projectRoot).absoluteRoot;
    if (activeRoot !== stagedRoot) {
      throw new Error("Este patch aponta para fora do projeto ativo e foi bloqueado por seguranca.");
    }
  }
  if (!file) throw new Error(`Staged file não encontrado: ${id}`);
  
  const exists = await projectFileExists(projectRoot, file.path);
  const currentContent = exists ? (await readProjectFile(projectRoot, file.path)).content : "";

  if (file.baselineContent === null && exists) {
    throw new Error(`O arquivo ${file.path} foi criado desde a proposta. Recalcule o patch antes de aplicar.`);
  }

  if (
    typeof file.baselineContent === "string" &&
    normalizeForStaleCheck(currentContent) !== normalizeForStaleCheck(file.baselineContent)
  ) {
    throw new Error(`O arquivo ${file.path} mudou desde a proposta. Salve/revise e recalcule antes de aplicar.`);
  }

  let backupPath: string | null = null;
  if (exists) {
    backupPath = path.join(BACKUPS_DIR, id, `${file.path}.bak`);
    await mkdir(path.dirname(backupPath), { recursive: true });
    await writeFile(backupPath, currentContent, "utf8");
  }

  await writeProjectFile(projectRoot, file.path, file.content);
  store.delete(id);
  await saveDb();
  return { ...file, backupPath };
}
