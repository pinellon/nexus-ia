import { readdir, readFile, stat } from 'node:fs/promises';
import path from 'node:path';

import { resolveNexusDataPath } from './nexus-data-dir.js';
import { readProjectFile, writeProjectFile } from './project-file-store.js';
import { buildUnifiedDiff } from './patch-payload.js';

export interface BackupEntry {
  id: string;
  actionId: string;
  path: string;
  backupPath: string;
  updatedAt: string;
  size: number;
}

const backupsRoot = resolveNexusDataPath('backups');

async function walk(dir: string, files: string[] = []) {
  let entries;
  try {
    entries = await readdir(dir, { withFileTypes: true });
  } catch {
    return files;
  }

  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      await walk(full, files);
    } else if (entry.isFile() && entry.name.endsWith('.bak')) {
      files.push(full);
    }
  }
  return files;
}

function entryFromPath(
  filePath: string,
  info: Awaited<ReturnType<typeof stat>>,
): BackupEntry | null {
  const relative = path.relative(backupsRoot, filePath).replace(/\\/g, '/');
  const parts = relative.split('/');
  if (parts.length < 2) return null;
  const actionId = parts.shift() || '';
  const restoredPath = parts.join('/').replace(/\.bak$/i, '');
  if (!actionId || !restoredPath) return null;
  return {
    id: Buffer.from(relative).toString('base64url'),
    actionId,
    path: restoredPath,
    backupPath: filePath,
    updatedAt: info.mtime.toISOString(),
    size: Number(info.size),
  };
}

export async function listBackups(): Promise<BackupEntry[]> {
  const files = await walk(backupsRoot);

  const entries = (
    await Promise.all(
      files.map(async (file) => {
        try {
          const info = await stat(file);
          return entryFromPath(file, info);
        } catch {
          return null;
        }
      }),
    )
  ).filter((entry): entry is BackupEntry => entry !== null);

  return entries.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
}

export async function getBackup(id: string) {
  return (await listBackups()).find((entry) => entry.id === id) ?? null;
}

export async function previewBackupRestore(projectRoot: string, id: string) {
  const backup = await getBackup(id);
  if (!backup) {
    throw new Error('Backup nao encontrado');
  }
  const backupContent = await readFile(backup.backupPath, 'utf8');
  let current = '';
  try {
    current = (await readProjectFile(projectRoot, backup.path)).content;
  } catch {
    current = '';
  }
  return {
    backup,
    before: current,
    after: backupContent,
    diff: buildUnifiedDiff(current, backupContent, backup.path),
  };
}

export async function restoreBackup(projectRoot: string, id: string) {
  const preview = await previewBackupRestore(projectRoot, id);
  const restored = await writeProjectFile(projectRoot, preview.backup.path, preview.after);
  return {
    backup: preview.backup,
    restored,
  };
}
