import { isEnabledEnv } from "./shared.js";
import { createLocalMockAgent } from "./local-mock-agent.js";
import type { AgentAdapter } from "./types.js";

const ROLE =
  "Revisar seguranca, performance, edge cases, path traversal, comandos perigosos e vazamento de segredo.";

export function createAntygravitAgent(): AgentAdapter {
  return createLocalMockAgent("antygravit", ROLE, isEnabledEnv(process.env.ENABLE_ANTYGRAVIT, true));
}
