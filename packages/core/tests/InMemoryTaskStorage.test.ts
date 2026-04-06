import { describe, expect, it } from 'vitest';
import { InMemoryTaskStorage } from '../src/storage/InMemoryTaskStorage.js';
import type { Task } from '../src/types/task.js';

function createTask(id: string, contextId?: string): Task {
  return {
    kind: 'task',
    id,
    status: {
      state: 'submitted',
      timestamp: new Date().toISOString(),
    },
    history: [],
    artifacts: [],
    metadata: {},
    extensions: [],
    ...(contextId ? { contextId } : {}),
  };
}

describe('InMemoryTaskStorage', () => {
  it('stores tasks, syncs the context index and clones values', () => {
    const storage = new InMemoryTaskStorage();
    const inserted = storage.insertTask(createTask('task-1', 'ctx-1'));

    inserted.metadata = { mutated: true };
    expect(storage.getTask('task-1')?.metadata).toEqual({});

    const stored = storage.getTask('task-1');
    if (!stored) {
      throw new Error('Expected stored task to exist');
    }

    stored.contextId = 'ctx-2';
    storage.saveTask(stored);

    expect(storage.getTasksByContextId('ctx-1')).toEqual([]);
    expect(storage.getTasksByContextId('ctx-2')).toHaveLength(1);
    expect(storage.getAllTasks()).toHaveLength(1);
  });

  it('stores push notifications only for known tasks', () => {
    const storage = new InMemoryTaskStorage();

    expect(
      storage.setPushNotification('missing', { url: 'https://example.com/hook' }),
    ).toBeUndefined();

    storage.insertTask(createTask('task-1'));

    const config = storage.setPushNotification('task-1', {
      url: 'https://example.com/hook',
      token: 'secret',
    });

    expect(config).toEqual({
      url: 'https://example.com/hook',
      token: 'secret',
    });
    expect(storage.getPushNotification('task-1')).toEqual(config);
  });
});
