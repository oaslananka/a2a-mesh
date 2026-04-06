import { describe, expect, it } from 'vitest';
import { TaskManager } from '../src/server/TaskManager.js';

describe('TaskManager', () => {
  it('tracks tasks, lifecycle counts, artifacts, history and push notifications', () => {
    const manager = new TaskManager();
    const task = manager.createTask('session-1', 'context-1');
    const completedTask = manager.createTask(undefined, 'context-1');
    const failedTask = manager.createTask();
    const canceledTask = manager.createTask();
    const inputRequiredTask = manager.createTask();

    manager.setPushNotification(task.id, { url: 'https://example.com/hook', token: 'abc' });
    manager.setTaskExtensions(task.id, ['https://example.com/extensions/citations/v1']);
    manager.addHistoryMessage(task.id, {
      role: 'user',
      messageId: 'message-1',
      timestamp: new Date().toISOString(),
      parts: [{ type: 'text', text: 'hello' }],
    });
    manager.addArtifact(task.id, {
      artifactId: 'artifact-1',
      parts: [{ type: 'text', text: 'hello back' }],
      index: 0,
      lastChunk: true,
    });
    manager.updateTaskState(
      task.id,
      'working',
      {
        role: 'agent',
        messageId: 'message-2',
        timestamp: new Date().toISOString(),
        parts: [{ type: 'text', text: 'working' }],
      },
      {
        message: 'Processing started',
        jobId: 'job-1',
      },
    );
    manager.updateTaskState(completedTask.id, 'completed');
    manager.updateTaskState(failedTask.id, 'failed');
    manager.cancelTask(canceledTask.id);
    manager.updateTaskState(inputRequiredTask.id, 'input-required');

    expect(manager.getTasksByContextId('context-1')).toHaveLength(2);
    expect(manager.getTasksByContext('context-1')).toHaveLength(2);
    expect(manager.getAllTasks()).toHaveLength(5);
    expect(manager.getPushNotification(task.id)).toEqual({
      url: 'https://example.com/hook',
      token: 'abc',
    });

    const storedTask = manager.getTask(task.id);
    expect(storedTask?.history).toHaveLength(2);
    expect(storedTask?.history[0]?.contextId).toBe('context-1');
    expect(storedTask?.history[1]?.contextId).toBe('context-1');
    expect(storedTask?.artifacts?.[0]).toEqual(
      expect.objectContaining({
        extensions: ['https://example.com/extensions/citations/v1'],
        metadata: expect.objectContaining({
          contextId: 'context-1',
        }),
      }),
    );
    expect(storedTask?.status).toEqual(
      expect.objectContaining({
        state: 'working',
        message: 'Processing started',
      }),
    );
    expect(storedTask?.metadata).toEqual(
      expect.objectContaining({
        message: 'Processing started',
        jobId: 'job-1',
      }),
    );

    expect(manager.getTaskCounts()).toEqual({
      total: 5,
      active: 2,
      completed: 1,
      failed: 1,
      canceled: 1,
      submitted: 0,
      queued: 0,
      inputRequired: 1,
      waitingOnExternal: 0,
      working: 1,
    });
  });

  it('returns undefined for unknown tasks and missing push notification records', () => {
    const manager = new TaskManager();
    const message = {
      role: 'user' as const,
      messageId: 'missing-message',
      timestamp: new Date().toISOString(),
      parts: [{ type: 'text' as const, text: 'hello' }],
    };
    const artifact = {
      artifactId: 'missing-artifact',
      parts: [{ type: 'text' as const, text: 'nope' }],
      index: 0,
      lastChunk: true,
    };

    expect(manager.addHistoryMessage('missing', message)).toBeUndefined();
    expect(manager.addArtifact('missing', artifact)).toBeUndefined();
    expect(manager.updateTaskState('missing', 'failed')).toBeUndefined();
    expect(manager.cancelTask('missing')).toBeUndefined();
    expect(manager.setTaskExtensions('missing', ['urn:test'])).toBeUndefined();
    expect(
      manager.setPushNotification('missing', { url: 'https://example.com/hook' }),
    ).toBeUndefined();
    expect(manager.getPushNotification('missing')).toBeUndefined();
  });
});
