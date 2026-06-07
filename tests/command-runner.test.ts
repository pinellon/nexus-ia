import { describe, expect, it } from 'vitest';

import {
  installPackages,
  listAllowedCommands,
  resolveAllowedCommand,
  runCommand,
} from '../src/command-runner.js';

describe('command-runner', () => {
  it('resolves allowed command aliases and labels', () => {
    expect(resolveAllowedCommand('npm run build')?.id).toBe('build');
    expect(resolveAllowedCommand('build')?.id).toBe('build');
    expect(resolveAllowedCommand('git status')?.id).toBe('git-status');
    expect(resolveAllowedCommand('git diff')?.id).toBe('git-diff');
  });

  it('rejects dangerous shell commands', () => {
    expect(resolveAllowedCommand('rm -rf .')).toBeNull();
    expect(resolveAllowedCommand('powershell Remove-Item -Recurse .')).toBeNull();
  });

  it('rejects invalid package names before spawning npm', async () => {
    await expect(installPackages(process.cwd(), 'npm', ['bad;package'], false)).rejects.toThrow(
      'Lista de pacotes invalida',
    );
  });

  it('blocks shell metacharacter ; in package name', async () => {
    // This package name might pass a naive regex but should be blocked by metachar check
    await expect(
      installPackages(process.cwd(), 'npm', ['lodash;rm -rf .'], false),
    ).rejects.toThrow();
  });

  it('blocks shell metacharacter | in package name', async () => {
    await expect(installPackages(process.cwd(), 'npm', ['pkg|evil'], false)).rejects.toThrow();
  });

  it('blocks shell metacharacter & in package name', async () => {
    await expect(installPackages(process.cwd(), 'npm', ['pkg&evil'], false)).rejects.toThrow();
  });

  it('blocks shell metacharacter > in package name', async () => {
    await expect(installPackages(process.cwd(), 'npm', ['pkg>evil'], false)).rejects.toThrow();
  });

  it('blocks shell metacharacter < in package name', async () => {
    await expect(installPackages(process.cwd(), 'npm', ['pkg<evil'], false)).rejects.toThrow();
  });

  it('blocks shell metacharacter $ in package name', async () => {
    await expect(installPackages(process.cwd(), 'npm', ['pkg$evil'], false)).rejects.toThrow();
  });

  it('blocks newline character in package name', async () => {
    await expect(
      installPackages(process.cwd(), 'npm', ['lodash\nrm -rf .'], false),
    ).rejects.toThrow();
  });

  it('does not reject legitimate scoped package names as metacharacters', async () => {
    // Verify that @scope/name format does NOT trigger the metacharacter validation.
    // We call installPackages and confirm it doesn't throw with 'caracteres nao permitidos'.
    // (npm install itself may succeed or fail depending on the environment — that's OK.)
    let caughtError: Error | null = null;
    try {
      await installPackages(process.cwd(), 'npm', ['@types/node'], false);
    } catch (err) {
      caughtError = err instanceof Error ? err : new Error(String(err));
    }

    if (caughtError) {
      // If it did throw, it must NOT be the metacharacter validation error
      expect(caughtError.message).not.toContain('caracteres nao permitidos');
    }
    // If it resolved (npm installed successfully), that's fine too
  });

  it('does not list dangerous commands', () => {
    const allowed = listAllowedCommands();
    expect(allowed).not.toContain('rm');
    expect(allowed).not.toContain('powershell');
    expect(allowed).not.toContain('cmd');
  });

  it('rejects command cwd outside the repository without consuming runId', async () => {
    const runId = `outside-cwd-${Date.now()}`;
    await expect(
      runCommand('node-version', 'C:\\', {
        runId,
        timeoutMs: 10_000,
      }),
    ).rejects.toThrow('cwd precisa ficar dentro do repositorio atual');

    const result = await runCommand('node-version', process.cwd(), {
      runId,
      timeoutMs: 10_000,
    });
    expect(result.exitCode).toBe(0);
  });

  it('emits output events for successful commands', async () => {
    const events: string[] = [];
    const result = await runCommand('node-version', process.cwd(), {
      timeoutMs: 10_000,
      onEvent: (event) => events.push(event.type),
    });

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain('v');
    expect(events).toContain('stdout');
    expect(events).toContain('exit');
  });

  it('rejects duplicate command execution ids', async () => {
    const runId = `test-command-${Date.now()}`;
    const result = await runCommand('node-version', process.cwd(), {
      runId,
      timeoutMs: 10_000,
    });

    expect(result.exitCode).toBe(0);
    await expect(
      runCommand('node-version', process.cwd(), {
        runId,
        timeoutMs: 10_000,
      }),
    ).rejects.toThrow('Execucao de comando ja foi concluida');
  });

  it('supports custom timeout and preserves partial output metadata', async () => {
    const events: string[] = [];
    const result = await runCommand('test', process.cwd(), {
      timeoutMs: 1,
      onEvent: (event) => events.push(event.type),
    });

    expect(result.exitCode).toBe(124);
    expect(result.timedOut).toBe(true);
    expect(events).toContain('timeout');
    expect(typeof result.stdout).toBe('string');
    expect(typeof result.stderr).toBe('string');
  });
});
