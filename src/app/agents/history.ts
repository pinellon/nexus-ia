import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

import type { AgentArtifact } from './models.js';
import { nowIso, redactSensitiveText, truncateText } from './utils.js';
import { resolveNexusDataPath } from '../../nexus-data-dir.js';

const dataRoot = resolveNexusDataPath('projects');

type HistoryEntry =
  | {
      kind: 'message';
      createdAt: string;
      role: string;
      content: string;
      metadata?: Record<string, unknown>;
    }
  | {
      kind: 'artifact';
      createdAt: string;
      artifact: AgentArtifact;
    };

export class ProjectHistoryManager {
  private async ensureProjectDir(projectId: string) {
    const projectDir = path.join(dataRoot, projectId);
    await mkdir(projectDir, { recursive: true });
    return projectDir;
  }

  private async historyPath(projectId: string) {
    return path.join(await this.ensureProjectDir(projectId), 'history.jsonl');
  }

  async load_project_history(projectId: string): Promise<HistoryEntry[]> {
    try {
      const raw = await readFile(await this.historyPath(projectId), 'utf8');
      return raw
        .split('\n')
        .map((line) => line.trim())
        .filter(Boolean)
        .map((line) => JSON.parse(line) as HistoryEntry);
    } catch {
      return [];
    }
  }

  async save_project_history(projectId: string, entries: HistoryEntry[]) {
    const body = entries.map((entry) => JSON.stringify(entry)).join('\n');
    await writeFile(await this.historyPath(projectId), body ? `${body}\n` : '', 'utf8');
  }

  async add_message(
    projectId: string,
    role: string,
    content: string,
    metadata?: Record<string, unknown>,
  ) {
    const entries = await this.load_project_history(projectId);
    entries.push({
      kind: 'message',
      createdAt: nowIso(),
      role,
      content: redactSensitiveText(content),
      metadata,
    });
    await this.save_project_history(projectId, entries);
  }

  async add_artifact(projectId: string, artifact: AgentArtifact) {
    const entries = await this.load_project_history(projectId);
    entries.push({
      kind: 'artifact',
      createdAt: nowIso(),
      artifact,
    });
    await this.save_project_history(projectId, entries);
  }

  async summarize_if_needed(projectId: string) {
    const entries = await this.load_project_history(projectId);
    if (entries.length <= 24) {
      return null;
    }

    const recent = entries.slice(-12);
    const summary = recent
      .map((entry) => {
        if (entry.kind === 'message') {
          return `[${entry.role}] ${truncateText(entry.content, 220)}`;
        }

        return `[artifact:${entry.artifact.type}] ${entry.artifact.title} - ${entry.artifact.summary}`;
      })
      .join('\n');

    return {
      totalEntries: entries.length,
      summary,
    };
  }
}
