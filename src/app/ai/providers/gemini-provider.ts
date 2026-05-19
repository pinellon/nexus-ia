import { estimateTokens, type AIMessage, type AIProvider, type AIProviderResponse } from "./types.js";

export class GeminiProvider implements AIProvider {
  readonly provider = "gemini" as const;
  readonly model: string;
  private readonly apiKey: string;

  constructor(config?: { apiKey?: string; model?: string }) {
    this.apiKey = config?.apiKey || process.env.GEMINI_API_KEY || "";
    this.model = config?.model || process.env.GEMINI_MODEL || "gemini-2.5-pro";
  }

  isConfigured() { return Boolean(this.apiKey); }

  async chat(messages: AIMessage[]): Promise<AIProviderResponse> {
    if (!this.apiKey) throw new Error("GEMINI_API_KEY não configurada");

    const system = messages.find(m => m.role === "system")?.content || "";
    const parts = messages
      .filter(m => m.role !== "system")
      .map(m => ({ role: m.role === "assistant" ? "model" : "user", parts: [{ text: m.content }] }));

    const url = `https://generativelanguage.googleapis.com/v1beta/models/${this.model}:generateContent?key=${this.apiKey}`;
    const body: Record<string, unknown> = { contents: parts };
    if (system) body.systemInstruction = { parts: [{ text: system }] };

    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body)
    });

    if (!res.ok) {
      const err = await res.text().catch(() => res.statusText);
      throw new Error(`Gemini retornou ${res.status}: ${err.slice(0, 200)}`);
    }

    const data = await res.json() as { candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }> };
    const content = data.candidates?.[0]?.content?.parts?.map(p => p.text || "").join("") || "";

    return {
      provider: this.provider,
      model: this.model,
      content,
      inputTokens: estimateTokens(messages.map(m => m.content).join("\n")),
      outputTokens: estimateTokens(content)
    };
  }
}
