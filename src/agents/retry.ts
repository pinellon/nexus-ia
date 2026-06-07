/**
 * Retry com exponential backoff para chamadas de API.
 */

export interface RetryOptions {
  maxRetries?: number;
  baseDelayMs?: number;
  maxDelayMs?: number;
  retryableStatuses?: number[];
}

const DEFAULT_OPTIONS: Required<RetryOptions> = {
  maxRetries: 3,
  baseDelayMs: 1000,
  maxDelayMs: 15_000,
  retryableStatuses: [429, 500, 502, 503, 504],
};

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isRetryableError(error: unknown, statuses: number[]) {
  if (error instanceof Error) {
    const message = error.message.toLowerCase();
    if (
      message.includes('timeout') ||
      message.includes('econnreset') ||
      message.includes('econnrefused') ||
      message.includes('network') ||
      message.includes('abort')
    ) {
      return true;
    }

    // Check for HTTP status codes in error messages
    for (const status of statuses) {
      if (message.includes(String(status))) {
        return true;
      }
    }
  }

  return false;
}

export async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  options: RetryOptions = {},
): Promise<T> {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  let lastError: unknown;

  for (let attempt = 0; attempt <= opts.maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;

      if (attempt === opts.maxRetries || !isRetryableError(error, opts.retryableStatuses)) {
        throw error;
      }

      const delay = Math.min(opts.baseDelayMs * Math.pow(2, attempt), opts.maxDelayMs);
      const jitter = delay * (0.5 + Math.random() * 0.5);
      await sleep(jitter);
    }
  }

  throw lastError;
}

/**
 * Timeout padrão para chamadas fetch de agentes (30s).
 */
export const AGENT_FETCH_TIMEOUT_MS = 30_000;

/**
 * Timeout para chamadas de pesquisa/research (15s).
 */
export const RESEARCH_FETCH_TIMEOUT_MS = 15_000;
