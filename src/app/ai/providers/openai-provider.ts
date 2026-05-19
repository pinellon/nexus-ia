import type { AIMessage, AIProviderResponse } from "./ollama-provider.js";

interface OpenAIResponsesPayload {
  output_text?: string;
  usage?: {
    input_tokens?: number;
    output_tokens?: number;
  };
}

function estimateTokens(value: string) {
  return Math.max(1, Math.ceil(value.length / 4));
}

export class OpenAIProvider {
  readonly provider = "openai" as const;
  readonly model: string;
  private readonly apiKey?: string;

  constructor(config?: { apiKey?: string; model?: string }) {
    this.apiKey = config?.apiKey || process.env.OPENAI_API_KEY;
    this.model = config?.model || process.env.OPENAI_MODEL || "gpt-4.1";
  }

  isConfigured() {
    return Boolean(this.apiKey);
  }

  async chat(messages: AIMessage[]): Promise<AIProviderResponse> {
    if (!this.apiKey) {
      throw new Error("OPENAI_API_KEY nao configurada");
    }

    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.apiKey}`
      },
      body: JSON.stringify({
        model: this.model,
        input: messages.map((message) => ({
          role: message.role === "system" ? "developer" : message.role,
          content: message.content
        }))
      })
    });

    if (!response.ok) {
      throw new Error(`OpenAI retornou ${response.status}`);
    }

    const data = (await response.json()) as OpenAIResponsesPayload;
    const content = data.output_text || "";

    return {
      provider: this.provider,
      model: this.model,
      content,
      inputTokens: data.usage?.input_tokens ?? estimateTokens(messages.map((message) => message.content).join("\n")),
      outputTokens: data.usage?.output_tokens ?? estimateTokens(content)
    };
  }
}
