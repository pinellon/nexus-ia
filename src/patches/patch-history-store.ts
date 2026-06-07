import { randomUUID } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';

import type { ActionRiskLevel, ActionStatus } from '../action-types.js';
import { atomicWriteJson, resolveNexusDataPath } from '../nexus-data-dir.js';

export interface AiEditHistoryFile {
  path: string;
  actionId: string;
  diff: string;
}

export interface AiEditHistoryRecord {
  id: string;
  instruction: string;
  summary: string;
  projectRoot: string;
  riskLevel: ActionRiskLevel;
  status: ActionStatus | 'undone';
  files: AiEditHistoryFile[];
  createdAt: string;
  updatedAt: string;
  backupIds?: string[];
  source: 'ai' | 'fallback' | 'test';
}

interface AiEditHistoryDatabase {
  edits: AiEditHistoryRecord[];
}

const historyPath = resolveNexusDataPath('ai-edit-history.json');
const EMPTY_DB: AiEditHistoryDatabase = { edits: [] };

let initPromise: Promise<void> | null = null;
let writeQueue: Promise<void> = Promise.resolve();

function nowIso() {
  return new Date().toISOString();
}

async function ensureStorage() {
  if (initPromise) return initPromise;
  initPromise = (async () => {
    await mkdir(resolveNexusDataPath(), { recursive: true });
    try {
      await readFile(historyPath, 'utf8');
    } catch {
      await writeFile(historyPath, JSON.stringify(EMPTY_DB, null, 2), 'utf8');
    }
  })();
  return initPromise;
}

async function readDb(): Promise<AiEditHistoryDatabase> {
  await ensureStorage();
  try {
    const parsed = JSON.parse(await readFile(historyPath, 'utf8')) as AiEditHistoryDatabase;
    return { edits: Array.isArray(parsed.edits) ? parsed.edits : [] };
  } catch {
    return EMPTY_DB;
  }
}

async function mutateDb<T>(mutator: (db: AiEditHistoryDatabase) => T | Promise<T>) {
  const operation = writeQueue.then(async () => {
    const db = await readDb();
    const result = await mutator(db);
    await atomicWriteJson(historyPath, db);
    return result;
  });
  writeQueue = operation.then(
    () => undefined,
    () => undefined,
  );
  return operation;
}

export async function createAiEditHistory(
  input: Omit<AiEditHistoryRecord, 'id' | 'createdAt' | 'updatedAt' | 'status'>,
) {
  return mutateDb((db) => {
    const timestamp = nowIso();
    const record: AiEditHistoryRecord = {
      ...input,
      id: randomUUID(),
      status: 'pending',
      createdAt: timestamp,
      updatedAt: timestamp,
    };
    db.edits.unshift(record);
    return record;
  });
}

export async function updateAiEditHistory(
  id: string,
  updates: Partial<Pick<AiEditHistoryRecord, 'status' | 'backupIds'>>,
) {
  return mutateDb((db) => {
    const record = db.edits.find((item) => item.id === id);
    if (!record) return null;
    Object.assign(record, updates, { updatedAt: nowIso() });
    return record;
  });
}

export async function updateAiEditHistoryByAction(
  actionId: string,
  updates: Partial<Pick<AiEditHistoryRecord, 'status' | 'backupIds'>>,
) {
  return mutateDb((db) => {
    const record = db.edits.find((item) => item.files.some((file) => file.actionId === actionId));
    if (!record) return null;
    Object.assign(record, updates, { updatedAt: nowIso() });
    return record;
  });
}

export async function getAiEditHistory(id: string) {
  const db = await readDb();
  return db.edits.find((item) => item.id === id) ?? null;
}

export async function listAiEditHistory() {
  const db = await readDb();
  return db.edits.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
}
