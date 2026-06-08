import { loadAISettings, resolveProviderConfig, type AISettings, type ProviderName } from "./ai-settings.js";
import { AnthropicProvider } from "./providers/anthropic-provider.js";
import { GeminiProvider } from "./providers/gemini-provider.js";
import { GroqProvider, OpenRouterProvider } from "./providers/groq-openrouter-provider.js";
import { OllamaProvider } from "./providers/ollama-provider.js";
import { OpenAIProvider } from "./providers/openai-provider.js";
import type { AIMessage, AIProvider, AIProviderResponse } from "./providers/types.js";
import { UsageTracker } from "./usage-tracker.js";

export type { AIMessage };
export type { AIProviderResponse };

export type AIMode = AISettings["mode"];
export type AIProviderName = ProviderName | "auto";

export interface RouteChatInput {
  messages: AIMessage[];
  context: string;
  goal: string;
  allowPremium?: boolean;
  forceLocal?: boolean;
}

export interface RouteChatResult {
  ok: boolean;
  mode: AIMode;
  provider: string;
  model: string | null;
  task_type: "simple" | "medium" | "complex";
  message: string;
  response: string;
  requires_premium_confirmation: boolean;
  usedFallback?: boolean;
  fallbackReason?: string;
  warning?: string;
  usage?: unknown;
}

export type ProviderMode = "real" | "mock" | "fallback" | "unavailable";

export interface ProviderHealth {
  ok: boolean;
  provider_mode: ProviderMode;
  model_available: boolean;
  fallback_available: boolean;
  notes: string[];
  active_provider: string;
  configured_providers: string[];
  reachable_local_model: boolean;
}

// ── Task classification ────────────────────────────────────────────────────
function classifyTask(goal: string): "simple" | "medium" | "complex" {
  const g = goal.toLowerCase();
  if (/(site inteiro|landing page completa|refatora[çc][aã]o grande|m[uú]ltiplos arquivos|autenti[cs]|seguran[cç]|vuln|crie um app|dashboard completo|refactor)/.test(g))
    return "complex";
  if (/(criar tela|criar componente|corrigir erro|criar api|backend|patch|feature|landing|alterar arquivo)/.test(g))
    return "medium";
  return "simple";
}

function getLatestUserMessage(messages: AIMessage[]) {
  return [...messages].reverse().find(m => m.role === "user")?.content ?? "";
}

// ── Provider factory ───────────────────────────────────────────────────────
async function buildProvider(name: ProviderName): Promise<AIProvider> {
  const cfg = await resolveProviderConfig(name);
  switch (name) {
    case "anthropic":  return new AnthropicProvider({ apiKey: cfg.apiKey, model: cfg.model });
    case "openai":     return new OpenAIProvider({ apiKey: cfg.apiKey, model: cfg.model });
    case "gemini":     return new GeminiProvider({ apiKey: cfg.apiKey, model: cfg.model });
    case "groq":       return new GroqProvider({ apiKey: cfg.apiKey, model: cfg.model });
    case "openrouter": return new OpenRouterProvider({ apiKey: cfg.apiKey, model: cfg.model });
    case "ollama":     return new OllamaProvider({ baseUrl: cfg.baseUrl, model: cfg.model });
  }
}

// ── Router ─────────────────────────────────────────────────────────────────
export class AIProviderRouter {
  private settings: AISettings | null = null;
  private readonly usage = new UsageTracker();

  private async getSettings() {
    if (!this.settings) this.settings = await loadAISettings();
    return this.settings;
  }

  async getStatus() {
    const s = await this.getSettings();
    const ollamaP = new OllamaProvider({ baseUrl: s.providers.ollama.baseUrl, model: s.providers.ollama.model });
    const reachable = await ollamaP.isReachable().catch(() => false);
    const usage = await this.usage.getMonthlyUsage().catch(() => ({}));

    return {
      mode: s.mode,
      provider: s.provider,
      premium_provider: s.premiumProvider,
      require_confirm_premium: s.requirePremiumConfirmation,
      providers: {
        anthropic:  { configured: Boolean(s.providers.anthropic.apiKey),  enabled: s.providers.anthropic.enabled,  model: s.providers.anthropic.model },
        openai:     { configured: Boolean(s.providers.openai.apiKey),     enabled: s.providers.openai.enabled,     model: s.providers.openai.model },
        gemini:     { configured: Boolean(s.providers.gemini.apiKey),     enabled: s.providers.gemini.enabled,     model: s.providers.gemini.model },
        groq:       { configured: Boolean(s.providers.groq.apiKey),       enabled: s.providers.groq.enabled,       model: s.providers.groq.model },
        openrouter: { configured: Boolean(s.providers.openrouter.apiKey), enabled: s.providers.openrouter.enabled, model: s.providers.openrouter.model },
        ollama:     { configured: true, reachable, enabled: s.providers.ollama.enabled,
          model: s.providers.ollama.model, base_url: s.providers.ollama.baseUrl }
      },
      usage
    };
  }

