import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { resolveNexusDataPath } from '../../nexus-data-dir.js';

const SETTINGS_PATH = resolveNexusDataPath('ai-settings.json');

export type AIMode = 'economy' | 'balanced' | 'premium' | 'manual';
export type ProviderName =
  | 'anthropic'
  | 'openai'
  | 'gemini'
  | 'groq'
  | 'openrouter'
  | 'ollama'
  | 'nexuslocal';

export interface ProviderConfig {
  enabled: boolean;
  apiKey?: string;
  baseUrl?: string;
  model: string;
}

export interface AISettings {
  mode: AIMode;
  provider: ProviderName | 'auto';
  premiumProvider: ProviderName;
  allowPremiumFallback: boolean;
  requirePremiumConfirmation: boolean;
  providers: Record<ProviderName, ProviderConfig>;
}

const DEFAULTS: AISettings = {
  mode: 'balanced',
  provider: 'auto',
  premiumProvider: 'anthropic',
  allowPremiumFallback: false,
  requirePremiumConfirmation: true,
  providers: {
    anthropic: { enabled: true, apiKey: '', model: 'claude-sonnet-4-20250514' },
    openai: { enabled: false, apiKey: '', model: 'gpt-4o-mini' },
    gemini: { enabled: false, apiKey: '', model: 'gemini-2.5-pro' },
    groq: { enabled: false, apiKey: '', model: 'llama-3.3-70b-versatile' },
    openrouter: { enabled: false, apiKey: '', model: 'anthropic/claude-sonnet-4' },
    ollama: { enabled: true, baseUrl: 'http://localhost:11434', model: 'qwen2.5-coder:7b' },
    nexuslocal: { enabled: false, baseUrl: 'http://127.0.0.1:5000', model: 'nexus-coder-tiny' },
  },
};

let cached: AISettings | null = null;

export function clearAISettingsCache() {
  cached = null;
}

export async function loadAISettings(forceReload = false): Promise<AISettings> {
  if (cached && !forceReload) return cached;
  try {
    const raw = await readFile(SETTINGS_PATH, 'utf8');
    const parsed = JSON.parse(raw) as Partial<AISettings>;
    cached = {
      ...DEFAULTS,
      ...parsed,
      providers: { ...DEFAULTS.providers, ...parsed.providers },
    };
    return cached;
  } catch {
    // Fall back to env vars
    const s: AISettings = JSON.parse(JSON.stringify(DEFAULTS));
    if (process.env.ANTHROPIC_API_KEY) s.providers.anthropic.apiKey = process.env.ANTHROPIC_API_KEY;
    if (process.env.ANTHROPIC_MODEL) s.providers.anthropic.model = process.env.ANTHROPIC_MODEL;
    if (process.env.OPENAI_API_KEY) {
      s.providers.openai.apiKey = process.env.OPENAI_API_KEY;
      s.providers.openai.enabled = true;
    }
    if (process.env.OPENAI_MODEL) s.providers.openai.model = process.env.OPENAI_MODEL;
    if (process.env.GEMINI_API_KEY) {
      s.providers.gemini.apiKey = process.env.GEMINI_API_KEY;
      s.providers.gemini.enabled = true;
    }
    if (process.env.GEMINI_MODEL) s.providers.gemini.model = process.env.GEMINI_MODEL;
    if (process.env.GROQ_API_KEY) {
      s.providers.groq.apiKey = process.env.GROQ_API_KEY;
      s.providers.groq.enabled = true;
    }
    if (process.env.GROQ_MODEL) s.providers.groq.model = process.env.GROQ_MODEL;
    if (process.env.OPENROUTER_API_KEY) {
      s.providers.openrouter.apiKey = process.env.OPENROUTER_API_KEY;
      s.providers.openrouter.enabled = true;
    }
    if (process.env.OPENROUTER_MODEL) s.providers.openrouter.model = process.env.OPENROUTER_MODEL;
    if (process.env.OLLAMA_BASE_URL) s.providers.ollama.baseUrl = process.env.OLLAMA_BASE_URL;
    if (process.env.OLLAMA_MODEL) s.providers.ollama.model = process.env.OLLAMA_MODEL;
    if (process.env.NEXUS_LOCAL_BASE_URL) {
      s.providers.nexuslocal.baseUrl = process.env.NEXUS_LOCAL_BASE_URL;
      s.providers.nexuslocal.enabled = true;
    }
    if (process.env.NEXUS_LOCAL_MODEL) s.providers.nexuslocal.model = process.env.NEXUS_LOCAL_MODEL;
    if (process.env.NEXUS_AI_MODE) s.mode = process.env.NEXUS_AI_MODE as AIMode;
    if (process.env.NEXUS_AI_PROVIDER)
      s.provider = process.env.NEXUS_AI_PROVIDER as ProviderName | 'auto';
    if (process.env.NEXUS_PREMIUM_PROVIDER)
      s.premiumProvider = process.env.NEXUS_PREMIUM_PROVIDER as ProviderName;
    if (process.env.NEXUS_ALLOW_PREMIUM_FALLBACK)
      s.allowPremiumFallback = process.env.NEXUS_ALLOW_PREMIUM_FALLBACK === 'true';
    if (process.env.NEXUS_REQUIRE_PREMIUM_CONFIRMATION)
      s.requirePremiumConfirmation = process.env.NEXUS_REQUIRE_PREMIUM_CONFIRMATION !== 'false';
    cached = s;
    return s;
  }
}

