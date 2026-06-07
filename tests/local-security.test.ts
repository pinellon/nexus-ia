import { rm } from 'node:fs/promises';
import path from 'node:path';

import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { authHeaders, configureTestSecurity } from './helpers.js';

const dataDir = path.resolve(process.cwd(), '.tmp-tests/local-security-data');
const workspaceArtifact = path.resolve(process.cwd(), 'workspace/__security__');

describe('local security', () => {
  beforeEach(async () => {
    process.env.NEXUS_DATA_DIR = dataDir;
    process.env.NODE_ENV = 'test';
    configureTestSecurity();
    await rm(dataDir, { recursive: true, force: true });
    await rm(workspaceArtifact, { recursive: true, force: true });
    vi.resetModules();
  });

  it('allows trusted local origins and blocks external origins', async () => {
    const { app } = await import('../src/server.js');

    await request(app).get('/api/health').set('Origin', 'http://localhost:4000').expect(200);
    await request(app).get('/api/health').set('Origin', 'https://example.com').expect(403);
  });

  it('rejects sensitive endpoints without token or custom header', async () => {
    const { app } = await import('../src/server.js');

    await request(app).post('/api/project/file').send({ path: 'x.md', content: 'x' }).expect(403);
    await request(app)
      .post('/api/project/file')
      .set('X-Nexus-Request', 'true')
      .send({ path: 'x.md', content: 'x' })
      .expect(401);
    await request(app).get('/api/project/tree').expect(403);
    await request(app).get('/api/workspace/file?path=x.md').expect(403);
  });

  it('accepts sensitive endpoints with local token and csrf header', async () => {
    const { app } = await import('../src/server.js');

    await request(app)
      .post('/api/project/file')
      .set(authHeaders())
      .send({ path: '__security__/ok.md', content: 'ok' })
      .expect(201);
  });

  it('bootstraps the local auth token through a dedicated local endpoint', async () => {
    const { app } = await import('../src/server.js');

    const response = await request(app)
      .get('/api/local-auth/bootstrap')
      .set('X-Nexus-Request', 'bootstrap')
      .expect(200);

    expect(response.body).toMatchObject({
      ok: true,
      localSecurity: {
        token: 'test-local-token',
        csrfHeader: 'X-Nexus-Request',
        tokenHeader: 'X-Nexus-Token',
      },
    });
  });

  it('rejects bootstrap requests without the bootstrap header or from external origins', async () => {
    const { app } = await import('../src/server.js');

    await request(app).get('/api/local-auth/bootstrap').expect(403);
    await request(app)
      .get('/api/local-auth/bootstrap')
      .set('X-Nexus-Request', 'bootstrap')
      .set('Origin', 'https://example.com')
      .expect(403);
  });

  it('does not expose the local token through health', async () => {
    const { app } = await import('../src/server.js');

    const response = await request(app).get('/api/health').expect(200);

    expect(response.body.localSecurity?.token).toBeUndefined();
    expect(response.body.localSecurity).toMatchObject({
      csrfHeader: 'X-Nexus-Request',
      tokenHeader: 'X-Nexus-Token',
      bootstrap: '/api/local-auth/bootstrap',
    });
  });

  it('sets a CSP that blocks inline scripts on app responses', async () => {
    const { app } = await import('../src/server.js');

    const response = await request(app).get('/').expect(200);
    const csp = response.headers['content-security-policy'];

    expect(csp).toContain("default-src 'none'");
    expect(csp).toContain("script-src 'self'");
    expect(csp).not.toContain("script-src 'self' 'unsafe-inline'");
    expect(csp).toContain("frame-ancestors 'none'");
  });

  it('rejects bootstrap requests when Referer contains /preview/', async () => {
    const { app } = await import('../src/server.js');

    await request(app)
      .get('/api/local-auth/bootstrap')
      .set('X-Nexus-Request', 'bootstrap')
      .set('Referer', 'http://localhost:4000/preview/project/index.html')
      .expect(403);
  });

  it('rejects sensitive requests when Referer contains /preview/', async () => {
    const { app } = await import('../src/server.js');

    await request(app)
      .get('/api/project/tree')
      .set('X-Nexus-Request', 'true')
      .set('X-Nexus-Token', 'test-local-token')
      .set('Origin', 'http://localhost:4000')
      .set('Referer', 'http://localhost:4000/preview/project/index.html')
      .expect(403);
  });
});
