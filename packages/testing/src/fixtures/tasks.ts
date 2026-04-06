import { randomUUID } from 'node:crypto';
import type { Message, Task } from 'a2a-mesh';

export function createTestMessage(text = 'hello', contextId?: string): Message {
  return {
    role: 'user',
    parts: [{ type: 'text', text }],
    messageId: randomUUID(),
    timestamp: new Date().toISOString(),
    ...(contextId ? { contextId } : {}),
  };
}

export function createTestTask(overrides: Partial<Task> = {}): Task {
  return {
    kind: 'task',
    id: randomUUID(),
    status: {
      state: 'submitted',
      timestamp: new Date().toISOString(),
    },
    history: [],
    artifacts: [],
    metadata: {},
    extensions: [],
    ...overrides,
  };
}
