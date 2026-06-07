import { mkdir, rm } from 'node:fs/promises';
import path from 'node:path';

import { beforeEach, describe, expect, it, vi } from 'vitest';

const dataDir = path.resolve(process.cwd(), '.tmp-tests/backup-store-data');
const projectRoot = '.tmp-tests/backup-store-project';
const absoluteProjectRoot = path.resolve(process.cwd(), projectRoot);

describe('backup restore', () => {
  beforeEach(async () => {
    process.env.NEXUS_DATA_DIR = dataDir;
    await rm(dataDir, { recursive: true, force: true });
    await rm(absoluteProjectRoot, { recursive: true, force: true });
    await mkdir(absoluteProjectRoot, { recursive: true });
    vi.resetModules();
  });

  it('lists and restores backups created by patch apply', async () => {
    const { writeProjectFile, readProjectFile } = await import('../src/project-file-store.js');
    const { createPendingAction, approveAction } = await import('../src/pending-actions-store.js');
    const { applyAction } = await import('../src/action-executor.js');
    const { listBackups, restoreBackup, previewBackupRestore } =
      await import('../src/backup-store.js');

    await writeProjectFile(projectRoot, 'src/file.ts', 'before');
    const action = await createPendingAction('backup-session', {
      type: 'patch_file',
      sessionId: 'backup-session',
      projectRoot,
      path: 'src/file.ts',
      before: 'before',
      after: 'after',
      reason: 'backup test',
      riskLevel: 'low',
      requiresConfirmation: true,
    });
    await approveAction(action.id);
    await applyAction(action.id);

    expect((await readProjectFile(projectRoot, 'src/file.ts')).content).toBe('after');
    const backups = await listBackups();
    expect(backups[0]).toMatchObject({ actionId: action.id, path: 'src/file.ts' });

    const preview = await previewBackupRestore(projectRoot, backups[0].id);
    expect(preview.diff).toContain('-after');
    expect(preview.diff).toContain('+before');

    await restoreBackup(projectRoot, backups[0].id);
    expect((await readProjectFile(projectRoot, 'src/file.ts')).content).toBe('before');
  });
});
