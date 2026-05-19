import { buildBaseAgentPrompt, isEnabledEnv } from "./shared.js";
import { createLocalMockAgent } from "./local-mock-agent.js";
import type { AgentAdapter, AgentInput, AgentOutput } from "./types.js";

const ROLE =
  "Montar implementacao, patches pequenos, testes e integracao com arquivos reais do workspace.";

interface OpenAIResponse {
  output_text?: string;
}

export function createCodexAgent(): AgentAdapter {
  const enabled = isEnabledEnv(process.env.ENABLE_CODEX, true);
  const apiKey = process.env.OPENAI_API_KEY;
  const model = process.env.OPENAI_MODEL || "gpt-4.1";

  if (!enabled || !apiKey) {
    return createLocalMockAgent("codex", ROLE, enabled);
  }

  return {
    name: "codex",
    enabled,
    role: ROLE,
    async run(input: AgentInput): Promise<AgentOutput> {
      const startedAt = Date.now();

      try {
        const response = await fetch("https://api.openai.com/v1/responses", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${apiKey}`
          },
          body: JSON.stringify({
            model,
            input: [
              {
                role: "system",
                content: [
                  {
                    type: "input_text",
                    text: buildBaseAgentPrompt("codex", ROLE, input)
                  }
                ]
              },
              {
                role: "user",
                content: [
                  {
                    type: "input_text",
                    text: `${input.prompt}\n\nQuando fizer sentido, entregue acoes estruturadas em JSON dentro de bloco markdown json.`
                  }
                ]
              }
            ]
          })
        });

        if (!response.ok) {
          throw new Error(`OpenAI retornou ${response.status}`);
        }

        const data = (await response.json()) as OpenAIResponse;

        return {
          agent: "codex",
          role: ROLE,
          content: data.output_text || "Sem conteudo retornado pelo modelo.",
          latency: Date.now() - startedAt,
          ok: true,
          mode: "live"
        };
      } catch (error) {
        return {
          ...(await createLocalMockAgent("codex", ROLE, enabled).run(input)),
          error: error instanceof Error ? error.message : "Falha ao chamar Codex/OpenAI"
        };
      }
    }
  };
}
