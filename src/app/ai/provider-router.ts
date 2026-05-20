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

const PREMIUM_FALLBACK_ORDER: ProviderName[] = [
  "openai",
  "groq",
  "anthropic",
  "openrouter",
  "gemini",
  "ollama"
];

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
    this.settings = await loadAISettings(true);
    return this.settings;
  }

  private async filterReachableOrder(order: ProviderName[]): Promise<ProviderName[]> {
    const filtered: ProviderName[] = [];
    let ollamaReachable: boolean | null = null;

    for (const name of order) {
      if (name !== "ollama") {
        filtered.push(name);
        continue;
      }
      if (ollamaReachable === null) {
        const s = await this.getSettings();
        const ollama = new OllamaProvider({
          baseUrl: s.providers.ollama.baseUrl,
          model: s.providers.ollama.model
        });
        ollamaReachable = await ollama.isReachable().catch(() => false);
      }
      if (ollamaReachable) filtered.push(name);
    }

    return filtered;
  }

  private configuredFallbackProviders(s: AISettings): ProviderName[] {
    return PREMIUM_FALLBACK_ORDER.filter(
      (name) => s.providers[name]?.enabled && Boolean(s.providers[name]?.apiKey)
    );
  }

  private sortProvidersByReliability(names: ProviderName[]): ProviderName[] {
    return [...names].sort(
      (a, b) => PREMIUM_FALLBACK_ORDER.indexOf(a) - PREMIUM_FALLBACK_ORDER.indexOf(b)
    );
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
    let resolvedOrder = await this.filterReachableOrder(order as ProviderName[]);

    if (!resolvedOrder.length) {
      resolvedOrder = this.configuredFallbackProviders(s);
    }

    const result = await this.tryInOrder(resolvedOrder, messages, taskType, s.mode);
    if (result.ok || resolvedOrder.length === 0) return result;

    const emergency = this.configuredFallbackProviders(s).filter((name) => !resolvedOrder.includes(name));
    if (!emergency.length) return result;

    const retry = await this.tryInOrder(emergency, messages, taskType, s.mode);
    if (!retry.ok) return result;
    return {
      ...retry,
      usedFallback: true,
      fallbackReason: `Providers locais indisponíveis. Usando ${retry.provider}.`
    };
  }

  private buildProviderOrder(s: AISettings, task: "simple" | "medium" | "complex", input: RouteChatInput): string[] {
    if (input.forceLocal) return ["ollama"];
    if (s.mode === "manual" && s.provider !== "auto") return [s.provider];

    const cloud = this.configuredFallbackProviders(s);
    const ollamaOn = s.providers.ollama.enabled;

    if (s.mode === "economy") {
      if (ollamaOn) {
        return s.allowPremiumFallback ? ["ollama", ...cloud] : ["ollama"];
      }
      return s.allowPremiumFallback ? cloud : [];
    }

    if (s.mode === "premium") {
      return ollamaOn ? [...cloud, "ollama"] : cloud;
    }

    // balanced: cloud first (openai before gemini), ollama last
    if (task === "simple" && ollamaOn) return ["ollama", ...cloud];
    return ollamaOn ? [...cloud, "ollama"] : cloud;
  }

  private async tryInOrder(
    order: ProviderName[],
    messages: AIMessage[],
    taskType: "simple" | "medium" | "complex",
    mode: AIMode
  ): Promise<RouteChatResult> {
    const failures: string[] = [];
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
        const msg = err instanceof Error ? err.message : String(err);
        failures.push(`${name}: ${msg}`);
      }
    }

    return {
      ok: false, mode, provider: "none", model: null,
      task_type: taskType,
      message: this.buildNoProviderMessage(failures),
      response: "",
      requires_premium_confirmation: false,
      warning: "Nenhum provider disponível"
    };
  }

  private buildNoProviderMessage(failures: string[]): string {
    const lastError = failures[failures.length - 1] || "";
    const joined = failures.map((f) => f.replace(/^(openai|gemini|anthropic|groq|openrouter|ollama): /, "")).join(" | ");

    if (failures.some((f) => /429|quota|rate limit|billing/i.test(f))) {
      return [
        "Quota ou limite de API esgotado (ex.: Gemini 429).",
        "Tentativas: " + failures.map((f) => f.split(":")[0]).join(", "),
        "Solucao: em Configuracoes > IA desative Gemini, use OpenAI (gpt-4o-mini) ou Groq (gratis), ou inicie Ollama local.",
        "Reinicie o servidor Nexus apos salvar."
      ].join(" ");
    }

    if (!lastError || lastError.includes("não configurada") || lastError.includes("nao configurada")) {
      return [
        "Nenhuma IA configurada.",
        "Abra Configurações (ícone engrenagem) > IA:",
        "• Inicie o Ollama (ollama serve) OU",
        "• Cole uma API key (OpenAI, Gemini, Anthropic…) e escolha modo Equilibrado/Premium.",
        "Reinicie o servidor Nexus após salvar."
      ].join(" ");
    }
    if (failures.some((f) => /ollama/i.test(f))) {
      return [
        "Ollama nao esta rodando e os providers na nuvem falharam.",
        "Opcoes: (1) ollama serve + ollama pull qwen2.5-coder:7b",
        "ou (2) corrija API key OpenAI em Configuracoes > IA (modelo gpt-4o-mini).",
        failures.length > 1 ? `Erros: ${joined.slice(0, 200)}` : ""
      ]
        .filter(Boolean)
        .join(" ");
    }

    if (failures.length > 1) {
      return `Nenhum provider respondeu. Tentativas: ${joined.slice(0, 280)}`;
    }

    const single = lastError.replace(/^[a-z]+: /i, "");
    return `Nenhum provider respondeu. Ultimo erro: ${single.slice(0, 180)}`;
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
