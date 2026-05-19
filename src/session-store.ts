import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { fileURLToPath } from "node:url";

import type { NexusIntent } from "./intent-classifier.js";

export type SessionMessageRole = "user" | "assistant" | "system";

export interface SessionMessage {
  id: string;
  role: SessionMessageRole;
  content: string;
  createdAt: string;
  intent?: NexusIntent;
  agents?: object[];
}

export interface SessionRecord {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  messages: SessionMessage[];
}

interface SessionDatabase {
  sessions: SessionRecord[];
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const dataDir = path.resolve(__dirname, "../data");
const sessionsFile = path.join(dataDir, "sessions.json");
const EMPTY_DB: SessionDatabase = { sessions: [] };

let initPromise: Promise<void> | null = null;
let writeQueue: Promise<void> = Promise.resolve();

function nowIso() {
  return new Date().toISOString();
}

function deriveTitle(title?: string) {
  const normalized = title?.replace(/\s+/g, " ").trim();
  if (!normalized) {
    return "Nova sessao";
  }

  return normalized.length > 60 ? `${normalized.slice(0, 57)}...` : normalized;
}

async function ensureStorage() {
  if (initPromise) {
    return initPromise;
  }

  initPromise = (async () => {
    await mkdir(dataDir, { recursive: true });

    try {
      await readFile(sessionsFile, "utf8");
    } catch {
      await writeFile(sessionsFile, JSON.stringify(EMPTY_DB, null, 2), "utf8");
    }
  })();

  return initPromise;
}

async function readDatabase(): Promise<SessionDatabase> {
  await ensureStorage();
  const raw = await readFile(sessionsFile, "utf8");

  try {
    const parsed = JSON.parse(raw) as SessionDatabase;
    return {
      sessions: Array.isArray(parsed.sessions) ? parsed.sessions : []
    };
  } catch {
    return EMPTY_DB;
  }
}

async function writeDatabase(db: SessionDatabase) {
  await ensureStorage();
  writeQueue = writeQueue.then(() =>
    writeFile(sessionsFile, JSON.stringify(db, null, 2), "utf8")
  );
  await writeQueue;
}

export async function createSession(title?: string): Promise<SessionRecord> {
  const db = await readDatabase();
  const timestamp = nowIso();
  const session: SessionRecord = {
    id: randomUUID(),
    title: deriveTitle(title),
    createdAt: timestamp,
    updatedAt: timestamp,
    messages: []
  };

  db.sessions.unshift(session);
  await writeDatabase(db);
  return session;
}

export async function listSessions(): Promise<SessionRecord[]> {
  const db = await readDatabase();
  return db.sessions.sort((a, b) => {
    return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
  });
}

export async function getSession(sessionId: string): Promise<null | SessionRecord> {
  const db = await readDatabase();
  return db.sessions.find((session) => session.id === sessionId) ?? null;
}

export async function deleteSession(sessionId: string): Promise<boolean> {
  const db = await readDatabase();
  const nextSessions = db.sessions.filter((session) => session.id !== sessionId);

  if (nextSessions.length === db.sessions.length) {
    return false;
  }

  db.sessions = nextSessions;
  await writeDatabase(db);
  return true;
}

export async function appendMessage(
  sessionId: string,
  message: Omit<SessionMessage, "createdAt" | "id">
): Promise<SessionMessage> {
  const db = await readDatabase();
  const session = db.sessions.find((entry) => entry.id === sessionId);

  if (!session) {
    throw new Error("Sessao nao encontrada");
  }

  const nextMessage: SessionMessage = {
    id: randomUUID(),
    createdAt: nowIso(),
    ...message
  };

  session.messages.push(nextMessage);
  session.updatedAt = nextMessage.createdAt;

  if (session.title === "Nova sessao" && message.role === "user") {
    session.title = deriveTitle(message.content);
  }

  await writeDatabase(db);
  return nextMessage;
}

export async function getRecentHistory(
  sessionId: string,
  limit = 10
): Promise<SessionMessage[]> {
  const session = await getSession(sessionId);
  if (!session) {
    return [];
  }

  return session.messages.slice(-limit);
}
