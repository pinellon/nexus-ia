import { mkdir, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';

import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

const dataDir = path.resolve(process.cwd(), '.tmp-tests/patches-flow-data');
const projectRoot = '.tmp-tests/patches-flow-project';
const absoluteProjectRoot = path.resolve(process.cwd(), projectRoot);

describe('patches flow', () => {
  beforeAll(async () => {
    process.env.NEXUS_DATA_DIR = dataDir;
    await rm(dataDir, { recursive: true, force: true });
    vi.resetModules();
  });

  beforeEach(async () => {
    await rm(absoluteProjectRoot, { recursive: true, force: true });
    await mkdir(path.join(absoluteProjectRoot, 'src'), { recursive: true });
    await rm(dataDir, { recursive: true, force: true });
    vi.resetModules();
  });

  it('rejects applying a stale patch_file after the file changed', async () => {
    const { createPendingAction, approveAction } = await import('../src/pending-actions-store.js');
    const { applyAction } = await import('../src/action-executor.js');
    const { buildPatchPayload } = await import('../src/patch-payload.js');

    await writeFile(path.join(absoluteProjectRoot, 'src/file.ts'), 'changed-on-disk', 'utf8');
    const action = await createPendingAction('session-1', {
      type: 'patch_file',
      sessionId: 'session-1',
      projectRoot,
      path: 'src/file.ts',
      before: 'before',
      after: 'after',
      reason: 'stale',
      riskLevel: 'medium',
      requiresConfirmation: true,
    });
    await approveAction(action.id);

    const payload = await buildPatchPayload(action);
    expect(payload.before).toBe('before');
    expect(payload.after).toBe('after');

    await expect(applyAction(action.id)).rejects.toThrow('mudou desde a proposta');
  });

  it('marks patch as applied and blocks re-apply after success', async () => {
    const { createPendingAction, approveAction, getPendingAction } =
      await import('../src/pending-actions-store.js');
    const { applyAction } = await import('../src/action-executor.js');
    const { readProjectFile } = await import('../src/project-file-store.js');

    const action = await createPendingAction('session-1', {
      type: 'create_file',
      sessionId: 'session-1',
      projectRoot,
      path: 'src/applied.ts',
      content: 'applied-content',
      reason: 'create',
      riskLevel: 'low',
      requiresConfirmation: true,
    });
    await approveAction(action.id);

    await expect(applyAction(action.id)).resolves.toMatchObject({
      action: { status: 'applied' },
    });
    await expect(readProjectFile(projectRoot, 'src/applied.ts')).resolves.toMatchObject({
      content: 'applied-content',
    });

    const stored = await getPendingAction(action.id);
    expect(stored?.status).toBe('applied');
    await expect(applyAction(action.id)).rejects.toThrow('aprovada');
  });

  it('does not apply a rejected patch', async () => {
    const { createPendingAction, rejectAction } = await import('../src/pending-actions-store.js');
    const { applyAction } = await import('../src/action-executor.js');

    const action = await createPendingAction('session-1', {
      type: 'create_file',
      sessionId: 'session-1',
      projectRoot,
      path: 'src/rejected.ts',
      content: 'x',
      reason: 'reject',
      riskLevel: 'low',
      requiresConfirmation: true,
    });
    await rejectAction(action.id);

    await expect(applyAction(action.id)).rejects.toThrow('aprovada');
  });
});
