import { getAgentRegistry } from "./agents/index.js";
import type { AgentName } from "./agents/types.js";
import { coordinateAgents, type CoordinatorRequest, type CoordinatorResponse } from "./multi-agent-coordinator.js";

export type { AgentName };
export type AgentResult = CoordinatorResponse["agents"][number];
export type OrchestratorResponse = CoordinatorResponse;
export interface OrchestratorRequest extends Omit<CoordinatorRequest, "sessionId"> {}

export async function orchestrate(req: OrchestratorRequest & { sessionId: string }): Promise<OrchestratorResponse> {
  return coordinateAgents(req);
}

export function getAgentStatus() {
  const registry = getAgentRegistry();
  return Object.fromEntries(
    Object.entries(registry).map(([name, agent]) => [name, agent.enabled])
  ) as Record<AgentName, boolean>;
}
