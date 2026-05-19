import { buildMockAgentResponse } from "./shared.js";
import type { AgentAdapter, AgentInput, AgentOutput, AgentName } from "./types.js";

export function createLocalMockAgent(name: AgentName, role: string, enabled = true): AgentAdapter {
  return {
    name,
    role,
    enabled,
    async run(input: AgentInput): Promise<AgentOutput> {
      const startedAt = Date.now();

      return {
        agent: name,
        role,
        content: buildMockAgentResponse(name, role, input),
        latency: Date.now() - startedAt,
        ok: true,
        mode: "mock"
      };
    }
  };
}
