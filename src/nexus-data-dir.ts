import { mkdir, rename, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
const defaultDataDir = path.resolve(process.env.NEXUS_APP_ROOT || process.cwd(), 'data');

export function getNexusDataDir() {
  return process.env.NEXUS_DATA_DIR ? path.resolve(process.env.NEXUS_DATA_DIR) : defaultDataDir;
}

export function resolveNexusDataPath(...parts: string[]) {
  return path.join(getNexusDataDir(), ...parts);
}

export async function ensureNexusDataDir(...parts: string[]) {
  const dir = resolveNexusDataPath(...parts);
  await mkdir(dir, { recursive: true });
  return dir;
}

export function getStorePath(storeName: string) {
  return resolveNexusDataPath(storeName);
}

function isRetryableReplaceError(error: unknown) {
  const code = (error as NodeJS.ErrnoException)?.code;
  return code === 'EPERM' || code === 'EACCES' || code === 'EBUSY';
}

function wait(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function replaceFile(tempPath: string, filePath: string) {
  let lastError: unknown;

  for (let attempt = 0; attempt < 5; attempt += 1) {
    try {
      await rename(tempPath, filePath);
      return;
    } catch (error) {
      if (!isRetryableReplaceError(error)) {
        throw error;
      }
      lastError = error;
      await wait(20 * (attempt + 1));
    }
  }

  // Windows can briefly hold the destination after reads; fall back to a replace.
  await rm(filePath, { force: true }).catch(() => null);
  try {
    await rename(tempPath, filePath);
  } catch (error) {
    throw lastError || error;
  }
}

export async function atomicWriteFile(filePath: string, content: string) {
  await mkdir(path.dirname(filePath), { recursive: true });
  const tempPath = path.join(
    path.dirname(filePath),
    `.${path.basename(filePath)}.${randomUUID()}.tmp`,
  );
  await writeFile(tempPath, content, 'utf8');
  await replaceFile(tempPath, filePath);
}

export async function atomicWriteJson(filePath: string, value: unknown) {
  await atomicWriteFile(filePath, JSON.stringify(value, null, 2));
}
