import Anthropic from "@anthropic-ai/sdk";

import { buildBaseAgentPrompt, isEnabledEnv } from "./shared.js";
import { createLocalMockAgent } from "./local-mock-agent.js";
import type { AgentAdapter, AgentInput, AgentOutput } from "./types.js";

const ROLE = "Planejar arquitetura, clarear trade-offs e manter consistencia tecnica do projeto.";

export function createClaudeAgent(): AgentAdapter {
  const enabled = isEnabledEnv(process.env.ENABLE_CLAUDE, true);
  const apiKey = process.env.ANTHROPIC_API_KEY;
  const model = process.env.ANTHROPIC_MODEL || "claude-sonnet-4-20250514";

  if (!enabled || !apiKey) {
    return createLocalMockAgent("claude", ROLE, enabled);
  }

  const client = new Anthropic({ apiKey });

  return {
    name: "claude",
    enabled,
    role: ROLE,
    async run(input: AgentInput): Promise<AgentOutput> {
      const startedAt = Date.now();

      try {
        const response = await client.messages.create({
          model,
          max_tokens: 1200,
          system: buildBaseAgentPrompt("claude", ROLE, input),
          messages: [{ role: "user", content: input.prompt }]
        });

        const text = response.content
          .filter((block) => block.type === "text")
          .map((block) => block.text)
          .join("");

        return {
          agent: "claude",
          role: ROLE,
          content: text,
          latency: Date.now() - startedAt,
          ok: true,
          mode: "live"
        };
      } catch (error) {
        return {
          ...(await createLocalMockAgent("claude", ROLE, enabled).run(input)),
          error: error instanceof Error ? error.message : "Falha ao chamar Claude"
        };
      }
    }
  };
}
