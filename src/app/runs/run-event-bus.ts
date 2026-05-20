import type { AgentEvent } from "../agents/models.js";

export type RunEventListener = (event: AgentEvent) => void;

export class RunEventBus {
  private readonly listeners = new Map<string, Set<RunEventListener>>();
  private readonly recentEvents = new Map<string, AgentEvent[]>();
  private readonly maxRecentEvents: number;

  constructor(maxRecentEvents = 200) {
    this.maxRecentEvents = maxRecentEvents;
  }

  subscribe(runId: string, listener: RunEventListener) {
    const listeners = this.listeners.get(runId) ?? new Set<RunEventListener>();
    listeners.add(listener);
    this.listeners.set(runId, listeners);

    return () => this.unsubscribe(runId, listener);
  }

  unsubscribe(runId: string, listener: RunEventListener) {
    const listeners = this.listeners.get(runId);
    if (!listeners) return;

    listeners.delete(listener);
    if (!listeners.size) {
      this.listeners.delete(runId);
    }
  }

  publish(runId: string, event: AgentEvent) {
    const recent = this.recentEvents.get(runId) ?? [];
    recent.push(event);
    this.recentEvents.set(runId, recent.slice(-this.maxRecentEvents));

    const listeners = this.listeners.get(runId);
    if (!listeners) return;

    for (const listener of [...listeners]) {
      listener(event);
    }
  }

  getRecentEvents(runId: string) {
    return [...(this.recentEvents.get(runId) ?? [])];
  }
}

export const runEventBus = new RunEventBus();
