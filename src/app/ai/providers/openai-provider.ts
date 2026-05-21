import type { AIMessage, AIProviderResponse } from "./ollama-provider.js";

interface ChatCompletionPayload {
  choices?: Array<{ message?: { content?: string } }>;
  usage?: {
    prompt_tokens?: number;
    completion_tokens?: number;
  };
  error?: { message?: string };
}

function estimateTokens(value: string) {
  return Math.max(1, Math.ceil(value.length / 4));
}

async function readErrorSnippet(response: Response) {
  const text = await response.text().catch(() => "");
  return text.slice(0, 220);
}

export class OpenAIProvider {
  readonly provider = "openai" as const;
  readonly model: string;
  private readonly apiKey?: string;

  constructor(config?: { apiKey?: string; model?: string }) {
    this.apiKey = config?.apiKey || process.env.OPENAI_API_KEY;
    this.model = config?.model || process.env.OPENAI_MODEL || "gpt-4o-mini";
  }

  isConfigured() {
    return Boolean(this.apiKey);
  }

  async chat(messages: AIMessage[]): Promise<AIProviderResponse> {
    if (!this.apiKey) {
      throw new Error("OPENAI_API_KEY nao configurada");
    }

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.apiKey}`
      },
      body: JSON.stringify({
        model: this.model,
        messages: messages.map((message) => ({
          role: message.role,
          content: message.content
        }))
      })
    });

    if (!response.ok) {
      const detail = await readErrorSnippet(response);
      throw new Error(`OpenAI retornou ${response.status}${detail ? `: ${detail}` : ""}`);
    }

    const data = (await response.json()) as ChatCompletionPayload;
    const content = data.choices?.[0]?.message?.content?.trim() || "";

    if (!content) {
      throw new Error("OpenAI retornou resposta vazia. Verifique o modelo em Configuracoes > IA.");
    }

    return {
      provider: this.provider,
      model: this.model,
      content,
      inputTokens: data.usage?.prompt_tokens ?? estimateTokens(messages.map((m) => m.content).join("\n")),
      outputTokens: data.usage?.completion_tokens ?? estimateTokens(content)
    };
  }
}
