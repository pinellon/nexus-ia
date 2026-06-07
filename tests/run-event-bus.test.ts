import { describe, expect, it } from 'vitest';

import type { AgentEvent } from '../src/app/agents/models.js';
import { RunEventBus } from '../src/app/runs/run-event-bus.js';

function event(overrides: Partial<AgentEvent> = {}): AgentEvent {
  return {
    id: overrides.id ?? 'event-1',
    runId: overrides.runId ?? 'run-1',
    type: overrides.type ?? 'planning',
    message: overrides.message ?? 'Planning',
    level: overrides.level ?? 'info',
    createdAt: overrides.createdAt ?? new Date().toISOString(),
    payload: overrides.payload,
  };
}

describe('RunEventBus', () => {
  it('delivers published events to subscribers', () => {
    const bus = new RunEventBus();
    const received: AgentEvent[] = [];
    bus.subscribe('run-1', (item) => received.push(item));

    const item = event({ message: 'Planejando solucao' });
    bus.publish('run-1', item);

    expect(received).toEqual([item]);
    expect(bus.getRecentEvents('run-1')).toEqual([item]);
  });

  it('unsubscribes listeners safely', () => {
    const bus = new RunEventBus();
    const received: AgentEvent[] = [];
    const unsubscribe = bus.subscribe('run-1', (item) => received.push(item));

    unsubscribe();
    bus.publish('run-1', event({ id: 'event-after-unsubscribe' }));

    expect(received).toEqual([]);
  });
});
