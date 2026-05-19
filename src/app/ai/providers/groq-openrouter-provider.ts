import { estimateTokens, type AIMessage, type AIProvider, type AIProviderResponse } from "./types.js";

interface OpenAICompatResponse {
  choices?: Array<{ message?: { content?: string } }>;
  usage?: { prompt_tokens?: number; completion_tokens?: number };
}

async function callOpenAICompat(
  url: string,
  apiKey: string,
  model: string,
  messages: AIMessage[],
  extraHeaders?: Record<string, string>
): Promise<AIProviderResponse> {
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
      ...extraHeaders
    },
    body: JSON.stringify({ model, messages, max_tokens: 1200, temperature: 0.3 })
  });

  if (!res.ok) {
    const err = await res.text().catch(() => res.statusText);
    throw new Error(`${url} retornou ${res.status}: ${err.slice(0, 200)}`);
  }

  const data = await res.json() as OpenAICompatResponse;
  const content = data.choices?.[0]?.message?.content || "";
  const provider = url.includes("groq") ? "groq" : url.includes("openrouter") ? "openrouter" : "openai";

  return {
    provider,
    model,
    content,
    inputTokens: data.usage?.prompt_tokens ?? estimateTokens(messages.map(m => m.content).join("\n")),
    outputTokens: data.usage?.completion_tokens ?? estimateTokens(content)
  };
}

export class GroqProvider implements AIProvider {
  readonly provider = "groq" as const;
  readonly model: string;
  private readonly apiKey: string;

  constructor(config?: { apiKey?: string; model?: string }) {
    this.apiKey = config?.apiKey || process.env.GROQ_API_KEY || "";
    this.model = config?.model || process.env.GROQ_MODEL || "llama-3.3-70b-versatile";
  }

  isConfigured() { return Boolean(this.apiKey); }

  async chat(messages: AIMessage[]): Promise<AIProviderResponse> {
    if (!this.apiKey) throw new Error("GROQ_API_KEY não configurada");
    return callOpenAICompat("https://api.groq.com/openai/v1/chat/completions", this.apiKey, this.model, messages);
  }
}

export class OpenRouterProvider implements AIProvider {
  readonly provider = "openrouter" as const;
  readonly model: string;
  private readonly apiKey: string;

  constructor(config?: { apiKey?: string; model?: string }) {
    this.apiKey = config?.apiKey || process.env.OPENROUTER_API_KEY || "";
    this.model = config?.model || process.env.OPENROUTER_MODEL || "anthropic/claude-sonnet-4";
  }

  isConfigured() { return Boolean(this.apiKey); }

  async chat(messages: AIMessage[]): Promise<AIProviderResponse> {
    if (!this.apiKey) throw new Error("OPENROUTER_API_KEY não configurada");
    return callOpenAICompat(
      "https://openrouter.ai/api/v1/chat/completions",
      this.apiKey,
      this.model,
      messages,
      { "HTTP-Referer": "https://nexus-codex", "X-Title": "Nexus Codex" }
    );
  }
}
