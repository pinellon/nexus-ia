import Anthropic from '@anthropic-ai/sdk';

import type { AIMessage, AIProviderResponse } from './ollama-provider.js';

function estimateTokens(value: string) {
  return Math.max(1, Math.ceil(value.length / 4));
}

export class AnthropicProvider {
  readonly provider = 'anthropic' as const;
  readonly model: string;
  private readonly apiKey?: string;

  constructor(config?: { apiKey?: string; model?: string }) {
    this.apiKey = config?.apiKey || process.env.ANTHROPIC_API_KEY;
    this.model = config?.model || process.env.ANTHROPIC_MODEL || 'claude-sonnet-4-20250514';
  }

  isConfigured() {
    return Boolean(this.apiKey);
  }

  async chat(messages: AIMessage[]): Promise<AIProviderResponse> {
    if (!this.apiKey) {
      throw new Error('ANTHROPIC_API_KEY nao configurada');
    }

    const system = messages.find((message) => message.role === 'system')?.content || '';
    const conversation = messages
      .filter((message) => message.role !== 'system')
      .map((message) => ({
        role: message.role === 'assistant' ? ('assistant' as const) : ('user' as const),
        content: message.content,
      }));
    const client = new Anthropic({ apiKey: this.apiKey });
    const response = await client.messages.create({
      model: this.model,
      max_tokens: 900,
      system,
      messages: conversation.length
        ? conversation
        : [{ role: 'user', content: 'Analise o projeto.' }],
    });
    const content = response.content
      .filter((block) => block.type === 'text')
      .map((block) => block.text)
      .join('');

    return {
      provider: this.provider,
      model: this.model,
      content,
      inputTokens:
        response.usage.input_tokens ??
        estimateTokens(messages.map((message) => message.content).join('\n')),
      outputTokens: response.usage.output_tokens ?? estimateTokens(content),
    };
  }
}