  async getHealth(): Promise<ProviderHealth> {
    const status = await this.getStatus();
    const providers = status.providers;
    const configuredProviders = Object.entries(providers)
      .filter(([, provider]) => provider.enabled && provider.configured)
      .map(([name]) => name);
    const cloudProviders = configuredProviders.filter((name) => name !== "ollama");
    const reachableLocalModel = Boolean(providers.ollama.enabled && providers.ollama.reachable);
    const modelAvailable = cloudProviders.length > 0 || reachableLocalModel;
    const fallbackAvailable = true;
    const notes: string[] = [];

    if (cloudProviders.length > 0) {
      notes.push(`Configured cloud provider(s): ${cloudProviders.join(", ")}.`);
    }
    if (reachableLocalModel) {
      notes.push(`Local Ollama model reachable: ${providers.ollama.model}.`);
    } else if (providers.ollama.enabled) {
      notes.push(`Local Ollama model configured but not reachable: ${providers.ollama.model}.`);
    }
    if (!modelAvailable && fallbackAvailable) {
      notes.push("No direct model is available; Nexus will rely on controlled deterministic fallback paths.");
    }
    if (status.mode === "manual" && status.provider !== "auto" && !configuredProviders.includes(status.provider)) {
      notes.push(`Manual provider is selected but unavailable: ${status.provider}.`);
    }

    return {
      ok: modelAvailable || fallbackAvailable,
      provider_mode: modelAvailable ? "real" : fallbackAvailable ? "fallback" : "unavailable",
      model_available: modelAvailable,
      fallback_available: fallbackAvailable,
      notes,
      active_provider: status.provider,
      configured_providers: configuredProviders,
      reachable_local_model: reachableLocalModel
    };
  }

  async routeChatRequest(input: RouteChatInput): Promise<RouteChatResult> {
    const s = await this.getSettings();
    const goal = input.goal || getLatestUserMessage(input.messages);
    const taskType = classifyTask(goal);

    // Build priority list based on mode
    const order = this.buildProviderOrder(s, taskType, input);

    // Check if requires premium confirmation
    if (s.requirePremiumConfirmation && !input.allowPremium && !input.forceLocal) {
      const firstPremium = order.find(p => p !== "ollama");
      if (firstPremium && order[0] !== "ollama") {
        const prov = await buildProvider(firstPremium as ProviderName);
        return {
          ok: true,
          mode: s.mode,
          provider: firstPremium,
          model: prov.model,
          task_type: taskType,
          message: "Essa tarefa pode usar IA premium e consumir créditos. Deseja continuar?",
          response: "",
          requires_premium_confirmation: true
        };
      }
    }

    const messages = this.buildMessages(input);
    return this.tryInOrder(order as ProviderName[], messages, taskType, s.mode);
  }

  private buildProviderOrder(s: AISettings, task: "simple" | "medium" | "complex", input: RouteChatInput): string[] {
    if (input.forceLocal) return ["ollama"];
    if (s.mode === "manual" && s.provider !== "auto") return [s.provider];

    const premium = s.premiumProvider;
    const localFirst = ["ollama", premium];
    const premiumFirst = [premium, "ollama"];

    // Other configured premium providers as fallback
    const others = (["anthropic","openai","gemini","groq","openrouter"] as ProviderName[])
      .filter(p => p !== premium && s.providers[p].enabled && s.providers[p].apiKey);

    if (s.mode === "economy") {
      return s.allowPremiumFallback ? [...localFirst, ...others] : ["ollama"];
    }
    if (s.mode === "premium") {
      return [...premiumFirst, ...others];
    }
    // balanced
    if (task === "simple") return [...localFirst, ...others];
    return [...premiumFirst, ...others, "ollama"];
  }

  private async tryInOrder(
    order: ProviderName[],
    messages: AIMessage[],
    taskType: "simple" | "medium" | "complex",
    mode: AIMode
  ): Promise<RouteChatResult> {
    let lastError = "";
    for (let i = 0; i < order.length; i++) {
      const name = order[i];
      try {
        const prov = await buildProvider(name);
        if (!prov.isConfigured()) continue;
        const resp = await prov.chat(messages);
        const usage = await this.usage.recordUsage({
          provider: resp.provider, model: resp.model,
          inputTokens: resp.inputTokens, outputTokens: resp.outputTokens, taskType
        }).catch(() => undefined);

        const usedFallback = i > 0;
        return {
          ok: true, mode, provider: resp.provider, model: resp.model,
          task_type: taskType,
          message: resp.content || `Resposta de ${resp.provider}.`,
          response: resp.content,
          requires_premium_confirmation: false,
          usedFallback,
          fallbackReason: usedFallback ? `${order[0]} indisponível, usando ${name}.` : undefined,
          usage
        };
      } catch (err) {
        lastError = err instanceof Error ? err.message : String(err);
      }
    }

    return {
      ok: false, mode, provider: "none", model: null,
      task_type: taskType,
      message: this.buildNoProviderMessage(lastError),
      response: "",
      requires_premium_confirmation: false,
      warning: "Nenhum provider disponível"
    };
  }

  private buildNoProviderMessage(lastError: string): string {
    if (!lastError || lastError.includes("não configurada") || lastError.includes("nao configurada")) {
      return "Nenhuma IA configurada. Abra Configurações > IA para configurar um provider.";
    }
    return `Nenhum provider respondeu. Último erro: ${lastError.slice(0, 180)}`;
  }

  private buildMessages(input: RouteChatInput): AIMessage[] {
    const system = [
      "Você é o motor de raciocínio do Nexus Codex, um assistente de programação.",
      "Responda de forma clara e objetiva.",
      "Nunca diga que editou arquivos diretamente — mudanças passam por Patch Review.",
      input.context ? `\nContexto do projeto:\n${input.context}` : ""
    ].filter(Boolean).join("\n");

    return [
      { role: "system", content: system },
      ...input.messages.filter(m => m.role !== "system")
    ];
  }
}
