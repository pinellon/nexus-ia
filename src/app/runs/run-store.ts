import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

import type { AgentEvent, AgentRun, AgentRunStatus } from '../agents/models.js';
import { resolveNexusDataPath } from '../../nexus-data-dir.js';

const dataDir = resolveNexusDataPath();
const runsFile = resolveNexusDataPath('runs.jsonl');
const finalStatuses = new Set<AgentRunStatus>(['completed', 'failed', 'cancelled', 'interrupted']);
const activeStatuses = new Set<AgentRunStatus>(['started', 'planning', 'running']);
const resumableStatuses = new Set<AgentRunStatus>(['needs_approval']);

export type RunLogRecord =
  | {
      type: 'run_started';
      runId: string;
      sessionId?: string;
      agentId: string;
      projectId: string;
      projectRoot: string;
      goal: string;
      status: AgentRunStatus;
      createdAt: string;
    }
  | {
      type: 'run_status';
      runId: string;
      status: AgentRunStatus;
      updatedAt: string;
    }
  | {
      type: 'run_event';
      runId: string;
      event: AgentEvent;
      createdAt: string;
    };

async function ensureStore() {
  await mkdir(dataDir, { recursive: true });
  try {
    await readFile(runsFile, 'utf8');
  } catch {
    await writeFile(runsFile, '', 'utf8');
  }
}

async function appendJsonLine(record: RunLogRecord) {
  await ensureStore();
  await writeFile(runsFile, `${JSON.stringify(record)}\n`, { encoding: 'utf8', flag: 'a' });
}

export class AgentRunStore {
  async recordRunStarted(run: AgentRun) {
    await appendJsonLine({
      type: 'run_started',
      runId: run.id,
      agentId: run.agentId,
      projectId: run.projectId,
      projectRoot: run.projectRoot,
      goal: run.userGoal,
      status: run.status,
      createdAt: run.createdAt,
    });
  }

  async recordRunStatus(runId: string, status: AgentRunStatus) {
    await appendJsonLine({
      type: 'run_status',
      runId,
      status,
      updatedAt: new Date().toISOString(),
    });
  }

  async recordRunEvent(event: AgentEvent) {
    await appendJsonLine({
      type: 'run_event',
      runId: event.runId,
      event,
      createdAt: event.createdAt,
    });
  }

  async loadProjectRuns() {
    await ensureStore();
    const raw = await readFile(runsFile, 'utf8');
    const statuses = new Map<string, AgentRunStatus>();

    for (const line of raw.split(/\r?\n/)) {
      if (!line.trim()) {
        continue;
      }
      try {
        const record = JSON.parse(line) as RunLogRecord;
        if (record.type === 'run_started') {
          statuses.set(record.runId, record.status);
        }
        if (record.type === 'run_status') {
          statuses.set(record.runId, record.status);
        }
      } catch {
        // Ignore corrupt JSONL lines instead of blocking server boot.
      }
    }

    return statuses;
  }

  async loadRunSnapshots() {
    await ensureStore();
    const raw = await readFile(runsFile, 'utf8');
    const runs = new Map<string, AgentRun>();
    const events = new Map<string, AgentEvent[]>();

    for (const line of raw.split(/\r?\n/)) {
      if (!line.trim()) continue;
      try {
        const record = JSON.parse(line) as RunLogRecord;
        if (record.type === 'run_started') {
          runs.set(record.runId, {
            id: record.runId,
            agentId: record.agentId,
            userGoal: record.goal,
            projectRoot: record.projectRoot,
            projectId: record.projectId,
            status: record.status,
            createdAt: record.createdAt,
            updatedAt: record.createdAt,
            currentMessage: 'Run restaurada do historico local',
            cancelRequested: false,
            steps: [],
          });
          continue;
        }
        if (record.type === 'run_status') {
          const run = runs.get(record.runId);
          if (run) {
            run.status = record.status;
            run.updatedAt = record.updatedAt;
            run.currentMessage = `Status restaurado: ${record.status}`;
          }
          continue;
        }
        if (record.type === 'run_event') {
          const list = events.get(record.runId) ?? [];
          list.push(record.event);
          events.set(record.runId, list);
          const run = runs.get(record.runId);
          if (run) {
            run.updatedAt = record.event.createdAt;
            run.currentMessage = record.event.message;
          }
        }
      } catch {
        // Ignore corrupt JSONL lines instead of blocking server boot.
      }
    }

    return {
      runs: Array.from(runs.values()).sort(
        (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
      ),
      events,
    };
  }

  async markInterruptedRunsOnBoot() {
    const statuses = await this.loadProjectRuns();
    const interrupted: string[] = [];

    for (const [runId, status] of statuses) {
      if (resumableStatuses.has(status)) continue;
      if (!finalStatuses.has(status) && activeStatuses.has(status)) {
        interrupted.push(runId);
      }
    }

    for (const runId of interrupted) {
      await this.recordRunStatus(runId, 'interrupted');
    }

    return interrupted;
  }
}

export const agentRunStore = new AgentRunStore();
