import { createAntygravitAgent } from './antygravit-agent.js';
import { createBlackboxAgent } from './blackbox-agent.js';
import { createClaudeAgent } from './claude-agent.js';
import { createCodexAgent } from './codex-agent.js';
import { createLocalMockAgent } from './local-mock-agent.js';
import type { AgentAdapter, AgentName } from './types.js';

export function getAgentRegistry(): Record<AgentName, AgentAdapter> {
  return {
    claude: createClaudeAgent(),
    codex: createCodexAgent(),
    blackbox: createBlackboxAgent(),
    antygravit: createAntygravitAgent(),
    mock: createLocalMockAgent(
      'mock',
      'Responder em modo local quando nenhum provedor real estiver ativo.',
      true,
    ),
  };
}

export function getEnabledAgents() {
  return Object.values(getAgentRegistry()).filter((agent) => agent.enabled);
}
