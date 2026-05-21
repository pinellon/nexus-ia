import { describe, expect, it } from "vitest";

import type { AISettings } from "../src/app/ai/ai-settings.js";
import { AIProviderRouter, type RouteChatInput } from "../src/app/ai/provider-router.js";

type RouterWithOrder = {
  buildProviderOrder(
    settings: AISettings,
    task: "simple" | "medium" | "complex",
    input: RouteChatInput
  ): string[];
};

function baseSettings(overrides: Partial<AISettings> = {}): AISettings {
  return {
    mode: "economy",
    provider: "auto",
    premiumProvider: "openai",
    allowPremiumFallback: false,
    requirePremiumConfirmation: false,
    providers: {
      anthropic: { enabled: true, apiKey: "anthropic-key", model: "claude-sonnet" },
      openai: { enabled: true, apiKey: "openai-key", model: "gpt-4o-mini" },
      gemini: { enabled: false, apiKey: "", model: "gemini-2.5-pro" },
      groq: { enabled: false, apiKey: "", model: "llama-3.3-70b-versatile" },
      openrouter: { enabled: false, apiKey: "", model: "anthropic/claude-sonnet-4" },
      ollama: { enabled: true, baseUrl: "http://localhost:11434", model: "qwen2.5-coder:7b" }
    },
    ...overrides
  };
}

const input: RouteChatInput = {
  messages: [{ role: "user", content: "corrija o erro do build" }],
  context: "",
  goal: "corrija o erro do build"
};

describe("AIProviderRouter provider order", () => {
  it("keeps economy mode local-only when premium fallback is disabled", () => {
    const router = new AIProviderRouter() as unknown as RouterWithOrder;
    const order = router.buildProviderOrder(baseSettings(), "medium", input);

    expect(order).toEqual(["ollama"]);
  });

  it("allows premium fallback in economy mode only when explicitly enabled", () => {
    const router = new AIProviderRouter() as unknown as RouterWithOrder;
    const order = router.buildProviderOrder(baseSettings({ allowPremiumFallback: true }), "medium", input);

    expect(order).toContain("ollama");
    expect(order).toContain("openai");
  });

  it("does not silently use cloud providers when economy mode has no local provider and fallback is disabled", () => {
    const router = new AIProviderRouter() as unknown as RouterWithOrder;
    const settings = baseSettings({
      providers: {
        ...baseSettings().providers,
        ollama: { enabled: false, baseUrl: "http://localhost:11434", model: "qwen2.5-coder:7b" }
      }
    });

    expect(router.buildProviderOrder(settings, "complex", input)).toEqual([]);
  });
});
