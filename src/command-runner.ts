import { spawn } from 'node:child_process';
import path from 'node:path';

import { getRepositoryRoot } from './project-file-store.js';

const MAX_LOG_SIZE = 20_000;
const DEFAULT_COMMAND_TIMEOUT_MS = Number(process.env.NEXUS_COMMAND_TIMEOUT_MS || 30_000);
const COMMAND_TIMEOUTS_MS: Partial<Record<AllowedCommandId | 'install_package', number>> = {
  build: Number(process.env.NEXUS_BUILD_TIMEOUT_MS || 120_000),
  test: Number(process.env.NEXUS_TEST_TIMEOUT_MS || 120_000),
  typecheck: Number(process.env.NEXUS_TYPECHECK_TIMEOUT_MS || 90_000),
  install: Number(process.env.NEXUS_INSTALL_TIMEOUT_MS || 180_000),
  'install-dev': Number(process.env.NEXUS_INSTALL_TIMEOUT_MS || 180_000),
  install_package: Number(process.env.NEXUS_INSTALL_TIMEOUT_MS || 180_000),
  lint: Number(process.env.NEXUS_LINT_TIMEOUT_MS || 60_000),
  'format-check': Number(process.env.NEXUS_FORMAT_TIMEOUT_MS || 30_000),
};
const SAFE_PACKAGE_NAME = /^(?:@[a-z0-9-~][a-z0-9-._~]*\/)?[a-z0-9-~][a-z0-9-._~]*$/i;

const COMMANDS = {
  build: { label: 'npm run build', command: 'npm', args: ['run', 'build'] },
  typecheck: { label: 'npm run typecheck', command: 'npm', args: ['run', 'typecheck'] },
  test: { label: 'npm test', command: 'npm', args: ['test'] },
  lint: { label: 'npm run lint', command: 'npm', args: ['run', 'lint'] },
  'format-check': { label: 'npm run format:check', command: 'npm', args: ['run', 'format:check'] },
  install: { label: 'npm install', command: 'npm', args: ['install'] },
  'install-dev': {
    label: 'npm install --save-dev',
    command: 'npm',
    args: ['install', '--save-dev'],
  },
  'node-version': { label: 'node --version', command: 'node', args: ['--version'] },
  'npm-version': { label: 'npm --version', command: 'npm', args: ['--version'] },
  'git-status': { label: 'git status', command: 'git', args: ['status', '--short', '--branch'] },
  'git-diff': { label: 'git diff', command: 'git', args: ['diff', '--no-ext-diff'] },
  'git-log': { label: 'git log --oneline -10', command: 'git', args: ['log', '--oneline', '-10'] },
} as const;

export type AllowedCommandId = keyof typeof COMMANDS;

export interface CommandRunResult {
  id: AllowedCommandId | 'install_package';
  stdout: string;
  stderr: string;
  exitCode: number;
  durationMs: number;
  command: string;
  timedOut?: boolean;
}

export type CommandRunEvent =
  | { type: 'stdout'; chunk: string; createdAt: string }
  | { type: 'stderr'; chunk: string; createdAt: string }
  | { type: 'exit'; exitCode: number; createdAt: string }
  | { type: 'timeout'; timeoutMs: number; createdAt: string }
  | { type: 'error'; message: string; createdAt: string };

export interface CommandRunOptions {
  timeoutMs?: number;
  runId?: string;
  onEvent?: (event: CommandRunEvent) => void;
}

export interface ResolvedAllowedCommand {
  id: AllowedCommandId;
  label: string;
}

const inFlightCommandRunIds = new Set<string>();
const completedCommandRunIds = new Set<string>();

function beginCommandRun(runId?: string) {
  if (!runId) {
    return () => {};
  }

  if (completedCommandRunIds.has(runId)) {
    throw new Error(`Execucao de comando ja foi concluida: ${runId}`);
  }

  if (inFlightCommandRunIds.has(runId)) {
    throw new Error(`Execucao de comando ja esta em andamento: ${runId}`);
  }

  inFlightCommandRunIds.add(runId);
  let finished = false;
  return () => {
    if (finished) {
      return;
    }
    finished = true;
    inFlightCommandRunIds.delete(runId);
    completedCommandRunIds.add(runId);
  };
}

function truncateLog(value: string) {
  if (value.length <= MAX_LOG_SIZE) {
    return value;
  }

  return `${value.slice(0, MAX_LOG_SIZE)}\n...[truncado pelo Nexus]`;
}

function createCommandString(command: string, args: string[]) {
  return [command, ...args].join(' ');
}

function nowIso() {
  return new Date().toISOString();
}

function timeoutForCommand(id: CommandRunResult['id'], override?: number) {
  if (typeof override === 'number' && Number.isFinite(override) && override > 0) {
    return Math.min(override, 15 * 60_000);
  }
  return COMMAND_TIMEOUTS_MS[id] ?? DEFAULT_COMMAND_TIMEOUT_MS;
}

