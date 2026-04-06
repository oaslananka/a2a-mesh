import { describe, expect, it } from 'vitest';
import { TaskManager } from '../src/server/TaskManager.js';

describe('contextId propagation', () => {
  it('applies message context to stored history', () => {
    const manager = new TaskManager();
    const task = manager.createTask(undefined, 'ctx-123');
    manager.addHistoryMessage(task.id, {
      role: 'user',
      messageId: 'msg-1',
      timestamp: new Date().toISOString(),
      parts: [{ type: 'text', text: 'hello' }],
    });

    const stored = manager.getTask(task.id);
    expect(stored?.history[0]?.contextId).toBe('ctx-123');
  });
});
