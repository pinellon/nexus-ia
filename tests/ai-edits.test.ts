import { mkdir, readFile, rm } from 'node:fs/promises';
import path from 'node:path';

import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { authHeaders, configureTestSecurity } from './helpers.js';
import { parseLocalCodexResponse } from '../src/ai/local-codex-agent.js';

const dataDir = path.resolve(process.cwd(), '.tmp-tests/ai-edits-data');
const workspaceRoot = path.resolve(process.cwd(), 'workspace/__ai-edits__');

describe('AI code apply edits', () => {
  beforeEach(async () => {
    process.env.NEXUS_DATA_DIR = dataDir;
    process.env.NODE_ENV = 'test';
    configureTestSecurity();
    await rm(dataDir, { recursive: true, force: true });
    await rm(workspaceRoot, { recursive: true, force: true });
    await mkdir(workspaceRoot, { recursive: true });
    vi.resetModules();
  });

  it('plans an edit, applies it with confirmation, records history, and undoes it', async () => {
    const { writeProjectFile } = await import('../src/project-file-store.js');
    const { app } = await import('../src/server.js');
    await writeProjectFile('workspace', '__ai-edits__/hello.ts', 'export const value = 1;\n');

    const plan = await request(app)
      .post('/api/ai-edits/plan')
      .set(authHeaders())
      .send({
        instruction: 'troque o valor para 2',
        targetFiles: ['__ai-edits__/hello.ts'],
        proposedFiles: [{ path: '__ai-edits__/hello.ts', content: 'export const value = 2;\n' }],
      })
      .expect(201);

    expect(plan.body.data.files[0].diff).toContain('+export const value = 2;');
    expect(plan.body.patch_ids).toHaveLength(1);

    await request(app)
      .post('/api/ai-edits/apply')
      .set(authHeaders())
      .send({ editId: plan.body.editId, confirmed: true })
      .expect(200);

    expect(await readFile(path.join(workspaceRoot, 'hello.ts'), 'utf8')).toBe(
      'export const value = 2;\n',
    );

    const history = await request(app).get('/api/ai-edits/history').set(authHeaders()).expect(200);
    expect(history.body.data[0]).toMatchObject({ id: plan.body.editId, status: 'applied' });

    await request(app)
      .post('/api/ai-edits/undo')
      .set(authHeaders())
      .send({ editId: plan.body.editId, confirmed: true })
      .expect(200);

    expect(await readFile(path.join(workspaceRoot, 'hello.ts'), 'utf8')).toBe(
      'export const value = 1;\n',
    );
  });

  it('blocks dangerous paths before creating a patch', async () => {
    const { app } = await import('../src/server.js');

    const response = await request(app)
      .post('/api/ai-edits/plan')
      .set(authHeaders())
      .send({
        instruction: 'edite fora do projeto',
        targetFiles: ['../server.ts'],
        proposedFiles: [{ path: '../server.ts', content: 'bad' }],
      })
      .expect(400);

    expect(response.body.error).toMatch(/Caminho invalido|Acesso fora|Root de projeto invalido/);
  });

  it('protects edit history with local auth', async () => {
    const { app } = await import('../src/server.js');

    await request(app).get('/api/ai-edits/history').expect(403);
    await request(app).get('/api/ai-edits/history').set(authHeaders()).expect(200);
  });

  it('parses local Ollama JSON even when the model wraps it in a fenced block', () => {
    const parsed = parseLocalCodexResponse(`\`\`\`json
{"summary":"Atualiza valor","files":[{"path":"src/a.ts","content":"export const a = 2;\\n"}]}
\`\`\``);

    expect(parsed.summary).toBe('Atualiza valor');
    expect(parsed.files).toEqual([{ path: 'src/a.ts', content: 'export const a = 2;\n' }]);
  });
});
