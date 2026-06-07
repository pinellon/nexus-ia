import type { NexusIntent } from '../intent-classifier.js';

export type AgentName = 'claude' | 'codex' | 'blackbox' | 'antygravit' | 'mock';
export type AgentMode = 'live' | 'mock' | 'disabled';
export type AgentPhase = 'planning' | 'proposal' | 'review';

export interface AgentInput {
  prompt: string;
  context?: string;
  language?: string;
  intent: NexusIntent;
  phase: AgentPhase;
  researchSummary?: string;
  otherAgentSummaries?: Array<{ agent: AgentName; content: string }>;
}

export interface AgentOutput {
  agent: AgentName;
  content: string;
  latency: number;
  ok: boolean;
  mode: AgentMode;
  error?: string;
  role: string;
}

export interface AgentAdapter {
  name: AgentName;
  enabled: boolean;
  role: string;
  run(input: AgentInput): Promise<AgentOutput>;
}
