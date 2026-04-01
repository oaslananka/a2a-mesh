import type { ITaskStorage } from './ITaskStorage.js';
import type { PushNotificationConfig, Task } from '../types/task.js';

export class InMemoryTaskStorage implements ITaskStorage {
  private readonly tasks = new Map<string, Task>();
  private readonly contextIndex = new Map<string, Set<string>>();
  private readonly pushNotifications = new Map<string, PushNotificationConfig>();

  insertTask(task: Task): Task {
    const storedTask = structuredClone(task);
    this.tasks.set(storedTask.id, storedTask);
    this.syncContextIndex(undefined, storedTask.contextId, storedTask.id);
    return structuredClone(storedTask);
  }

  getTask(taskId: string): Task | undefined {
    const task = this.tasks.get(taskId);
    return task ? structuredClone(task) : undefined;
  }

  saveTask(task: Task): void {
    const previousTask = this.tasks.get(task.id);
    const storedTask = structuredClone(task);
    this.tasks.set(task.id, storedTask);
    this.syncContextIndex(previousTask?.contextId, storedTask.contextId, storedTask.id);
  }

  getAllTasks(): Task[] {
    return Array.from(this.tasks.values(), (task) => structuredClone(task));
  }

  getTasksByContextId(contextId: string): Task[] {
    const ids = this.contextIndex.get(contextId);
    if (!ids) {
      return [];
    }

    return Array.from(ids)
      .map((taskId) => this.tasks.get(taskId))
      .filter((task): task is Task => task !== undefined)
      .map((task) => structuredClone(task));
  }

  setPushNotification(
    taskId: string,
    config: PushNotificationConfig,
  ): PushNotificationConfig | undefined {
    if (!this.tasks.has(taskId)) {
      return undefined;
    }

    const storedConfig = structuredClone(config);
    this.pushNotifications.set(taskId, storedConfig);
    return structuredClone(storedConfig);
  }

  getPushNotification(taskId: string): PushNotificationConfig | undefined {
    const config = this.pushNotifications.get(taskId);
    return config ? structuredClone(config) : undefined;
  }

  private syncContextIndex(
    previousContextId: string | undefined,
    nextContextId: string | undefined,
    taskId: string,
  ): void {
    if (previousContextId && previousContextId !== nextContextId) {
      const previousIds = this.contextIndex.get(previousContextId);
      previousIds?.delete(taskId);
      if (previousIds?.size === 0) {
        this.contextIndex.delete(previousContextId);
      }
    }

    if (!nextContextId) {
      return;
    }

    const nextIds = this.contextIndex.get(nextContextId) ?? new Set<string>();
    nextIds.add(taskId);
    this.contextIndex.set(nextContextId, nextIds);
  }
}
