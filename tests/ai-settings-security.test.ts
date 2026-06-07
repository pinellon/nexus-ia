import { rm } from 'node:fs/promises';
import path from 'node:path';

import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { authHeaders, configureTestSecurity } from './helpers.js';

const dataDir = path.resolve(process.cwd(), '.tmp-tests/ai-settings-security-data');

describe('AI settings security', () => {
  beforeEach(async () => {
    process.env.NEXUS_DATA_DIR = dataDir;
    process.env.NODE_ENV = 'test';
    delete process.env.NEXUS_ALLOW_PREMIUM_FALLBACK;
    delete process.env.NEXUS_REQUIRE_PREMIUM_CONFIRMATION;
    configureTestSecurity();
    await rm(dataDir, { recursive: true, force: true });
    vi.resetModules();
  });

  it('uses conservative premium defaults', async () => {
    const { loadAISettings } = await import('../src/app/ai/ai-settings.js');
    const settings = await loadAISettings(true);

    expect(settings.allowPremiumFallback).toBe(false);
    expect(settings.requirePremiumConfirmation).toBe(true);
  });

  it('protects settings endpoints and never returns full api keys', async () => {
    const { app } = await import('../src/server.js');

    await request(app).get('/api/ai/settings').expect(403);

    await request(app)
      .post('/api/ai/settings')
      .set(authHeaders())
      .send({
        providers: {
          openai: {
            apiKey: 'sk-test-secret-1234567890',
            model: 'gpt-test',
          },
        },
      })
      .expect(200);

    const response = await request(app).get('/api/ai/settings').set(authHeaders()).expect(200);
    const body = JSON.stringify(response.body);
    expect(body).not.toContain('sk-test-secret-1234567890');
    expect(response.body.providers.openai.configured).toBe(true);
    expect(response.body.providers.openai.keyPreview).toBe('sk-tes...7890');
  });
});
