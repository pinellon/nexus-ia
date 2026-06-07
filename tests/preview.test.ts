import { mkdir, rm } from 'node:fs/promises';
import path from 'node:path';

import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { configureTestSecurity } from './helpers.js';

const dataDir = path.resolve(process.cwd(), '.tmp-tests/preview-data');
const workspaceRoot = path.resolve(process.cwd(), 'workspace/__preview__');

describe('project preview', () => {
  beforeEach(async () => {
    process.env.NEXUS_DATA_DIR = dataDir;
    process.env.NODE_ENV = 'test';
    configureTestSecurity();
    await rm(dataDir, { recursive: true, force: true });
    await rm(workspaceRoot, { recursive: true, force: true });
    await mkdir(workspaceRoot, { recursive: true });
    vi.resetModules();
  });

  it('serves active project html and relative assets through the preview route', async () => {
    const { writeProjectFile } = await import('../src/project-file-store.js');
    await writeProjectFile(
      'workspace',
      '__preview__/index.html',
      '<link rel="stylesheet" href="./style.css"><h1>Nexus Preview</h1>',
    );
    await writeProjectFile('workspace', '__preview__/style.css', 'h1 { color: red; }');
    const { app } = await import('../src/server.js');

    const html = await request(app).get('/preview/project/__preview__/index.html').expect(200);
    expect(html.headers['content-type']).toContain('text/html');
    expect(html.headers['content-security-policy']).toContain('sandbox');
    expect(html.headers['content-security-policy']).toContain("connect-src 'none'");
    expect(html.headers['content-security-policy']).not.toContain('allow-same-origin');
    expect(html.text).toContain('Nexus Preview');

    const css = await request(app).get('/preview/project/__preview__/style.css').expect(200);
    expect(css.headers['content-type']).toContain('text/css');
    expect(css.headers['content-security-policy']).toContain("connect-src 'none'");
    expect(css.text).toContain('color: red');
  });

  it('serves staged previews with a CSP that blocks API access', async () => {
    const { app } = await import('../src/server.js');
    const { addStagedFile } = await import('../src/app/web/staged-files.js');
    await addStagedFile({
      projectRoot: 'workspace',
      path: 'index.html',
      language: 'html',
      content: "<script>fetch('/api/health')</script><h1>Staged</h1>",
      source: 'test',
      run_id: 'run-preview-security',
    });

    const response = await request(app)
      .get('/preview/staged/run-preview-security/index.html')
      .expect(200);

    expect(response.headers['content-type']).toContain('text/html');
    expect(response.headers['content-security-policy']).toContain('sandbox');
    expect(response.headers['content-security-policy']).toContain("connect-src 'none'");
    expect(response.headers['content-security-policy']).not.toContain('allow-same-origin');
    expect(response.text).toContain('Staged');
    expect(response.text).not.toContain('test-local-token');
  });

  it('blocks preview paths outside the active project', async () => {
    const { app } = await import('../src/server.js');

    await request(app).get('/preview/project/..%2Fserver.ts').expect(404);
  });
});
