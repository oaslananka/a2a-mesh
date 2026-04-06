import type { PushNotificationConfig, Task } from '../types/task.js';

export interface ITaskStorage {
  insertTask(task: Task): Task;
  getTask(taskId: string): Task | undefined;
  saveTask(task: Task): void;
  getAllTasks(): Task[];
  getTasksByContextId(contextId: string): Task[];
  setPushNotification(
    taskId: string,
    config: PushNotificationConfig,
  ): PushNotificationConfig | undefined;
  getPushNotification(taskId: string): PushNotificationConfig | undefined;
}
