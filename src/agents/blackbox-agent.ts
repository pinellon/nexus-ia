import { buildBaseAgentPrompt, isEnabledEnv } from './shared.js';
import { createLocalMockAgent } from './local-mock-agent.js';
import type { AgentAdapter, AgentInput, AgentOutput } from './types.js';

const ROLE =
  'Pesquisar exemplos, bibliotecas, alternativas populares e referencias uteis sem assumir aplicacao automatica.';

export function createBlackboxAgent(): AgentAdapter {
  const enabled = isEnabledEnv(process.env.ENABLE_BLACKBOX, false);
  const apiKey = process.env.BLACKBOX_API_KEY;
  const apiUrl = process.env.BLACKBOX_API_URL;

  if (!enabled) {
    return {
      name: 'blackbox',
      role: ROLE,
      enabled: false,
      async run() {
        return {
          agent: 'blackbox',
          role: ROLE,
          content: 'Blackbox desabilitado por configuracao.',
          latency: 0,
          ok: false,
          mode: 'disabled',
        };
      },
    };
  }

  if (!apiKey || !apiUrl) {
    return createLocalMockAgent('blackbox', ROLE, true);
  }

  return {
    name: 'blackbox',
    enabled: true,
    role: ROLE,
    async run(input: AgentInput): Promise<AgentOutput> {
      const startedAt = Date.now();

      try {
        const response = await fetch(apiUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${apiKey}`,
          },
          body: JSON.stringify({
            prompt: buildBaseAgentPrompt('blackbox', ROLE, input),
          }),
        });

        if (!response.ok) {
          throw new Error(`BLACKBOX_API_URL retornou ${response.status}`);
        }

        const data = (await response.json()) as {
          text?: string;
          content?: string;
          output?: string;
        };
        const content = data.text || data.content || data.output;
        if (!content) {
          throw new Error('Resposta do Blackbox sem campo de texto reconhecido');
        }

        return {
          agent: 'blackbox',
          role: ROLE,
          content,
          latency: Date.now() - startedAt,
          ok: true,
          mode: 'live',
        };
      } catch (error) {
        return {
          ...(await createLocalMockAgent('blackbox', ROLE, true).run(input)),
          error:
            error instanceof Error
              ? `${error.message}. Ajuste o contrato do adapter em BLACKBOX_API_URL para o provedor real.`
              : 'Falha ao chamar Blackbox',
        };
      }
    },
  };
}
