import {
  mkdir,
  readdir,
  readFile as readFsFile,
  rename,
  rm,
  stat,
  writeFile as writeFsFile,
} from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { hashFileContent } from './file-content-hash.js';

const repositoryRoot = process.env.NEXUS_APP_ROOT
  ? path.resolve(process.env.NEXUS_APP_ROOT)
  : process.cwd();

const MAX_FILE_SIZE_BYTES = 512 * 1024;
const MAX_TREE_ENTRIES = 1_500;
const BLOCKED_NAMES = new Set(['.env', 'id_rsa', 'secrets.json', 'token.json']);
const BLOCKED_EXTENSIONS = new Set(['.pem', '.key']);
const BLOCKED_DIRECTORIES = new Set(['.git', 'node_modules', 'dist', 'data', 'coverage']);
const TEXT_EXTENSIONS = new Set([
  '.c',
  '.cc',
  '.cpp',
  '.css',
  '.go',
  '.html',
  '.java',
  '.js',
  '.json',
  '.jsx',
  '.mjs',
  '.md',
  '.py',
  '.rb',
  '.rs',
  '.sh',
  '.sql',
  '.svg',
  '.toml',
  '.ts',
  '.tsx',
  '.txt',
  '.xml',
  '.yaml',
  '.yml',
]);

export interface ProjectFileEntry {
  path: string;
  name: string;
  type: 'file';
  size: number;
  updatedAt: string;
}

export interface ProjectTreeNode {
  path: string;
  name: string;
  type: 'file' | 'directory';
  size?: number;
  updatedAt?: string;
  children?: ProjectTreeNode[];
}

function isBlockedName(value: string) {
  const normalized = value.toLowerCase();
  return BLOCKED_NAMES.has(normalized) || normalized === '.env' || normalized.startsWith('.env.');
}

function isBlockedExtension(value: string) {
  return BLOCKED_EXTENSIONS.has(path.extname(value).toLowerCase());
}

function isTextFile(value: string) {
  const extension = path.extname(value).toLowerCase();
  return !extension || TEXT_EXTENSIONS.has(extension);
}

function normalizeRelativeTarget(targetPath: string) {
  const decoded = decodePathInput(targetPath);
  const trimmed = decoded.trim().replace(/\\/g, '/');
  assertSafeRelativePath(trimmed, 'Caminho invalido');
  return trimmed;
}

function decodePathInput(value: string) {
  const raw = String(value || '');
  if (raw.includes('\0')) {
    throw new Error('Caminho invalido');
  }
  try {
    const decoded = decodeURIComponent(raw);
    if (decoded.includes('\0')) {
      throw new Error('Caminho invalido');
    }
    return decoded;
  } catch {
    throw new Error('Caminho invalido');
  }
}

function assertSafeRelativePath(requested: string, errorMessage: string) {
  if (
    !requested ||
    requested === '.' ||
    requested.startsWith('/') ||
    path.isAbsolute(requested) ||
    requested.includes('..')
  ) {
    throw new Error(errorMessage);
  }
}

function sanitizeRootInput(projectRoot: string) {
  const raw = String(projectRoot || '').trim();
  if (!raw) {
    return '.';
  }

  return raw.replace(/\\/g, '/');
}

function assertAllowedAbsoluteRoot(absoluteRoot: string) {
  const relative = path.relative(repositoryRoot, absoluteRoot);
  if (relative.startsWith('..') || path.isAbsolute(relative)) {
    throw new Error('project_root precisa ficar dentro do repositorio atual');
  }
}

function validateRelativeSegments(relativePath: string) {
  const segments = relativePath.split('/').filter(Boolean);
  for (const segment of segments) {
    const normalized = segment.toLowerCase();
    if (BLOCKED_DIRECTORIES.has(normalized)) {
      throw new Error(`Acesso ao diretorio bloqueado: ${segment}`);
    }
    if (isBlockedName(normalized)) {
      throw new Error(`Acesso ao arquivo sensivel bloqueado: ${segment}`);
    }
  }
}

