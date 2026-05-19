export interface AIMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface AIProviderResponse {
  provider: string;
  model: string;
  content: string;
  inputTokens: number;
  outputTokens: number;
}

export interface AIProvider {
  readonly provider: string;
  readonly model: string;
  isConfigured(): boolean;
  chat(messages: AIMessage[]): Promise<AIProviderResponse>;
}

export function estimateTokens(value: string) {
  return Math.max(1, Math.ceil(value.length / 4));
}
