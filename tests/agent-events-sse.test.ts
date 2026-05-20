import { mkdir, rm } from "node:fs/promises";
import type { IncomingMessage } from "node:http";
import path from "node:path";

import request from "supertest";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

const dataDir = path.resolve(process.cwd(), ".tmp-tests/agent-events-sse-data");
const projectRoot = ".tmp-tests/agent-events-sse-project";
const absoluteProjectRoot = path.resolve(process.cwd(), projectRoot);

function collectSseBody(res: IncomingMessage, callback: (error: Error | null, body?: string) => void) {
  let body = "";
  res.setEncoding("utf8");
  res.on("data", (chunk) => {
    body += chunk;
  });
  res.on("end", () => callback(null, body));
}

describe("agent run event endpoints", () => {
  beforeAll(() => {
    process.env.NEXUS_DATA_DIR = dataDir;
    process.env.NODE_ENV = "test";
  });

  beforeEach(async () => {
    await rm(dataDir, { recursive: true, force: true });
    await rm(absoluteProjectRoot, { recursive: true, force: true });
    await mkdir(absoluteProjectRoot, { recursive: true });
    vi.resetModules();
  });

  it("streams existing and new run events as text/event-stream", async () => {
    const { agentRunner } = await import("../src/app/agents/runner.js");
    const { app } = await import("../src/server.js");

    const run = await agentRunner.run_agent(
      "docs_agent",
      "Crie um arquivo docs/sse-test.md com um resumo curto do Nexus Codex.",
      projectRoot
    );

    const response = await request(app)
      .get(`/api/agents/runs/${run.id}/events/stream`)
      .buffer(true)
      .parse(collectSseBody)
      .expect(200)
      .expect("Content-Type", /text\/event-stream/);

    const body = String(response.text ?? response.body ?? "");
    expect(body).toContain("event: agent_event");
    expect(body).toContain('"runId"');
    expect(body).toContain(run.id);
    expect(body).toMatch(/"type":"(started|planning|reading_project|tool_call|needs_approval|completed|failed)"/);

    const legacy = await request(app).get(`/api/agents/runs/${run.id}/events`).expect(200);
    expect(legacy.body.ok).toBe(true);
    expect(Array.isArray(legacy.body.data)).toBe(true);
    expect(legacy.body.data.length).toBeGreaterThan(0);
  });
});
