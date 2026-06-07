import type { AIMessage, AIProvider, AIProviderResponse } from './types.js';
import { estimateTokens } from './types.js';

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : 'Falha desconhecida';
}

function messagesToPrompt(messages: AIMessage[]) {
  return messages
    .map((message) => {
      const role =
        message.role === 'assistant' ? 'assistant' : message.role === 'system' ? 'system' : 'user';
      return `[${role}]\n${message.content}`;
    })
    .join('\n\n');
}

export class NexusLocalProvider implements AIProvider {
  readonly provider = 'nexuslocal';
  readonly baseUrl: string;
  readonly model: string;

  constructor(config?: { baseUrl?: string; model?: string }) {
    this.baseUrl = (
      config?.baseUrl ||
      process.env.NEXUS_LOCAL_BASE_URL ||
      'http://127.0.0.1:5000'
    ).replace(/\/$/, '');
    this.model = config?.model || process.env.NEXUS_LOCAL_MODEL || 'nexus-coder-tiny';
  }

  isConfigured() {
    return Boolean(this.baseUrl && this.model);
  }

  async isReachable() {
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 1800);
      const response = await fetch(`${this.baseUrl}/health`, { signal: controller.signal });
      clearTimeout(timer);
      return response.ok;
    } catch {
      return false;
    }
  }

  async chat(messages: AIMessage[]): Promise<AIProviderResponse> {
    const prompt = messagesToPrompt(messages);
    try {
      const response = await fetch(`${this.baseUrl}/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt,
          max_new_tokens: 300,
          temperature: 0.2,
          top_k: 20,
          few_shot: false,
        }),
      });

      if (!response.ok) {
        throw new Error(`NexusAI retornou ${response.status}`);
      }

      const data = (await response.json()) as { generated_code?: string };
      const content = data.generated_code || '';
      return {
        provider: this.provider,
        model: this.model,
        content,
        inputTokens: estimateTokens(prompt),
        outputTokens: estimateTokens(content),
      };
    } catch (error) {
      throw new Error(
        `NexusAI local nao esta ativo. Inicie a API Flask em NexusAI/app.py. Detalhe: ${getErrorMessage(error)}`,
      );
    }
  }
}
