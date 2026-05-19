import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import type { AgentEvent, AgentRun, AgentRunStatus } from "../agents/models.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const defaultDataDir = path.resolve(__dirname, "../../../data");
const dataDir = process.env.NEXUS_DATA_DIR ? path.resolve(process.env.NEXUS_DATA_DIR) : defaultDataDir;
const runsFile = path.join(dataDir, "runs.jsonl");
const finalStatuses = new Set<AgentRunStatus>(["completed", "failed", "cancelled", "interrupted"]);
const activeStatuses = new Set<AgentRunStatus>(["started", "planning", "running"]);
const resumableStatuses = new Set<AgentRunStatus>(["needs_approval"]);

export type RunLogRecord =
  | {
      type: "run_started";
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
      type: "run_status";
      runId: string;
      status: AgentRunStatus;
      updatedAt: string;
    }
  | {
      type: "run_event";
      runId: string;
      event: AgentEvent;
      createdAt: string;
    };

async function ensureStore() {
  await mkdir(dataDir, { recursive: true });
  try {
    await readFile(runsFile, "utf8");
  } catch {
    await writeFile(runsFile, "", "utf8");
  }
}

async function appendJsonLine(record: RunLogRecord) {
  await ensureStore();
  await writeFile(runsFile, `${JSON.stringify(record)}\n`, { encoding: "utf8", flag: "a" });
}

export class AgentRunStore {
  async recordRunStarted(run: AgentRun) {
    await appendJsonLine({
      type: "run_started",
      runId: run.id,
      agentId: run.agentId,
      projectId: run.projectId,
      projectRoot: run.projectRoot,
      goal: run.userGoal,
      status: run.status,
      createdAt: run.createdAt
    });
  }

  async recordRunStatus(runId: string, status: AgentRunStatus) {
    await appendJsonLine({
      type: "run_status",
      runId,
      status,
      updatedAt: new Date().toISOString()
    });
  }

  async recordRunEvent(event: AgentEvent) {
    await appendJsonLine({
      type: "run_event",
      runId: event.runId,
      event,
      createdAt: event.createdAt
    });
  }

  async loadProjectRuns() {
    await ensureStore();
    const raw = await readFile(runsFile, "utf8");
    const statuses = new Map<string, AgentRunStatus>();

    for (const line of raw.split(/\r?\n/)) {
      if (!line.trim()) {
        continue;
      }
      try {
        const record = JSON.parse(line) as RunLogRecord;
        if (record.type === "run_started") {
          statuses.set(record.runId, record.status);
        }
        if (record.type === "run_status") {
          statuses.set(record.runId, record.status);
        }
      } catch {
        // Ignore corrupt JSONL lines instead of blocking server boot.
      }
    }

    return statuses;
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
      await this.recordRunStatus(runId, "interrupted");
    }

    return interrupted;
  }
}

export const agentRunStore = new AgentRunStore();
