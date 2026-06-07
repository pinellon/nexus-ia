import { existsSync, readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import path from 'node:path';

import { getRepositoryRoot, listProjectTree, resolveProjectRoot } from './project-file-store.js';

export interface ProjectSnapshot {
  projectName: string;
  projectPath: string;
  framework: string;
  branch: string;
  changedFiles: number;
  gitStatusSummary: string[];
  lastCommit: string;
  detectedCommands: {
    dev: string | null;
    build: string | null;
    test: string | null;
    typecheck: string | null;
  };
}

function runGitCommand(projectRoot: string, args: string[]) {
  const result = spawnSync('git', args, {
    cwd: projectRoot,
    encoding: 'utf8',
    windowsHide: true,
    env: {
      ...process.env,
      GIT_CEILING_DIRECTORIES: getRepositoryRoot(),
    },
  });

  if (result.error || result.status !== 0) {
    return {
      ok: false,
      stdout: '',
      stderr: result.stderr?.trim() || result.error?.message || 'Falha ao executar Git',
    };
  }

  return {
    ok: true,
    stdout: result.stdout.trim(),
    stderr: result.stderr?.trim() || '',
  };
}

function assertGitOk(result: ReturnType<typeof runGitCommand>, fallback: string) {
  if (!result.ok) {
    throw new Error(result.stderr || fallback);
  }
  return result;
}

function normalizeGitPath(filePath: string) {
  const normalized = String(filePath || '')
    .trim()
    .replace(/\\/g, '/');
  if (!normalized || normalized.startsWith('/') || normalized.includes('..')) {
    throw new Error('Caminho Git invalido');
  }
  return normalized;
}

function detectFramework(packageJson: {
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
}) {
  const deps = {
    ...(packageJson.dependencies ?? {}),
    ...(packageJson.devDependencies ?? {}),
  };

  if ('next' in deps) {
    return 'Next.js';
  }
  if ('react' in deps && 'vite' in deps) {
    return 'React + Vite';
  }
  if ('react' in deps) {
    return 'React';
  }
  if ('vue' in deps) {
    return 'Vue';
  }
  if ('express' in deps) {
    return 'Express';
  }
  if ('fastify' in deps) {
    return 'Fastify';
  }

  return 'Nao detectado';
}

function readPackageJson(projectRoot: string) {
  const packageJsonPath = path.join(projectRoot, 'package.json');
  if (!existsSync(packageJsonPath)) {
    return null;
  }

  return JSON.parse(readFileSync(packageJsonPath, 'utf8')) as {
    name?: string;
    scripts?: Record<string, string>;
    dependencies?: Record<string, string>;
    devDependencies?: Record<string, string>;
  };
}

export function readProjectSnapshot(projectRootInput = '.'): ProjectSnapshot {
  const resolved = resolveProjectRoot(projectRootInput);
  const packageJson = readPackageJson(resolved.absoluteRoot);
  const branch =
    runGitCommand(resolved.absoluteRoot, ['branch', '--show-current']).stdout || 'Sem Git';
  const gitStatusLines = runGitCommand(resolved.absoluteRoot, ['status', '--short'])
    .stdout.split('\n')
    .map((line) => line.trim())
    .filter(Boolean);
  const lastCommit =
    runGitCommand(resolved.absoluteRoot, ['log', '-1', '--pretty=%h %s']).stdout ||
    'Sem commits detectados';
  const scripts = packageJson?.scripts ?? {};

  return {
    projectName: packageJson?.name || path.basename(resolved.absoluteRoot),
    projectPath: resolved.absoluteRoot,
    framework: packageJson ? detectFramework(packageJson) : 'Nao detectado',
    branch,
    changedFiles: gitStatusLines.length,
    gitStatusSummary: gitStatusLines.length ? gitStatusLines.slice(0, 12) : ['Working tree limpa'],
    lastCommit,
    detectedCommands: {
      dev: scripts.dev || null,
      build: scripts.build || null,
      test: scripts.test || null,
      typecheck: scripts.typecheck || null,
    },
  };
}

export async function scanProject(projectRootInput = '.') {
  const snapshot = readProjectSnapshot(projectRootInput);
  const tree = await listProjectTree(projectRootInput);
  return {
    ...snapshot,
    tree,
  };
}

export function getGitStatus(projectRootInput = '.') {
  const snapshot = readProjectSnapshot(projectRootInput);
  return {
    branch: snapshot.branch,
    changedFiles: snapshot.changedFiles,
    statusLines: snapshot.gitStatusSummary,
    lastCommit: snapshot.lastCommit,
  };
}

export function getGitDiff(projectRootInput = '.') {
  const resolved = resolveProjectRoot(projectRootInput);
  const diff = runGitCommand(resolved.absoluteRoot, ['diff', '--no-ext-diff']);
  return {
    ok: diff.ok,
    diff: diff.stdout,
    error: diff.ok ? null : diff.stderr,
  };
}

export function getGitFileDiff(projectRootInput = '.', filePath: string) {
  const resolved = resolveProjectRoot(projectRootInput);
  const target = normalizeGitPath(filePath);
  const diff = runGitCommand(resolved.absoluteRoot, ['diff', '--no-ext-diff', '--', target]);
  return {
    ok: diff.ok,
    path: target,
    diff: diff.stdout,
    error: diff.ok ? null : diff.stderr,
  };
}

export function stageGitFiles(projectRootInput = '.', files: string[]) {
  const resolved = resolveProjectRoot(projectRootInput);
  const targets = files.map(normalizeGitPath);
  if (!targets.length) {
    throw new Error('files e obrigatorio');
  }
  const result = runGitCommand(resolved.absoluteRoot, ['add', '--', ...targets]);
  assertGitOk(result, 'Falha ao fazer stage');
  return { files: targets, output: result.stdout };
}

export function unstageGitFiles(projectRootInput = '.', files: string[]) {
  const resolved = resolveProjectRoot(projectRootInput);
  const targets = files.map(normalizeGitPath);
  if (!targets.length) {
    throw new Error('files e obrigatorio');
  }
  const result = runGitCommand(resolved.absoluteRoot, ['restore', '--staged', '--', ...targets]);
  assertGitOk(result, 'Falha ao remover stage');
  return { files: targets, output: result.stdout };
}

export function createGitBranch(projectRootInput = '.', branch: string) {
  const resolved = resolveProjectRoot(projectRootInput);
  const normalized = String(branch || '').trim();
  if (!/^[a-zA-Z0-9._/-]{1,80}$/.test(normalized) || normalized.includes('..')) {
    throw new Error('Nome de branch invalido');
  }
  const result = runGitCommand(resolved.absoluteRoot, ['checkout', '-b', normalized]);
  assertGitOk(result, 'Falha ao criar branch');
  return { branch: normalized, output: result.stdout };
}

export function generateCommitMessage(projectRootInput = '.') {
  const status = getGitStatus(projectRootInput);
  if (!status.changedFiles) {
    return 'chore: no changes to commit';
  }

  const first = status.statusLines[0] || '';
  const target = first.replace(/^[A-Z? ]+/, '').trim() || 'project';
  const prefix = status.changedFiles > 3 ? 'feat' : 'chore';
  return `${prefix}: update ${target}${status.changedFiles > 1 ? ' and related files' : ''}`;
}

export function createGitCommit(projectRootInput = '.', message: string) {
  const resolved = resolveProjectRoot(projectRootInput);
  if (!message.trim()) {
    throw new Error('message e obrigatoria');
  }

  const status = getGitStatus(projectRootInput);
  if (!status.changedFiles) {
    throw new Error('Nao ha alteracoes para commit');
  }

  const addResult = runGitCommand(resolved.absoluteRoot, ['add', '-A']);
  if (!addResult.ok) {
    throw new Error(addResult.stderr || 'Falha ao preparar commit');
  }

  const commitResult = runGitCommand(resolved.absoluteRoot, ['commit', '-m', message.trim()]);
  if (!commitResult.ok) {
    throw new Error(commitResult.stderr || 'Falha ao criar commit');
  }

  return {
    message: message.trim(),
    output: commitResult.stdout,
  };
}
