import { createRequire } from 'node:module';
import type { ITaskStorage } from './ITaskStorage.js';
import type { PushNotificationConfig, Task } from '../types/task.js';

interface SqliteStatement<TRow = unknown> {
  run(...params: unknown[]): unknown;
  get(...params: unknown[]): TRow | undefined;
  all(...params: unknown[]): TRow[];
}

interface SqliteDatabase {
  exec(sql: string): void;
  prepare<TRow = unknown>(sql: string): SqliteStatement<TRow>;
  close?(): void;
}

interface SqliteDatabaseConstructor {
  new (path: string): SqliteDatabase;
}

interface TaskRow {
  task_json: string;
}

interface PushNotificationRow {
  config_json: string;
}

function parseTask(row: TaskRow | undefined): Task | undefined {
  return row ? (JSON.parse(row.task_json) as Task) : undefined;
}

function parsePushNotification(
  row: PushNotificationRow | undefined,
): PushNotificationConfig | undefined {
  return row ? (JSON.parse(row.config_json) as PushNotificationConfig) : undefined;
}

export class SqliteTaskStorage implements ITaskStorage {
  private readonly db: SqliteDatabase;

  constructor(path: string) {
    const require = createRequire(import.meta.url);
    const imported = require('better-sqlite3') as
      | SqliteDatabaseConstructor
      | { default: SqliteDatabaseConstructor };
    const Database = 'default' in imported ? imported.default : imported;

    this.db = new Database(path);
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS tasks (
        id TEXT PRIMARY KEY,
        context_id TEXT,
        task_json TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS push_notifications (
        task_id TEXT PRIMARY KEY,
        config_json TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_tasks_context_id ON tasks(context_id);
    `);
  }

  insertTask(task: Task): Task {
    this.db
      .prepare('INSERT INTO tasks (id, context_id, task_json) VALUES (?, ?, ?)')
      .run(task.id, task.contextId ?? null, JSON.stringify(task));
    return structuredClone(task);
  }

  getTask(taskId: string): Task | undefined {
    return parseTask(
      this.db.prepare<TaskRow>('SELECT task_json FROM tasks WHERE id = ?').get(taskId),
    );
  }

  saveTask(task: Task): void {
    this.db
      .prepare('UPDATE tasks SET context_id = ?, task_json = ? WHERE id = ?')
      .run(task.contextId ?? null, JSON.stringify(task), task.id);
  }

  getAllTasks(): Task[] {
    return this.db
      .prepare<TaskRow>('SELECT task_json FROM tasks ORDER BY id')
      .all()
      .map((row) => JSON.parse(row.task_json) as Task);
  }

  getTasksByContextId(contextId: string): Task[] {
    return this.db
      .prepare<TaskRow>('SELECT task_json FROM tasks WHERE context_id = ? ORDER BY id')
      .all(contextId)
      .map((row) => JSON.parse(row.task_json) as Task);
  }

  setPushNotification(
    taskId: string,
    config: PushNotificationConfig,
  ): PushNotificationConfig | undefined {
    if (!this.getTask(taskId)) {
      return undefined;
    }

    this.db
      .prepare(
        'INSERT INTO push_notifications (task_id, config_json) VALUES (?, ?) ON CONFLICT(task_id) DO UPDATE SET config_json = excluded.config_json',
      )
      .run(taskId, JSON.stringify(config));

    return structuredClone(config);
  }

  getPushNotification(taskId: string): PushNotificationConfig | undefined {
    return parsePushNotification(
      this.db
        .prepare<PushNotificationRow>(
          'SELECT config_json FROM push_notifications WHERE task_id = ?',
        )
        .get(taskId),
    );
  }

  close(): void {
    this.db.close?.();
  }
}
