import { randomUUID } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

import type { AgentArtifact, AgentArtifactType } from './models.js';
import { nowIso, sanitizeArtifactPreview } from './utils.js';
import { resolveNexusDataPath } from '../../nexus-data-dir.js';

const dataRoot = resolveNexusDataPath('projects');

interface ArtifactIndex {
  artifacts: AgentArtifact[];
}

function extensionForArtifact(type: AgentArtifactType) {
  switch (type) {
    case 'plan':
      return 'plan.md';
    case 'diff':
      return 'diff.patch';
    case 'patch':
      return 'patch.patch';
    case 'terminal_output':
      return 'terminal.txt';
    case 'test_result':
      return 'tests.json';
    case 'security_report':
      return 'security.md';
    case 'docs_update':
      return 'readme_draft.md';
    case 'file_summary':
    default:
      return 'summary.md';
  }
}

function contentAsString(content: string | object) {
  return typeof content === 'string' ? content : JSON.stringify(content, null, 2);
}

export class ArtifactStore {
  private indexCache = new Map<string, ArtifactIndex>();

  private async ensureProjectArtifactDir(projectId: string) {
    const artifactDir = path.join(dataRoot, projectId, 'artifacts');
    await mkdir(artifactDir, { recursive: true });
    return artifactDir;
  }

  private async loadIndex(projectId: string) {
    if (this.indexCache.has(projectId)) {
      return this.indexCache.get(projectId)!;
    }

    const artifactDir = await this.ensureProjectArtifactDir(projectId);
    const indexPath = path.join(artifactDir, 'index.json');

    try {
      const raw = await readFile(indexPath, 'utf8');
      const parsed = JSON.parse(raw) as ArtifactIndex;
      const index = { artifacts: Array.isArray(parsed.artifacts) ? parsed.artifacts : [] };
      this.indexCache.set(projectId, index);
      return index;
    } catch {
      const empty = { artifacts: [] };
      this.indexCache.set(projectId, empty);
      return empty;
    }
  }

  private async saveIndex(projectId: string, index: ArtifactIndex) {
    const artifactDir = await this.ensureProjectArtifactDir(projectId);
    await writeFile(path.join(artifactDir, 'index.json'), JSON.stringify(index, null, 2), 'utf8');
  }

  async saveArtifact(input: {
    runId: string;
    projectId: string;
    type: AgentArtifactType;
    title: string;
    summary: string;
    content: string | object;
    metadata?: Record<string, unknown>;
    actionId?: string;
  }): Promise<AgentArtifact> {
    const artifactId = randomUUID();
    const artifactDir = await this.ensureProjectArtifactDir(input.projectId);
    const filename = `${input.runId}-${artifactId}-${extensionForArtifact(input.type)}`;
    const filePath = path.join(artifactDir, filename);
    const body = contentAsString(input.content);

    await writeFile(filePath, body, 'utf8');

    const artifact: AgentArtifact = {
      id: artifactId,
      runId: input.runId,
      projectId: input.projectId,
      type: input.type,
      title: input.title,
      path: filePath,
      createdAt: nowIso(),
      summary: input.summary,
      metadata: input.metadata,
      actionId: input.actionId,
      contentPreview: sanitizeArtifactPreview(body),
    };

    const index = await this.loadIndex(input.projectId);
    index.artifacts.unshift(artifact);
    await this.saveIndex(input.projectId, index);
    return artifact;
  }

  async listArtifacts(projectId: string, runId?: string) {
    const index = await this.loadIndex(projectId);
    return index.artifacts.filter((artifact) => !runId || artifact.runId === runId);
  }
}
