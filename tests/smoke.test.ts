import { mkdir, rm } from 'node:fs/promises';
import path from 'node:path';

import request from 'supertest';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { authHeaders, configureTestSecurity } from './helpers.js';

const dataDir = path.resolve(process.cwd(), '.tmp-tests/smoke-data');

describe('API Smoke Tests', () => {
  beforeAll(async () => {
    process.env.NEXUS_DATA_DIR = dataDir;
    process.env.NODE_ENV = 'test';
    configureTestSecurity();
    await rm(dataDir, { recursive: true, force: true });
    configureTestSecurity();
    vi.resetModules();
  });

  beforeEach(async () => {
    await rm(dataDir, { recursive: true, force: true });
    vi.resetModules();
  });

  it('GET /api/health returns ok', async () => {
    const { app } = await import('../src/server.js');
    const response = await request(app).get('/api/health').expect(200);
    expect(response.body.ok).toBe(true);
  });

  it('GET /api/project/files returns file list', async () => {
    const { app } = await import('../src/server.js');
    const response = await request(app).get('/api/project/files').set(authHeaders()).expect(200);
    expect(response.body).toHaveProperty('ok', true);
    expect(response.body).toHaveProperty('files');
  });

  it('GET /api/sessions returns active sessions', async () => {
    const { app } = await import('../src/server.js');
    const response = await request(app).get('/api/sessions').set(authHeaders()).expect(200);
    expect(response.body).toHaveProperty('sessions');
  });

  it('POST /api/sessions creates a new session', async () => {
    const { app } = await import('../src/server.js');
    const response = await request(app)
      .post('/api/sessions')
      .set(authHeaders())
      .send({ prompt: 'Test smoke session' })
      .expect(201);
    expect(response.body.session).toHaveProperty('id');
  });

  it('GET /api/patches returns list of patches', async () => {
    const { app } = await import('../src/server.js');
    const response = await request(app).get('/api/patches').set(authHeaders()).expect(200);
    expect(response.body).toHaveProperty('ok', true);
    expect(response.body).toHaveProperty('data');
  });

  it('GET and POST /api/ai/settings loads and saves settings', async () => {
    const { app } = await import('../src/server.js');

    // Test GET settings
    const getRes = await request(app).get('/api/ai/settings').set(authHeaders()).expect(200);
    expect(getRes.body).toHaveProperty('ok', true);
    expect(getRes.body).toHaveProperty('mode');

    // Test POST settings
    const postRes = await request(app)
      .post('/api/ai/settings')
      .set(authHeaders())
      .send({
        mode: 'economy',
        provider: 'ollama',
        allowPremiumFallback: false,
      })
      .expect(200);
    expect(postRes.body).toHaveProperty('ok', true);
    expect(postRes.body).toHaveProperty('mode', 'economy');
    expect(postRes.body).toHaveProperty('provider', 'ollama');
  });
});