export async function saveAISettings(
  updates: Partial<AISettings> & {
    providers?: Partial<Record<ProviderName, Partial<ProviderConfig> & { clearKey?: boolean }>>;
  },
) {
  const current = await loadAISettings();
  const next: AISettings = { ...current };

  if (updates.mode) next.mode = updates.mode;
  if (updates.provider !== undefined) next.provider = updates.provider;
  if (updates.premiumProvider) next.premiumProvider = updates.premiumProvider;
  if (updates.allowPremiumFallback !== undefined)
    next.allowPremiumFallback = updates.allowPremiumFallback;
  if (updates.requirePremiumConfirmation !== undefined)
    next.requirePremiumConfirmation = updates.requirePremiumConfirmation;

  if (updates.providers) {
    for (const [name, cfg] of Object.entries(updates.providers) as [
      ProviderName,
      Partial<ProviderConfig> & { clearKey?: boolean },
    ][]) {
      const existing = next.providers[name] ?? { enabled: false, model: '', apiKey: '' };
      const merged = { ...existing };
      if (cfg.enabled !== undefined) merged.enabled = cfg.enabled;
      if (cfg.model) merged.model = cfg.model;
      if (cfg.baseUrl !== undefined) merged.baseUrl = cfg.baseUrl;
      if (cfg.clearKey) {
        merged.apiKey = '';
        merged.enabled = false;
      } else if (cfg.apiKey) {
        merged.apiKey = cfg.apiKey;
        merged.enabled = true;
      }
      if (cfg.baseUrl !== undefined) {
        merged.baseUrl = cfg.baseUrl;
        if (cfg.baseUrl) merged.enabled = true;
      }
      next.providers[name] = merged;
    }
  }

  await mkdir(path.dirname(SETTINGS_PATH), { recursive: true });
  await writeFile(SETTINGS_PATH, JSON.stringify(next, null, 2), 'utf8');
  clearAISettingsCache();
  cached = next;
  return next;
}

export function maskApiKey(key: string | undefined): string {
  if (!key || key.length < 8) return key ? '***' : '';
  return `${key.slice(0, 6)}...${key.slice(-4)}`;
}

export function hasProviderKey(cfg: ProviderConfig): boolean {
  if (cfg.baseUrl) return Boolean(cfg.baseUrl);
  return Boolean(cfg.apiKey);
}

export async function getProviderStatus(): Promise<
  Record<
    ProviderName,
    { configured: boolean; enabled: boolean; keyPreview: string; model: string; baseUrl?: string }
  >
> {
  const settings = await loadAISettings();
  const result = {} as Record<
    ProviderName,
    { configured: boolean; enabled: boolean; keyPreview: string; model: string; baseUrl?: string }
  >;
  for (const [name, cfg] of Object.entries(settings.providers) as [
    ProviderName,
    ProviderConfig,
  ][]) {
    result[name] = {
      configured: hasProviderKey(cfg),
      enabled: cfg.enabled,
      keyPreview: maskApiKey(cfg.apiKey),
      model: cfg.model,
      ...(cfg.baseUrl ? { baseUrl: cfg.baseUrl } : {}),
    };
  }
  return result;
}

export async function resolveProviderConfig(name: ProviderName): Promise<ProviderConfig> {
  const settings = await loadAISettings();
  return settings.providers[name] ?? DEFAULTS.providers[name];
}
