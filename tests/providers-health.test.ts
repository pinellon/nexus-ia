import path from "node:path";

import request from "supertest";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

const dataDir = path.resolve(process.cwd(), ".tmp-tests/providers-health-data");

describe("providers health endpoint", () => {
  beforeAll(() => {
    process.env.NEXUS_DATA_DIR = dataDir;
    process.env.NODE_ENV = "test";
  });

  beforeEach(() => {
    delete process.env.ANTHROPIC_API_KEY;
    delete process.env.OPENAI_API_KEY;
    delete process.env.GEMINI_API_KEY;
    delete process.env.GROQ_API_KEY;
    delete process.env.OPENROUTER_API_KEY;
    vi.resetModules();
  });

  it("reports structured provider and fallback availability", async () => {
    const { app } = await import("../src/server.js");

    const response = await request(app).get("/api/providers/health").expect(200);

    expect(response.body).toMatchObject({
      ok: true,
      model_available: expect.any(Boolean),
      fallback_available: true,
      active_provider: expect.any(String),
      configured_providers: expect.any(Array),
      reachable_local_model: expect.any(Boolean)
    });
    expect(["real", "mock", "fallback", "unavailable"]).toContain(response.body.provider_mode);
    expect(Array.isArray(response.body.notes)).toBe(true);
  });
});