function assertCommandCwdInsideRepository(cwd: string) {
  const repositoryRoot = getRepositoryRoot();
  const absoluteCwd = path.resolve(cwd);
  const relative = path.relative(repositoryRoot, absoluteCwd);
  if (relative.startsWith('..') || path.isAbsolute(relative)) {
    throw new Error('cwd precisa ficar dentro do repositorio atual');
  }
  return absoluteCwd;
}

function killProcessTree(childPid?: number) {
  if (!childPid) {
    return;
  }
  if (process.platform === 'win32') {
    const killer = spawn('taskkill', ['/pid', String(childPid), '/t', '/f'], {
      windowsHide: true,
      shell: false,
    });
    killer.on('error', () => {});
    return;
  }
  try {
    process.kill(-childPid, 'SIGTERM');
  } catch {
    try {
      process.kill(childPid, 'SIGTERM');
    } catch {
      // Process already exited.
    }
  }
}

function executeProcess(
  command: string,
  args: string[],
  cwd: string,
  id: CommandRunResult['id'],
  options: CommandRunOptions = {},
) {
  const startedAt = Date.now();
  const safeCwd = assertCommandCwdInsideRepository(cwd);
  const finishRun = beginCommandRun(options.runId);
  const timeoutMs = timeoutForCommand(id, options.timeoutMs);
  const isWindowsNpm = process.platform === 'win32' && command === 'npm';
  const executable = isWindowsNpm ? 'cmd.exe' : command;
  const finalArgs = isWindowsNpm ? ['/d', '/s', '/c', 'npm', ...args] : args;
  const env =
    command === 'git'
      ? {
          ...process.env,
          GIT_CEILING_DIRECTORIES: getRepositoryRoot(),
        }
      : process.env;

  return new Promise<CommandRunResult>((resolve, reject) => {
    const child = spawn(executable, finalArgs, {
      cwd: safeCwd,
      env,
      detached: process.platform !== 'win32',
      shell: false,
      windowsHide: true,
    });

    let stdout = '';
    let stderr = '';
    let timedOut = false;
    const timeout = setTimeout(() => {
      timedOut = true;
      options.onEvent?.({ type: 'timeout', timeoutMs, createdAt: nowIso() });
      killProcessTree(child.pid);
    }, timeoutMs);

    child.stdout.on('data', (chunk) => {
      const text = chunk.toString();
      stdout += text;
      options.onEvent?.({ type: 'stdout', chunk: text, createdAt: nowIso() });
    });

    child.stderr.on('data', (chunk) => {
      const text = chunk.toString();
      stderr += text;
      options.onEvent?.({ type: 'stderr', chunk: text, createdAt: nowIso() });
    });

    child.on('error', (error) => {
      clearTimeout(timeout);
      finishRun();
      options.onEvent?.({ type: 'error', message: error.message, createdAt: nowIso() });
      reject(error);
    });

    child.on('close', (code) => {
      clearTimeout(timeout);
      finishRun();
      const suffix = timedOut ? `${stderr}\nProcesso interrompido por timeout.`.trim() : stderr;

      const exitCode = timedOut ? 124 : (code ?? 1);
      options.onEvent?.({ type: 'exit', exitCode, createdAt: nowIso() });

      resolve({
        id,
        command: createCommandString(command, args),
        stdout: truncateLog(stdout),
        stderr: truncateLog(suffix),
        exitCode,
        durationMs: Date.now() - startedAt,
        timedOut,
      });
    });
  });
}

export function listAllowedCommands(): AllowedCommandId[] {
  return Object.keys(COMMANDS) as AllowedCommandId[];
}

export function resolveAllowedCommand(value: unknown): ResolvedAllowedCommand | null {
  if (typeof value !== 'string') {
    return null;
  }

  const normalized = value.trim();
  for (const [id, config] of Object.entries(COMMANDS) as Array<
    [AllowedCommandId, (typeof COMMANDS)[AllowedCommandId]]
  >) {
    if (normalized === id || normalized === config.label) {
      return {
        id,
        label: config.label,
      };
    }
  }

  return null;
}

export async function runCommand(
  id: AllowedCommandId,
  cwd: string,
  options: CommandRunOptions = {},
): Promise<CommandRunResult> {
  const selected = COMMANDS[id];
  if (!selected) {
    throw new Error('Comando nao permitido');
  }

  return executeProcess(selected.command, Array.from(selected.args), cwd, id, options);
}

export async function installPackages(
  cwd: string,
  packageManager: 'npm',
  packages: string[],
  dev: boolean,
  options: CommandRunOptions = {},
): Promise<CommandRunResult> {
  if (packageManager !== 'npm') {
    throw new Error('Gerenciador de pacotes nao suportado');
  }

  if (!packages.length || packages.some((item) => !SAFE_PACKAGE_NAME.test(item))) {
    throw new Error('Lista de pacotes invalida');
  }

  // Extra defense: block shell metacharacters even if the regex matched
  const SHELL_METACHAR = /[;|&><`$\n\r]/;
  if (packages.some((item) => SHELL_METACHAR.test(item))) {
    throw new Error('Nome de pacote contem caracteres nao permitidos');
  }

  const args = ['install', ...(dev ? ['--save-dev'] : []), ...packages];
  return executeProcess('npm', args, cwd, 'install_package', options);
}
