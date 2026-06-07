import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';

import type { NexusIntent } from './intent-classifier.js';
import { resolveNexusDataPath } from './nexus-data-dir.js';

export type SessionMessageRole = 'user' | 'assistant' | 'system';

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

const dataDir = resolveNexusDataPath();
const sessionsFile = resolveNexusDataPath('sessions.json');
const EMPTY_DB: SessionDatabase = { sessions: [] };

let initPromise: Promise<void> | null = null;
let writeQueue: Promise<void> = Promise.resolve();

// In-memory cache to avoid reading the file on every operation
let cachedDB: SessionDatabase | null = null;
let cacheVersion = 0;

function nowIso() {
  return new Date().toISOString();
}

function deriveTitle(title?: string) {
  const normalized = title?.replace(/\s+/g, ' ').trim();
  if (!normalized) {
    return 'Nova sessao';
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
      await readFile(sessionsFile, 'utf8');
    } catch {
      await writeFile(sessionsFile, JSON.stringify(EMPTY_DB, null, 2), 'utf8');
    }
  })();

  return initPromise;
}

async function readDatabase(): Promise<SessionDatabase> {
  // Return cached version if available
  if (cachedDB) {
    return cachedDB;
  }

  await ensureStorage();
  const raw = await readFile(sessionsFile, 'utf8');

  try {
    const parsed = JSON.parse(raw) as SessionDatabase;
    cachedDB = {
      sessions: Array.isArray(parsed.sessions) ? parsed.sessions : [],
    };
    return cachedDB;
  } catch {
    cachedDB = { ...EMPTY_DB };
    return cachedDB;
  }
}

async function writeDatabase(db: SessionDatabase) {
  await ensureStorage();
  // Update cache immediately
  cachedDB = db;
  cacheVersion++;

  // Write to disk asynchronously (debounced via queue)
  const currentVersion = cacheVersion;
  writeQueue = writeQueue.then(async () => {
    // Skip write if a newer version has already been queued
    if (currentVersion < cacheVersion) return;
    await writeFile(sessionsFile, JSON.stringify(db, null, 2), 'utf8');
  });
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
    messages: [],
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
  message: Omit<SessionMessage, 'createdAt' | 'id'>,
): Promise<SessionMessage> {
  const db = await readDatabase();
  const session = db.sessions.find((entry) => entry.id === sessionId);

  if (!session) {
    throw new Error('Sessao nao encontrada');
  }

  const nextMessage: SessionMessage = {
    id: randomUUID(),
    createdAt: nowIso(),
    ...message,
  };

  session.messages.push(nextMessage);
  session.updatedAt = nextMessage.createdAt;

  if (session.title === 'Nova sessao' && message.role === 'user') {
    session.title = deriveTitle(message.content);
  }

  await writeDatabase(db);
  return nextMessage;
}

export async function getRecentHistory(sessionId: string, limit = 10): Promise<SessionMessage[]> {
  const session = await getSession(sessionId);
  if (!session) {
    return [];
  }

  return session.messages.slice(-limit);
}
