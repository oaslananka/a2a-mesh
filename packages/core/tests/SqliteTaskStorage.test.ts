import { createRequire } from 'node:module';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { SqliteTaskStorage } from '../src/storage/SqliteTaskStorage.js';
import type { Task } from '../src/types/task.js';

interface SqliteProbeDatabase {
  close?(): void;
}

interface SqliteProbeDatabaseConstructor {
  new (path: string): SqliteProbeDatabase;
}

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

function getSqliteAvailability(): { available: boolean; reason?: string } {
  try {
    const require = createRequire(import.meta.url);
    const imported = require('better-sqlite3') as
      | SqliteProbeDatabaseConstructor
      | { default: SqliteProbeDatabaseConstructor };
    const Database = 'default' in imported ? imported.default : imported;
    const db = new Database(':memory:');
    db.close?.();
    return { available: true };
  } catch (error) {
    if (error instanceof Error) {
      const message = error.message;
      if (
        message.includes('better_sqlite3.node') ||
        message.includes('NODE_MODULE_VERSION') ||
        message.includes('Please try re-compiling or re-installing the module')
      ) {
        return {
          available: false,
          reason: 'better-sqlite3 native module needs rebuild for the current Node.js version',
        };
      }
    }

    throw error;
  }
}

describe('SqliteTaskStorage', () => {
  const tempDirs: string[] = [];
  const storages: SqliteTaskStorage[] = [];
  const sqliteAvailability = getSqliteAvailability();

  afterEach(async () => {
    for (const storage of storages) {
      storage.close();
    }
    storages.length = 0;

    await Promise.all(
      tempDirs.map((dir) =>
        rm(dir, {
          recursive: true,
          force: true,
        }),
      ),
    );
    tempDirs.length = 0;
  });

  const sqliteIt = sqliteAvailability.available ? it : it.skip;

  sqliteIt(
    sqliteAvailability.available
      ? 'persists tasks, context lookups and push notification configuration'
      : `persists tasks, context lookups and push notification configuration (${sqliteAvailability.reason})`,
    async () => {
      const tempDir = await mkdtemp(join(tmpdir(), 'a2a-sqlite-storage-'));
      tempDirs.push(tempDir);

      const storage = new SqliteTaskStorage(join(tempDir, 'tasks.db'));
      storages.push(storage);
      const inserted = storage.insertTask(createTask('task-1', 'ctx-1'));

      inserted.metadata = { mutated: true };
      expect(storage.getTask('task-1')?.metadata).toEqual({});
      expect(storage.getTask('missing')).toBeUndefined();

      const storedTask = storage.getTask('task-1');
      if (!storedTask) {
        throw new Error('Expected stored task to exist');
      }

      storedTask.contextId = 'ctx-2';
      storedTask.status.state = 'working';
      storage.saveTask(storedTask);

      expect(storage.getTasksByContextId('ctx-1')).toEqual([]);
      expect(storage.getTasksByContextId('ctx-2')).toHaveLength(1);
      expect(storage.getAllTasks()).toEqual([
        expect.objectContaining({
          id: 'task-1',
          contextId: 'ctx-2',
          status: expect.objectContaining({ state: 'working' }),
        }),
      ]);

      expect(
        storage.setPushNotification('missing', { url: 'https://example.com/missing' }),
      ).toBeUndefined();

      const config = storage.setPushNotification('task-1', {
        url: 'https://example.com/hook',
        token: 'secret',
      });

      expect(config).toEqual({
        url: 'https://example.com/hook',
        token: 'secret',
      });
      expect(storage.getPushNotification('task-1')).toEqual(config);
      expect(storage.getPushNotification('missing')).toBeUndefined();
    },
  );
});
