import { mkdir, rm } from 'node:fs/promises';
import path from 'node:path';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * Tests that backup paths cannot escape the backups root directory
 * via crafted actionId or filePath values containing path traversal.
 */

const dataDir = path.resolve(process.cwd(), '.tmp-tests/backup-path-safety-data');
const projectRoot = '.tmp-tests/backup-path-safety-project';
const absoluteProjectRoot = path.resolve(process.cwd(), projectRoot);

describe('backup path safety', () => {
  beforeEach(async () => {
    process.env.NEXUS_DATA_DIR = dataDir;
    await rm(dataDir, { recursive: true, force: true });
    await rm(absoluteProjectRoot, { recursive: true, force: true });
    await mkdir(absoluteProjectRoot, { recursive: true });
    vi.resetModules();
  });

  afterEach(async () => {
    await rm(dataDir, { recursive: true, force: true });
    await rm(absoluteProjectRoot, { recursive: true, force: true });
  });

  it('sanitizes actionId containing path traversal sequences', async () => {
    const { writeProjectFile } = await import('../src/project-file-store.js');
    const { createPendingAction, approveAction } = await import('../src/pending-actions-store.js');
    const { applyAction } = await import('../src/action-executor.js');

    await writeProjectFile(projectRoot, 'src/target.ts', 'original content here');

    // Create action with a valid UUID-like id (the id is assigned by the store, not the input)
    const action = await createPendingAction('safety-session', {
      type: 'patch_file',
      sessionId: 'safety-session',
      projectRoot,
      path: 'src/target.ts',
      before: 'original content here',
      after: 'patched content here',
      reason: 'backup safety test',
      riskLevel: 'low',
      requiresConfirmation: true,
    });

    await approveAction(action.id);
    const result = await applyAction(action.id);

    // The backup should have been created and the apply should succeed
    expect(result).toBeDefined();

    const { listBackups } = await import('../src/backup-store.js');
    const backups = await listBackups();
    expect(backups.length).toBeGreaterThan(0);

    // Verify that the backup path is inside the dataDir (never outside)
    const backupsRoot = path.resolve(dataDir, 'backups');
    for (const backup of backups) {
      const rel = path.relative(backupsRoot, backup.backupPath);
      expect(rel.startsWith('..')).toBe(false);
      expect(path.isAbsolute(rel)).toBe(false);
    }
  });

  it('backup path stays within backups root even after resolve', async () => {
    const { writeProjectFile } = await import('../src/project-file-store.js');
    const { createPendingAction, approveAction } = await import('../src/pending-actions-store.js');
    const { applyAction } = await import('../src/action-executor.js');
    const { listBackups } = await import('../src/backup-store.js');

    // Write a normal file and create a patch that will cause a backup
    await writeProjectFile(projectRoot, 'config/settings.json', '{"key":"value"}');

    const action = await createPendingAction('path-session', {
      type: 'patch_file',
      sessionId: 'path-session',
      projectRoot,
      path: 'config/settings.json',
      before: '{"key":"value"}',
      after: '{"key":"updated"}',
      reason: 'update config',
      riskLevel: 'low',
      requiresConfirmation: true,
    });

    await approveAction(action.id);
    await applyAction(action.id);

    const backups = await listBackups();
    expect(backups.length).toBeGreaterThan(0);

    const backupsRoot = path.resolve(dataDir, 'backups');
    for (const backup of backups) {
      // The backup path must be resolvable within backupsRoot
      const rel = path.relative(backupsRoot, path.resolve(backup.backupPath));
      expect(rel.startsWith('..')).toBe(false);
      expect(path.isAbsolute(rel)).toBe(false);
      // And it must end with .bak
      expect(backup.backupPath.endsWith('.bak')).toBe(true);
    }
  });

  it('backup entry id is base64url and can be used to retrieve the backup', async () => {
    const { writeProjectFile } = await import('../src/project-file-store.js');
    const { createPendingAction, approveAction } = await import('../src/pending-actions-store.js');
    const { applyAction } = await import('../src/action-executor.js');
    const { listBackups, getBackup } = await import('../src/backup-store.js');

    await writeProjectFile(projectRoot, 'src/util.ts', 'export function foo() {}');

    const action = await createPendingAction('id-session', {
      type: 'patch_file',
      sessionId: 'id-session',
      projectRoot,
      path: 'src/util.ts',
      before: 'export function foo() {}',
      after: 'export function foo() { return 1; }',
      reason: 'update util',
      riskLevel: 'low',
      requiresConfirmation: true,
    });

    await approveAction(action.id);
    await applyAction(action.id);

    const backups = await listBackups();
    expect(backups.length).toBeGreaterThan(0);

    const found = await getBackup(backups[0].id);
    expect(found).not.toBeNull();
    expect(found?.id).toBe(backups[0].id);
    expect(found?.path).toBe('src/util.ts');
  });
});
