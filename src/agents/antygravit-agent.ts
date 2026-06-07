import { buildBaseAgentPrompt, isEnabledEnv } from './shared.js';
import { createLocalMockAgent } from './local-mock-agent.js';
import { retryWithBackoff, AGENT_FETCH_TIMEOUT_MS } from './retry.js';
import type { AgentAdapter, AgentInput, AgentOutput } from './types.js';

const ROLE =
  'Revisar seguranca, performance, edge cases, path traversal, comandos perigosos e vazamento de segredo.';

const SECURITY_SYSTEM_PROMPT = [
  'Voce e um revisor de seguranca especializado.',
  'Foque exclusivamente em vulnerabilidades e problemas de seguranca:',
  '- Injection (SQL, command, SSRF, XSS)',
  '- Path traversal / directory traversal',
  '- Exposicao de segredos (API keys, tokens, senhas)',
  '- Desserializacao insegura',
  '- Race conditions em operacoes criticas',
  '- Permissoes excessivas ou falta de autorizacao',
  '- Dependencias vulneraveis conhecidas',
  '- Validacao de input insuficiente',
  '',
  'Para cada problema encontrado, entregue:',
  '1. Severidade (critica/alta/media/baixa)',
  '2. Localizacao exata (arquivo + trecho)',
  '3. Descricao do risco em 1 frase',
  '4. Sugestao de correcao especifica',
  '',
  'Se nao encontrar problemas, diga "Nenhum problema de seguranca identificado." e sugira boas praticas.',
].join('\n');

/**
 * Attempts to call one of the configured AI providers for a real security review.
 * Falls back to mock if no API keys are available.
 */
export function createAntygravitAgent(): AgentAdapter {
  const enabled = isEnabledEnv(process.env.ENABLE_ANTYGRAVIT, true);
  const mockAgent = createLocalMockAgent('antygravit', ROLE, enabled);

  // Determine which provider to use for security reviews
  const anthropicKey = process.env.ANTHROPIC_API_KEY;
  const openaiKey = process.env.OPENAI_API_KEY;
  const groqKey = process.env.GROQ_API_KEY;

  // If no provider available, use mock
  if (!anthropicKey && !openaiKey && !groqKey) {
    return mockAgent;
  }

  return {
    name: 'antygravit',
    role: ROLE,
    enabled,
    async run(input: AgentInput): Promise<AgentOutput> {
      if (!enabled) {
        return mockAgent.run(input);
      }

      const startedAt = Date.now();

      try {
        let content: string;

        if (groqKey) {
          // Groq is fast and cheap — prefer for security reviews
          content = await callGroq(groqKey, input);
        } else if (openaiKey) {
          content = await callOpenAI(openaiKey, input);
        } else if (anthropicKey) {
          content = await callAnthropic(anthropicKey, input);
        } else {
          return mockAgent.run(input);
        }

        return {
          agent: 'antygravit',
          role: ROLE,
          content,
          latency: Date.now() - startedAt,
          ok: true,
          mode: 'live',
        };
      } catch (error) {
        console.error('[antygravit] fallback to mock:', (error as Error).message);
        return mockAgent.run(input);
      }
    },
  };
}

async function callGroq(apiKey: string, input: AgentInput): Promise<string> {
  const response = await retryWithBackoff(() =>
    fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      signal: AbortSignal.timeout(AGENT_FETCH_TIMEOUT_MS),
      body: JSON.stringify({
        model: process.env.GROQ_MODEL || 'llama-3.1-8b-instant',
        max_tokens: 2048,
        messages: [
          { role: 'system', content: SECURITY_SYSTEM_PROMPT },
          { role: 'user', content: buildBaseAgentPrompt('antygravit', ROLE, input) },
        ],
      }),
    }).then(async (res) => {
      if (!res.ok) throw new Error(`Groq retornou ${res.status}`);
      return res.json() as Promise<{ choices: Array<{ message: { content: string } }> }>;
    }),
  );

  return response.choices[0]?.message?.content || 'Sem resposta do modelo.';
}

async function callOpenAI(apiKey: string, input: AgentInput): Promise<string> {
  const response = await retryWithBackoff(() =>
    fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      signal: AbortSignal.timeout(AGENT_FETCH_TIMEOUT_MS),
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        max_tokens: 2048,
        messages: [
          { role: 'system', content: SECURITY_SYSTEM_PROMPT },
          { role: 'user', content: buildBaseAgentPrompt('antygravit', ROLE, input) },
        ],
      }),
    }).then(async (res) => {
      if (!res.ok) throw new Error(`OpenAI retornou ${res.status}`);
      return res.json() as Promise<{ choices: Array<{ message: { content: string } }> }>;
    }),
  );

  return response.choices[0]?.message?.content || 'Sem resposta do modelo.';
}

async function callAnthropic(apiKey: string, input: AgentInput): Promise<string> {
  const response = await retryWithBackoff(() =>
    fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      signal: AbortSignal.timeout(AGENT_FETCH_TIMEOUT_MS),
      body: JSON.stringify({
        model: 'claude-3-5-haiku-20241022',
        max_tokens: 2048,
        system: SECURITY_SYSTEM_PROMPT,
        messages: [
          { role: 'user', content: buildBaseAgentPrompt('antygravit', ROLE, input) },
        ],
      }),
    }).then(async (res) => {
      if (!res.ok) throw new Error(`Anthropic retornou ${res.status}`);
      return res.json() as Promise<{ content: Array<{ type: string; text: string }> }>;
    }),
  );

  return response.content
    .filter((block) => block.type === 'text')
    .map((block) => block.text)
    .join('') || 'Sem resposta do modelo.';
}