function buildProjectId(absoluteRoot: string) {
  const relative = path.relative(repositoryRoot, absoluteRoot).replace(/\\/g, '/') || 'root';
  const readable = relative.replace(/[^a-zA-Z0-9/_-]/g, '-').replace(/\//g, '__');
  const shortHash = createHash('sha1').update(absoluteRoot).digest('hex').slice(0, 8);
  return `${readable}-${shortHash}`;
}

export function getRepositoryRoot() {
  return repositoryRoot;
}

export function resolveProjectRoot(projectRoot: string) {
  const sanitized = sanitizeRootInput(projectRoot);
  const absoluteRoot = path.resolve(repositoryRoot, sanitized);
  assertAllowedAbsoluteRoot(absoluteRoot);

  return {
    input: sanitized,
    absoluteRoot,
    projectId: buildProjectId(absoluteRoot),
  };
}

export async function ensureProjectRoot(projectRoot: string) {
  const resolved = resolveProjectRoot(projectRoot);
  await mkdir(resolved.absoluteRoot, { recursive: true });
  return resolved;
}

export function resolveProjectPath(projectRoot: string, targetPath: string) {
  const { absoluteRoot, projectId } = resolveProjectRoot(projectRoot);
  const normalized = normalizeRelativeTarget(targetPath);
  validateRelativeSegments(normalized);

  const absolutePath = path.resolve(absoluteRoot, normalized);
  const relative = path.relative(absoluteRoot, absolutePath).replace(/\\/g, '/');

  if (relative.startsWith('..') || path.isAbsolute(relative)) {
    throw new Error('Acesso fora do projeto nao permitido');
  }

  validateRelativeSegments(relative);
  if (isBlockedExtension(relative)) {
    throw new Error(`Extensao sensivel bloqueada: ${path.extname(relative)}`);
  }

  return {
    projectId,
    normalized: relative,
    absoluteRoot,
    absolutePath,
  };
}

export function fileHashMatches(content: string, expectedHash: string) {
  return hashFileContent(content) === expectedHash;
}

async function walkTree(
  baseDir: string,
  rootDir: string,
  limit: { count: number },
): Promise<ProjectTreeNode[]> {
  const entries = await readdir(baseDir, { withFileTypes: true });
  const nodes: ProjectTreeNode[] = [];

  for (const entry of entries.sort((left, right) => left.name.localeCompare(right.name))) {
    if (limit.count >= MAX_TREE_ENTRIES) {
      break;
    }

    const absolutePath = path.join(baseDir, entry.name);
    const relativePath = path.relative(rootDir, absolutePath).replace(/\\/g, '/');
    const normalizedName = entry.name.toLowerCase();

    if (
      BLOCKED_DIRECTORIES.has(normalizedName) ||
      isBlockedName(normalizedName) ||
      isBlockedExtension(entry.name)
    ) {
      continue;
    }

    if (entry.isDirectory()) {
      limit.count += 1;
      nodes.push({
        path: relativePath,
        name: entry.name,
        type: 'directory',
        children: await walkTree(absolutePath, rootDir, limit),
      });
      continue;
    }

    if (!isTextFile(entry.name)) {
      continue;
    }

    const info = await stat(absolutePath);
    limit.count += 1;
    nodes.push({
      path: relativePath,
      name: entry.name,
      type: 'file',
      size: info.size,
      updatedAt: info.mtime.toISOString(),
    });
  }

  return nodes;
}

export async function listProjectTree(projectRoot: string) {
  const { absoluteRoot } = await ensureProjectRoot(projectRoot);
  return walkTree(absoluteRoot, absoluteRoot, { count: 0 });
}

async function flattenTree(nodes: ProjectTreeNode[], files: ProjectFileEntry[]) {
  for (const node of nodes) {
    if (node.type === 'file') {
      files.push({
        path: node.path,
        name: node.name,
        type: 'file',
        size: node.size ?? 0,
        updatedAt: node.updatedAt ?? new Date(0).toISOString(),
      });
      continue;
    }

    if (node.children?.length) {
      await flattenTree(node.children, files);
    }
  }
}

export async function listProjectFiles(projectRoot: string) {
  const files: ProjectFileEntry[] = [];
  await flattenTree(await listProjectTree(projectRoot), files);
  return files.sort((left, right) => left.path.localeCompare(right.path));
}

export async function readProjectFile(projectRoot: string, targetPath: string) {
  const { absolutePath, normalized } = resolveProjectPath(projectRoot, targetPath);
  const info = await stat(absolutePath);

  if (!info.isFile()) {
    throw new Error('O caminho informado nao e um arquivo');
  }

  if (info.size > MAX_FILE_SIZE_BYTES) {
    throw new Error(`Arquivo muito grande para abrir (${info.size} bytes)`);
  }

  return {
    path: normalized,
    content: await readFsFile(absolutePath, 'utf8'),
  };
}

async function ensureParentDirectory(absolutePath: string) {
  await mkdir(path.dirname(absolutePath), { recursive: true });
}

export async function writeProjectFile(projectRoot: string, targetPath: string, content: string) {
  const { absolutePath, normalized } = resolveProjectPath(projectRoot, targetPath);
  if (Buffer.byteLength(content, 'utf8') > MAX_FILE_SIZE_BYTES) {
    throw new Error('Conteudo excede o limite permitido');
  }

  await ensureParentDirectory(absolutePath);
  await writeFsFile(absolutePath, content, 'utf8');
  return {
    path: normalized,
    content,
  };
}

export async function createProjectFolder(projectRoot: string, targetPath: string) {
  const { absolutePath, normalized } = resolveProjectPath(projectRoot, targetPath);
  await mkdir(absolutePath, { recursive: false });
  return { path: normalized };
}

export async function renameProjectPath(projectRoot: string, oldPath: string, newPath: string) {
  const oldTarget = resolveProjectPath(projectRoot, oldPath);
  const newTarget = resolveProjectPath(projectRoot, newPath);

  try {
    await stat(newTarget.absolutePath);
    throw new Error('Destino ja existe');
  } catch (error) {
    if (error instanceof Error && error.message === 'Destino ja existe') {
      throw error;
    }
  }

  await ensureParentDirectory(newTarget.absolutePath);
  await rename(oldTarget.absolutePath, newTarget.absolutePath);
  return {
    oldPath: oldTarget.normalized,
    newPath: newTarget.normalized,
  };
}

export async function deleteProjectFile(projectRoot: string, targetPath: string) {
  const { absolutePath, normalized } = resolveProjectPath(projectRoot, targetPath);
  const info = await stat(absolutePath);

  if (!info.isFile()) {
    throw new Error('Apenas arquivos podem ser removidos');
  }

  await rm(absolutePath, { force: false });
  return { path: normalized };
}

export async function deleteProjectFolder(projectRoot: string, targetPath: string) {
  const { absolutePath, normalized } = resolveProjectPath(projectRoot, targetPath);
  const info = await stat(absolutePath);

  if (!info.isDirectory()) {
    throw new Error('Apenas pastas podem ser removidas por este endpoint');
  }

  await rm(absolutePath, { recursive: true, force: false });
  return { path: normalized };
}

export async function projectFileExists(projectRoot: string, targetPath: string) {
  try {
    const { absolutePath } = resolveProjectPath(projectRoot, targetPath);
    const info = await stat(absolutePath);
    return info.isFile();
  } catch {
    return false;
  }
}
