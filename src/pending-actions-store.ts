import { randomUUID } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';

import type { ActionDraft, ActionRecord, ActionStatus } from './action-types.js';
import { atomicWriteJson, resolveNexusDataPath } from './nexus-data-dir.js';

interface PendingActionsDatabase {
  actions: ActionRecord[];
}

const dataDir = resolveNexusDataPath();
const pendingActionsFile = resolveNexusDataPath('pending-actions.json');
const EMPTY_DB: PendingActionsDatabase = { actions: [] };

let initPromise: Promise<void> | null = null;
let writeQueue: Promise<void> = Promise.resolve();

/**
 * In-memory cache to avoid repeated disk reads within the same process.
 * Invalidated on every write operation.
 */
let cachedDb: PendingActionsDatabase | null = null;

function nowIso() {
  return new Date().toISOString();
}

async function ensureStorage() {
  if (initPromise) {
    return initPromise;
  }

  initPromise = (async () => {
    await mkdir(dataDir, { recursive: true });

    try {
      await readFile(pendingActionsFile, 'utf8');
    } catch {
      await writeFile(pendingActionsFile, JSON.stringify(EMPTY_DB, null, 2), 'utf8');
    }
  })();

  return initPromise;
}

async function readDatabase(): Promise<PendingActionsDatabase> {
  if (cachedDb) {
    return cachedDb;
  }

  await ensureStorage();
  const raw = await readFile(pendingActionsFile, 'utf8');

  try {
    const parsed = JSON.parse(raw) as PendingActionsDatabase;
    cachedDb = {
      actions: Array.isArray(parsed.actions) ? parsed.actions : [],
    };
    return cachedDb;
  } catch {
    return EMPTY_DB;
  }
}

async function writeDatabase(db: PendingActionsDatabase) {
  await ensureStorage();
  cachedDb = null; // Invalidate cache before write
  writeQueue = writeQueue.then(
    () => atomicWriteJson(pendingActionsFile, db),
    () => atomicWriteJson(pendingActionsFile, db),
  );
  await writeQueue;
  cachedDb = db; // Re-populate cache after successful write
}

async function mutateDatabase<T>(mutator: (db: PendingActionsDatabase) => T | Promise<T>) {
  const operation = writeQueue.then(async () => {
    cachedDb = null; // Invalidate cache at start of mutation
    const db = await readDatabase();
    const result = await mutator(db);
    cachedDb = null; // Invalidate before atomic write
    await atomicWriteJson(pendingActionsFile, db);
    cachedDb = db; // Re-populate after success
    return result;
  });
  writeQueue = operation.then(
    () => undefined,
    () => {
      cachedDb = null; // Invalidate on error too
    },
  );
  return operation;
}

function withLifecycle<T extends ActionDraft>(action: T, status: ActionStatus): ActionRecord {
  const timestamp = nowIso();

  return {
    ...action,
    id: randomUUID(),
    createdAt: timestamp,
    updatedAt: timestamp,
    status,
  } as ActionRecord;
}

async function updateActionStatus(actionId: string, status: ActionStatus, error?: string) {
  return mutateDatabase((db) => {
    const action = db.actions.find((item) => item.id === actionId);

    if (!action) {
      return null;
    }

    action.status = status;
    action.updatedAt = nowIso();
    action.error = error;
    return action;
  });
}

export async function createPendingAction(
  sessionId: string,
  action: Omit<ActionDraft, 'sessionId'> | ActionDraft,
) {
  return mutateDatabase((db) => {
    const draft = ('sessionId' in action ? action : { ...action, sessionId }) as ActionDraft;
    const record = withLifecycle(draft, 'pending');

    db.actions.unshift(record);
    return record;
  });
}

export async function createPendingActions(
  sessionId: string,
  actions: Array<Omit<ActionDraft, 'sessionId'> | ActionDraft>,
) {
  const created: ActionRecord[] = [];

  for (const action of actions) {
    created.push(await createPendingAction(sessionId, action));
  }

  return created;
}

export async function listPendingActions(sessionId?: string) {
  const db = await readDatabase();
  const filtered = sessionId
    ? db.actions.filter((action) => action.sessionId === sessionId)
    : db.actions;
  return filtered.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
}

export async function getPendingAction(actionId: string) {
  const db = await readDatabase();
  return db.actions.find((action) => action.id === actionId) ?? null;
}

export async function approveAction(actionId: string) {
  return updateActionStatus(actionId, 'approved');
}

export async function setActionExpectedHash(actionId: string, expectedHash: string) {
  return mutateDatabase((db) => {
    const action = db.actions.find((item) => item.id === actionId);

    if (!action || !('content' in action)) {
      return null;
    }

    action.expectedHash = expectedHash;
    action.updatedAt = nowIso();
    return action;
  });
}

export async function rejectAction(actionId: string) {
  return updateActionStatus(actionId, 'rejected');
}

export async function markActionApplied(actionId: string) {
  return updateActionStatus(actionId, 'applied');
}

export async function markActionFailed(actionId: string, error: string) {
  return updateActionStatus(actionId, 'failed', error);
}
