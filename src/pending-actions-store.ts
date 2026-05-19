import { randomUUID } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import type { ActionDraft, ActionRecord, ActionStatus } from "./action-types.js";

interface PendingActionsDatabase {
  actions: ActionRecord[];
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const dataDir = path.resolve(__dirname, "../data");
const pendingActionsFile = path.join(dataDir, "pending-actions.json");
const EMPTY_DB: PendingActionsDatabase = { actions: [] };

let initPromise: Promise<void> | null = null;
let writeQueue: Promise<void> = Promise.resolve();

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
      await readFile(pendingActionsFile, "utf8");
    } catch {
      await writeFile(pendingActionsFile, JSON.stringify(EMPTY_DB, null, 2), "utf8");
    }
  })();

  return initPromise;
}

async function readDatabase(): Promise<PendingActionsDatabase> {
  await ensureStorage();
  const raw = await readFile(pendingActionsFile, "utf8");

  try {
    const parsed = JSON.parse(raw) as PendingActionsDatabase;
    return {
      actions: Array.isArray(parsed.actions) ? parsed.actions : []
    };
  } catch {
    return EMPTY_DB;
  }
}

async function writeDatabase(db: PendingActionsDatabase) {
  await ensureStorage();
  writeQueue = writeQueue.then(() =>
    writeFile(pendingActionsFile, JSON.stringify(db, null, 2), "utf8")
  );
  await writeQueue;
}

function withLifecycle<T extends ActionDraft>(action: T, status: ActionStatus): ActionRecord {
  const timestamp = nowIso();

  return {
    ...action,
    id: randomUUID(),
    createdAt: timestamp,
    updatedAt: timestamp,
    status
  } as ActionRecord;
}

async function updateActionStatus(actionId: string, status: ActionStatus, error?: string) {
  const db = await readDatabase();
  const action = db.actions.find((item) => item.id === actionId);

  if (!action) {
    return null;
  }

  action.status = status;
  action.updatedAt = nowIso();
  action.error = error;
  await writeDatabase(db);
  return action;
}

export async function createPendingAction(sessionId: string, action: Omit<ActionDraft, "sessionId"> | ActionDraft) {
  const db = await readDatabase();
  const draft = ("sessionId" in action ? action : { ...action, sessionId }) as ActionDraft;
  const record = withLifecycle(draft, "pending");

  db.actions.unshift(record);
  await writeDatabase(db);
  return record;
}

export async function createPendingActions(sessionId: string, actions: Array<Omit<ActionDraft, "sessionId"> | ActionDraft>) {
  const created: ActionRecord[] = [];

  for (const action of actions) {
    created.push(await createPendingAction(sessionId, action));
  }

  return created;
}

export async function listPendingActions(sessionId?: string) {
  const db = await readDatabase();
  const filtered = sessionId ? db.actions.filter((action) => action.sessionId === sessionId) : db.actions;
  return filtered.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
}

export async function getPendingAction(actionId: string) {
  const db = await readDatabase();
  return db.actions.find((action) => action.id === actionId) ?? null;
}

export async function approveAction(actionId: string) {
  return updateActionStatus(actionId, "approved");
}

export async function rejectAction(actionId: string) {
  return updateActionStatus(actionId, "rejected");
}

export async function markActionApplied(actionId: string) {
  return updateActionStatus(actionId, "applied");
}

export async function markActionFailed(actionId: string, error: string) {
  return updateActionStatus(actionId, "failed", error);
}
