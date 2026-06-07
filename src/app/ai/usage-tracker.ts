import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { resolveNexusDataPath } from '../../nexus-data-dir.js';

export interface AIUsageEntry {
  provider: string;
  model: string;
  input_tokens: number;
  output_tokens: number;
  estimated_cost_usd: number;
  estimated_cost_brl: number;
  created_at: string;
  task_type: string;
}

interface UsageDatabase {
  entries: AIUsageEntry[];
}

const usageDir = resolveNexusDataPath('usage');
const usageFile = path.join(usageDir, 'ai-usage.json');
const USD_TO_BRL = Number(process.env.NEXUS_USD_TO_BRL || 5);
const EMPTY_DB: UsageDatabase = { entries: [] };

function nowIso() {
  return new Date().toISOString();
}

function getRate(provider: string) {
  if (provider === 'anthropic' || provider === 'openrouter') {
    return { input: 3, output: 15 };
  }
  if (provider === 'openai') {
    return { input: 5, output: 15 };
  }
  if (provider === 'gemini') {
    return { input: 1.25, output: 5 };
  }
  if (provider === 'groq') {
    return { input: 0.27, output: 0.27 };
  }
  return { input: 0, output: 0 };
}

async function ensureStore() {
  await mkdir(usageDir, { recursive: true });
  try {
    await readFile(usageFile, 'utf8');
  } catch {
    await writeFile(usageFile, JSON.stringify(EMPTY_DB, null, 2), 'utf8');
  }
}

async function readDb(): Promise<UsageDatabase> {
  await ensureStore();
  try {
    const raw = await readFile(usageFile, 'utf8');
    const parsed = JSON.parse(raw) as UsageDatabase;
    return { entries: Array.isArray(parsed.entries) ? parsed.entries : [] };
  } catch {
    return EMPTY_DB;
  }
}

async function writeDb(db: UsageDatabase) {
  await ensureStore();
  await writeFile(usageFile, JSON.stringify(db, null, 2), 'utf8');
}

export class UsageTracker {
  async recordUsage(input: {
    provider: string;
    model: string;
    inputTokens: number;
    outputTokens: number;
    taskType: string;
  }) {
    const rates = getRate(input.provider);
    const estimatedUsd =
      (input.inputTokens / 1_000_000) * rates.input +
      (input.outputTokens / 1_000_000) * rates.output;
    const entry: AIUsageEntry = {
      provider: input.provider,
      model: input.model,
      input_tokens: input.inputTokens,
      output_tokens: input.outputTokens,
      estimated_cost_usd: Number(estimatedUsd.toFixed(6)),
      estimated_cost_brl: Number((estimatedUsd * USD_TO_BRL).toFixed(4)),
      created_at: nowIso(),
      task_type: input.taskType,
    };
    const db = await readDb();
    db.entries.push(entry);
    await writeDb(db);
    return entry;
  }

  async getMonthlyUsage(now = new Date()) {
    const db = await readDb();
    const currentMonth = now.toISOString().slice(0, 7);
    const entries = db.entries.filter((entry) => entry.created_at.startsWith(currentMonth));
    const premiumEntries = entries.filter(
      (entry) => entry.provider !== 'ollama' && entry.provider !== 'nexuslocal',
    );
    const localEntries = entries.filter(
      (entry) => entry.provider === 'ollama' || entry.provider === 'nexuslocal',
    );
    const estimatedCostUsd = entries.reduce((sum, entry) => sum + entry.estimated_cost_usd, 0);
    const estimatedCostBrl = entries.reduce((sum, entry) => sum + entry.estimated_cost_brl, 0);

    return {
      month: currentMonth,
      calls: entries.length,
      premium_calls: premiumEntries.length,
      local_calls: localEntries.length,
      estimated_cost_usd: Number(estimatedCostUsd.toFixed(6)),
      estimated_cost_brl: Number(estimatedCostBrl.toFixed(4)),
      budget_brl: Number(process.env.NEXUS_MONTHLY_API_BUDGET_BRL || 20),
      entries: entries.slice(-20).reverse(),
    };
  }
}
