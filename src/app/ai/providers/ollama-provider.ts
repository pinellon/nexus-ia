export interface AIMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface AIProviderResponse {
  provider: "ollama" | "anthropic" | "openai";
  model: string;
  content: string;
  inputTokens: number;
  outputTokens: number;
}

function estimateTokens(value: string) {
  return Math.max(1, Math.ceil(value.length / 4));
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Falha desconhecida";
}

export class OllamaProvider {
  readonly provider = "ollama" as const;
  readonly baseUrl: string;
  readonly model: string;

  constructor(config?: { baseUrl?: string; model?: string }) {
    this.baseUrl = (config?.baseUrl || process.env.OLLAMA_BASE_URL || "http://localhost:11434").replace(/\/$/, "");
    this.model = config?.model || process.env.OLLAMA_MODEL || "qwen2.5-coder:7b";
  }

  isConfigured() {
    return Boolean(this.baseUrl && this.model);
  }

  async isReachable() {
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 1800);
      const response = await fetch(`${this.baseUrl}/api/tags`, {
        signal: controller.signal
      });
      clearTimeout(timer);
      return response.ok;
    } catch {
      return false;
    }
  }

  async chat(messages: AIMessage[]): Promise<AIProviderResponse> {
    try {
      const response = await fetch(`${this.baseUrl}/api/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: this.model,
          stream: false,
          messages
        })
      });

      if (!response.ok) {
        throw new Error(`Ollama retornou ${response.status}`);
      }

      const data = (await response.json()) as {
        message?: { content?: string };
        prompt_eval_count?: number;
        eval_count?: number;
      };
      const content = data.message?.content || "";

      return {
        provider: this.provider,
        model: this.model,
        content,
        inputTokens: data.prompt_eval_count ?? estimateTokens(messages.map((message) => message.content).join("\n")),
        outputTokens: data.eval_count ?? estimateTokens(content)
      };
    } catch (error) {
      throw new Error(`Ollama nao esta ativo. Inicie o Ollama ou use IA premium. Detalhe: ${getErrorMessage(error)}`);
    }
  }
}
