import { readFile, rm } from 'node:fs/promises';
import path from 'node:path';

import { beforeEach, describe, expect, it, vi } from 'vitest';

const dataDir = path.resolve(process.cwd(), '.tmp-tests/pending-actions-concurrency-data');

describe('pending-actions concurrency', () => {
  beforeEach(async () => {
    process.env.NEXUS_DATA_DIR = dataDir;
    await rm(dataDir, { recursive: true, force: true });
    vi.resetModules();
  });

  it('does not lose actions during parallel writes and keeps valid JSON', async () => {
    const { createPendingAction, listPendingActions } =
      await import('../src/pending-actions-store.js');

    await Promise.all(
      Array.from({ length: 25 }, (_, index) =>
        createPendingAction('parallel-session', {
          type: 'create_file',
          sessionId: 'parallel-session',
          projectRoot: 'workspace',
          path: `docs/action-${index}.md`,
          content: `# ${index}`,
          reason: 'parallel write',
          riskLevel: 'low',
          requiresConfirmation: true,
        }),
      ),
    );

    const actions = await listPendingActions('parallel-session');
    expect(actions).toHaveLength(25);

    const raw = await readFile(path.join(dataDir, 'pending-actions.json'), 'utf8');
    const parsed = JSON.parse(raw) as { actions: unknown[] };
    expect(parsed.actions).toHaveLength(25);
  });
});
