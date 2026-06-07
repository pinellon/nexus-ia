import { readFile, rm } from 'node:fs/promises';
import path from 'node:path';

import { beforeEach, describe, expect, it, vi } from 'vitest';

const dataDir = path.resolve(process.cwd(), '.tmp-tests/nexus-data-dir-data');

describe('NEXUS_DATA_DIR', () => {
  beforeEach(async () => {
    process.env.NEXUS_DATA_DIR = dataDir;
    await rm(dataDir, { recursive: true, force: true });
    vi.resetModules();
  });

  it('staged-files writes inside NEXUS_DATA_DIR', async () => {
    const { addStagedFile, listStagedFiles } = await import('../src/app/web/staged-files.js');

    await addStagedFile({
      projectRoot: 'workspace',
      path: 'src/App.tsx',
      language: 'typescript',
      content: 'export default function App() { return null; }',
      source: 'test',
    });

    const files = await listStagedFiles();
    expect(files).toHaveLength(1);
    const raw = await readFile(path.join(dataDir, 'staged-files.json'), 'utf8');
    expect(raw).toContain('src/App.tsx');
  });
});
