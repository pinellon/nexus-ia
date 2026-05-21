import { spawn } from "node:child_process";

const MAX_LOG_SIZE = 20_000;
const COMMAND_TIMEOUT_MS = 30_000;
const SAFE_PACKAGE_NAME = /^(?:@[a-z0-9-~][a-z0-9-._~]*\/)?[a-z0-9-~][a-z0-9-._~]*$/i;

const COMMANDS = {
  build: { label: "npm run build", command: "npm", args: ["run", "build"] },
  typecheck: { label: "npm run typecheck", command: "npm", args: ["run", "typecheck"] },
  test: { label: "npm test", command: "npm", args: ["test"] },
  install: { label: "npm install", command: "npm", args: ["install"] },
  "install-dev": { label: "npm install --save-dev", command: "npm", args: ["install", "--save-dev"] },
  "node-version": { label: "node --version", command: "node", args: ["--version"] },
  "npm-version": { label: "npm --version", command: "npm", args: ["--version"] },
  "git-status": { label: "git status", command: "git", args: ["status", "--short", "--branch"] },
  "git-diff": { label: "git diff", command: "git", args: ["diff", "--no-ext-diff"] }
} as const;

export type AllowedCommandId = keyof typeof COMMANDS;

export interface CommandRunResult {
  id: AllowedCommandId | "install_package";
  stdout: string;
  stderr: string;
  exitCode: number;
  durationMs: number;
  command: string;
}

export interface ResolvedAllowedCommand {
  id: AllowedCommandId;
  label: string;
}

function truncateLog(value: string) {
  if (value.length <= MAX_LOG_SIZE) {
    return value;
  }

  return `${value.slice(0, MAX_LOG_SIZE)}\n...[truncado pelo Nexus]`;
}

function createCommandString(command: string, args: string[]) {
  return [command, ...args].join(" ");
}

function executeProcess(command: string, args: string[], cwd: string, id: CommandRunResult["id"]) {
  const startedAt = Date.now();
  const isWindowsNpm = process.platform === "win32" && command === "npm";
  const executable = isWindowsNpm ? "cmd.exe" : command;
  const finalArgs = isWindowsNpm ? ["/d", "/s", "/c", "npm", ...args] : args;

  return new Promise<CommandRunResult>((resolve, reject) => {
    const child = spawn(executable, finalArgs, {
      cwd,
      shell: false,
      windowsHide: true
    });

    let stdout = "";
    let stderr = "";
    let timedOut = false;
    const timeout = setTimeout(() => {
      timedOut = true;
      child.kill();
    }, COMMAND_TIMEOUT_MS);

    child.stdout.on("data", (chunk) => {
      stdout += chunk.toString();
    });

    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
    });

    child.on("error", (error) => {
      clearTimeout(timeout);
      reject(error);
    });

    child.on("close", (code) => {
      clearTimeout(timeout);
      const suffix = timedOut ? `${stderr}\nProcesso interrompido por timeout.`.trim() : stderr;

      resolve({
        id,
        command: createCommandString(command, args),
        stdout: truncateLog(stdout),
        stderr: truncateLog(suffix),
        exitCode: timedOut ? 124 : code ?? 1,
        durationMs: Date.now() - startedAt
      });
    });
  });
}

export function listAllowedCommands(): AllowedCommandId[] {
  return Object.keys(COMMANDS) as AllowedCommandId[];
}

export function resolveAllowedCommand(value: unknown): ResolvedAllowedCommand | null {
  if (typeof value !== "string") {
    return null;
  }

  const normalized = value.trim();
  for (const [id, config] of Object.entries(COMMANDS) as Array<[AllowedCommandId, (typeof COMMANDS)[AllowedCommandId]]>) {
    if (normalized === id || normalized === config.label) {
      return {
        id,
        label: config.label
      };
    }
  }

  return null;
}

export async function runCommand(id: AllowedCommandId, cwd: string): Promise<CommandRunResult> {
  const selected = COMMANDS[id];
  if (!selected) {
    throw new Error("Comando nao permitido");
  }

  return executeProcess(selected.command, Array.from(selected.args), cwd, id);
}

export async function installPackages(
  cwd: string,
  packageManager: "npm",
  packages: string[],
  dev: boolean
): Promise<CommandRunResult> {
  if (packageManager !== "npm") {
    throw new Error("Gerenciador de pacotes nao suportado");
  }

  if (!packages.length || packages.some((item) => !SAFE_PACKAGE_NAME.test(item))) {
    throw new Error("Lista de pacotes invalida");
  }

  const args = ["install", ...(dev ? ["--save-dev"] : []), ...packages];
  return executeProcess("npm", args, cwd, "install_package");
}
