/**
 * @file TaskManager.ts
 * Task lifecycle manager backed by a pluggable storage engine.
 */

import { EventEmitter } from 'node:events';
import { randomUUID } from 'node:crypto';
import { InMemoryTaskStorage } from '../storage/InMemoryTaskStorage.js';
import type { ITaskStorage } from '../storage/ITaskStorage.js';
import type {
  ExtensibleArtifact,
  Message,
  PushNotificationConfig,
  Task,
  TaskCounts,
  TaskStatus,
} from '../types/task.js';

export type TaskUpdateReason = 'created' | 'message' | 'artifact' | 'state' | 'push-config';

export interface TaskUpdatedEvent {
  task: Task;
  reason: TaskUpdateReason;
}

export class TaskManager extends EventEmitter {
  constructor(private readonly storage: ITaskStorage = new InMemoryTaskStorage()) {
    super();
  }

  /**
   * Creates a new task and stores it in memory.
   *
   * @param sessionId Optional session identifier.
   * @param contextId Optional conversation context identifier.
   * @returns Newly created task.
   */
  createTask(sessionId?: string, contextId?: string): Task {
    const task: Task = {
      kind: 'task',
      id: randomUUID(),
      status: {
        state: 'submitted',
        timestamp: new Date().toISOString(),
      },
      history: [],
      artifacts: [],
      extensions: [],
      metadata: {},
      ...(sessionId ? { sessionId } : {}),
      ...(contextId ? { contextId } : {}),
    };

    const storedTask = this.storage.insertTask(task);
    this.emitTaskUpdated(storedTask, 'created');
    return storedTask;
  }

  getTask(taskId: string): Task | undefined {
    return this.storage.getTask(taskId);
  }

  getAllTasks(): Task[] {
    return this.storage.getAllTasks();
  }

  getTasksByContext(contextId: string): Task[] {
    return this.storage.getTasksByContextId(contextId);
  }

  getTasksByContextId(contextId: string): Task[] {
    return this.getTasksByContext(contextId);
  }

  addHistoryMessage(taskId: string, message: Message): Task | undefined {
    const task = this.storage.getTask(taskId);
    if (!task) {
      return undefined;
    }

    task.history.push({
      ...message,
      ...((message.contextId ?? task.contextId)
        ? { contextId: message.contextId ?? task.contextId }
        : {}),
    });
    this.storage.saveTask(task);
    this.emitTaskUpdated(task, 'message');
    return task;
  }

  addArtifact(taskId: string, artifact: ExtensibleArtifact): Task | undefined {
    const task = this.storage.getTask(taskId);
    if (!task) {
      return undefined;
    }

    const nextArtifact: ExtensibleArtifact = {
      ...artifact,
      ...((artifact.extensions ?? task.extensions)
        ? { extensions: artifact.extensions ?? task.extensions }
        : {}),
      metadata: {
        ...(artifact.metadata ?? {}),
        ...(task.contextId ? { contextId: task.contextId } : {}),
      },
    };
    task.artifacts = [...(task.artifacts ?? []), nextArtifact];
    this.storage.saveTask(task);
    this.emitTaskUpdated(task, 'artifact');
    return task;
  }

  updateTaskState(
    taskId: string,
    state: TaskStatus['state'],
    historyMessage?: Message,
    metadata?: Record<string, unknown>,
  ): Task | undefined {
    const task = this.storage.getTask(taskId);
    if (!task) {
      return undefined;
    }

    task.status = {
      state,
      timestamp: new Date().toISOString(),
      ...(typeof metadata?.message === 'string' ? { message: metadata.message } : {}),
    };
    if (historyMessage) {
      task.history.push({
        ...historyMessage,
        ...((historyMessage.contextId ?? task.contextId)
          ? { contextId: historyMessage.contextId ?? task.contextId }
          : {}),
      });
    }
    if (metadata) {
      task.metadata = { ...(task.metadata ?? {}), ...metadata };
    }
    this.storage.saveTask(task);
    this.emitTaskUpdated(task, 'state');
    return task;
  }

  cancelTask(taskId: string): Task | undefined {
    return this.updateTaskState(taskId, 'canceled');
  }

  setPushNotification(
    taskId: string,
    config: PushNotificationConfig,
  ): PushNotificationConfig | undefined {
    const task = this.storage.getTask(taskId);
    if (!task) {
      return undefined;
    }

    const storedConfig = this.storage.setPushNotification(taskId, config);
    this.emitTaskUpdated(task, 'push-config');
    return storedConfig;
  }

  getPushNotification(taskId: string): PushNotificationConfig | undefined {
    return this.storage.getPushNotification(taskId);
  }

  setTaskExtensions(taskId: string, extensions: string[]): Task | undefined {
    const task = this.storage.getTask(taskId);
    if (!task) {
      return undefined;
    }

    task.extensions = extensions;
    this.storage.saveTask(task);
    return task;
  }

  getTaskCounts(): TaskCounts {
    return this.storage.getAllTasks().reduce<TaskCounts>(
      (counts, task) => {
        counts.total += 1;
        switch (task.status.state) {
          case 'submitted':
            counts.submitted += 1;
            counts.active += 1;
            break;
          case 'working':
            counts.working += 1;
            counts.active += 1;
            break;
          case 'input-required':
            counts.inputRequired += 1;
            counts.active += 1;
            break;
          case 'completed':
            counts.completed += 1;
            break;
          case 'failed':
            counts.failed += 1;
            break;
          case 'canceled':
            counts.canceled += 1;
            break;
        }
        return counts;
      },
      {
        total: 0,
        active: 0,
        completed: 0,
        failed: 0,
        canceled: 0,
        submitted: 0,
        inputRequired: 0,
        working: 0,
      },
    );
  }

  private emitTaskUpdated(task: Task, reason: TaskUpdateReason): void {
    this.emit('taskUpdated', { task: structuredClone(task), reason } satisfies TaskUpdatedEvent);
  }
}
