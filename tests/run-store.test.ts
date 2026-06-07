import { mkdtemp, readFile, rm } from 'node:fs/promises';
import path from 'node:path';
import { tmpdir } from 'node:os';

import { describe, expect, it, vi } from 'vitest';

describe('run-store', () => {
  it('persists runs and marks unfinished running runs as interrupted on boot', async () => {
    const dataDir = await mkdtemp(path.join(tmpdir(), 'nexus-runs-'));
    process.env.NEXUS_DATA_DIR = dataDir;
    vi.resetModules();

    const { AgentRunStore } = await import('../src/app/runs/run-store.js');
    const store = new AgentRunStore();

    await store.recordRunStarted({
      id: 'run-1',
      agentId: 'debug_agent',
      userGoal: 'test',
      projectRoot: process.cwd(),
      projectId: 'test-project',
      status: 'started',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      cancelRequested: false,
      steps: [],
    });

    await expect(store.markInterruptedRunsOnBoot()).resolves.toEqual(['run-1']);
    const jsonl = await readFile(path.join(dataDir, 'runs.jsonl'), 'utf8');
    expect(jsonl).toContain('"type":"run_started"');
    expect(jsonl).toContain('"status":"interrupted"');

    await rm(dataDir, { recursive: true, force: true });
  });

  it('keeps needs_approval runs unchanged on boot', async () => {
    const dataDir = await mkdtemp(path.join(tmpdir(), 'nexus-runs-approval-'));
    process.env.NEXUS_DATA_DIR = dataDir;
    vi.resetModules();

    const { AgentRunStore } = await import('../src/app/runs/run-store.js');
    const store = new AgentRunStore();

    await store.recordRunStarted({
      id: 'run-approval',
      agentId: 'debug_agent',
      userGoal: 'test approval',
      projectRoot: process.cwd(),
      projectId: 'test-project',
      status: 'needs_approval',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      cancelRequested: false,
      steps: [],
    });

    await expect(store.markInterruptedRunsOnBoot()).resolves.toEqual([]);
    const jsonl = await readFile(path.join(dataDir, 'runs.jsonl'), 'utf8');
    expect(jsonl).toContain('"status":"needs_approval"');
    expect(jsonl).not.toContain('"status":"interrupted"');

    await rm(dataDir, { recursive: true, force: true });
  });

  it('loads persisted run details and events for dashboard APIs', async () => {
    const dataDir = await mkdtemp(path.join(tmpdir(), 'nexus-runs-dashboard-'));
    process.env.NEXUS_DATA_DIR = dataDir;
    vi.resetModules();

    const { AgentRunStore } = await import('../src/app/runs/run-store.js');
    const store = new AgentRunStore();
    const createdAt = new Date().toISOString();

    await store.recordRunStarted({
      id: 'run-dashboard',
      agentId: 'docs_agent',
      userGoal: 'dashboard history',
      projectRoot: process.cwd(),
      projectId: 'project-dashboard',
      status: 'started',
      createdAt,
      updatedAt: createdAt,
      cancelRequested: false,
      steps: [],
    });
    await store.recordRunEvent({
      id: 'event-1',
      runId: 'run-dashboard',
      type: 'started',
      createdAt,
      message: 'started',
      level: 'info',
    });
    await store.recordRunStatus('run-dashboard', 'completed');

    const loaded = await store.loadRunSnapshots();
    expect(loaded.runs[0]).toMatchObject({
      id: 'run-dashboard',
      status: 'completed',
      agentId: 'docs_agent',
    });
    expect(loaded.events.get('run-dashboard')).toHaveLength(1);

    await rm(dataDir, { recursive: true, force: true });
  });
});
