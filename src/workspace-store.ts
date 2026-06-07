import {
  mkdir,
  readdir,
  readFile as readFsFile,
  rm,
  stat,
  writeFile as writeFsFile,
} from 'node:fs/promises';
import path from 'node:path';
const workspaceDir = path.resolve(process.env.NEXUS_APP_ROOT || process.cwd(), 'workspace');
const MAX_FILE_SIZE_BYTES = 512 * 1024;
const BLOCKED_FILENAMES = new Set(['.env', 'id_rsa', 'secrets.json', 'token.json']);
const BLOCKED_EXTENSIONS = new Set(['.pem', '.key']);

export interface WorkspaceFileEntry {
  path: string;
  name: string;
  type: 'file';
  size: number;
  updatedAt: string;
}

const ALLOWED_EXTENSIONS = new Set([
  '.ts',
  '.tsx',
  '.js',
  '.jsx',
  '.json',
  '.md',
  '.css',
  '.html',
  '.txt',
  '.yml',
  '.yaml',
]);

export async function ensureWorkspace() {
  await mkdir(workspaceDir, { recursive: true });
}

function normalizeRelativePath(targetPath: string) {
  const raw = String(targetPath || '');
  if (raw.includes('\0')) {
    throw new Error('Caminho invalido');
  }

  let decoded: string;
  try {
    decoded = decodeURIComponent(raw);
  } catch {
    throw new Error('Caminho invalido');
  }

  if (decoded.includes('\0')) {
    throw new Error('Caminho invalido');
  }

  const trimmed = decoded.trim().replace(/\\/g, '/');

  if (!trimmed || trimmed.startsWith('/') || path.isAbsolute(trimmed) || trimmed.includes('..')) {
    throw new Error('Caminho invalido');
  }

  return trimmed;
}

export function resolveWorkspacePath(targetPath: string) {
  const normalized = normalizeRelativePath(targetPath);
  const absolutePath = path.resolve(workspaceDir, normalized);
  const relative = path.relative(workspaceDir, absolutePath);

  if (relative.startsWith('..') || path.isAbsolute(relative)) {
    throw new Error('Acesso fora do workspace nao permitido');
  }

  const extension = path.extname(absolutePath).toLowerCase();
  if (extension && !ALLOWED_EXTENSIONS.has(extension)) {
    throw new Error(`Extensao nao permitida: ${extension}`);
  }

  const basename = path.basename(absolutePath).toLowerCase();
  if (BLOCKED_FILENAMES.has(basename) || BLOCKED_EXTENSIONS.has(extension)) {
    throw new Error('Arquivo sensivel bloqueado pelo Nexus');
  }

  return { normalized, absolutePath };
}

export function getWorkspaceRoot() {
  return workspaceDir;
}

async function listFilesRecursive(baseDir: string, prefix = ''): Promise<WorkspaceFileEntry[]> {
  const entries = await readdir(baseDir, { withFileTypes: true });
  const files: WorkspaceFileEntry[] = [];

  for (const entry of entries) {
    const absolutePath = path.join(baseDir, entry.name);
    const relativePath = prefix ? `${prefix}/${entry.name}` : entry.name;

    if (entry.isDirectory()) {
      files.push(...(await listFilesRecursive(absolutePath, relativePath)));
      continue;
    }

    const extension = path.extname(entry.name).toLowerCase();
    if (extension && !ALLOWED_EXTENSIONS.has(extension)) {
      continue;
    }

    const info = await stat(absolutePath);
    files.push({
      path: relativePath.replace(/\\/g, '/'),
      name: entry.name,
      type: 'file',
      size: info.size,
      updatedAt: info.mtime.toISOString(),
    });
  }

  return files.sort((a, b) => a.path.localeCompare(b.path));
}

export async function listFiles() {
  await ensureWorkspace();
  return listFilesRecursive(workspaceDir);
}

export async function readFile(targetPath: string) {
  await ensureWorkspace();
  const { absolutePath, normalized } = resolveWorkspacePath(targetPath);
  const info = await stat(absolutePath);

  if (info.size > MAX_FILE_SIZE_BYTES) {
    throw new Error(`Arquivo muito grande para abrir no Nexus (${info.size} bytes)`);
  }

  const content = await readFsFile(absolutePath, 'utf8');
  return {
    path: normalized,
    content,
  };
}

async function ensureParentDir(targetPath: string) {
  const directory = path.dirname(targetPath);
  await mkdir(directory, { recursive: true });
}

export async function writeFile(targetPath: string, content: string) {
  await ensureWorkspace();
  const { absolutePath, normalized } = resolveWorkspacePath(targetPath);
  if (Buffer.byteLength(content, 'utf8') > MAX_FILE_SIZE_BYTES) {
    throw new Error('Conteudo excede o limite permitido para esta fase');
  }
  await ensureParentDir(absolutePath);
  await writeFsFile(absolutePath, content, 'utf8');
  return {
    path: normalized,
    content,
  };
}

export async function createFile(targetPath: string, content = '') {
  return writeFile(targetPath, content);
}

export async function deleteFile(targetPath: string) {
  await ensureWorkspace();
  const { absolutePath, normalized } = resolveWorkspacePath(targetPath);
  const info = await stat(absolutePath);

  if (!info.isFile()) {
    throw new Error('Apenas arquivos podem ser removidos');
  }

  await rm(absolutePath, { force: false });
  return {
    path: normalized,
  };
}

export async function fileExists(targetPath: string) {
  await ensureWorkspace();
  try {
    const { absolutePath } = resolveWorkspacePath(targetPath);
    const info = await stat(absolutePath);
    return info.isFile();
  } catch {
    return false;
  }
}
