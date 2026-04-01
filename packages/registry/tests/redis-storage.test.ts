import { describe, expect, it } from 'vitest';
import { RedisStorage } from '../src/storage/RedisStorage.js';

describe('RedisStorage', () => {
  it('persists and retrieves JSON records through a redis-like client', async () => {
    const values = new Map<string, string>();
    const storage = new RedisStorage({
      async get(key) {
        return values.get(key) ?? null;
      },
      async set(key, value) {
        values.set(key, value);
      },
      async del(key) {
        return values.delete(key) ? 1 : 0;
      },
      async keys(pattern) {
        const prefix = pattern.replace('*', '');
        return Array.from(values.keys()).filter((key) => key.startsWith(prefix));
      },
    });

    await storage.upsert({
      id: 'agent-1',
      url: 'http://agent-1',
      card: {
        protocolVersion: '1.0',
        name: 'Agent 1',
        description: 'desc',
        url: 'http://agent-1',
        version: '1.0',
      },
      status: 'healthy',
      tags: [],
      skills: ['Search'],
      registeredAt: new Date().toISOString(),
    });

    expect((await storage.getAll())).toHaveLength(1);
    expect((await storage.findBySkill('sea'))[0]?.id).toBe('agent-1');
  });

  it('updates statuses, ignores missing agents and reports failed deletes', async () => {
    const values = new Map<string, string>();
    const storage = new RedisStorage({
      async get(key) {
        return values.get(key) ?? null;
      },
      async set(key, value) {
        values.set(key, value);
      },
      async del(key) {
        return values.delete(key) ? 1 : 0;
      },
      async keys(pattern) {
        const prefix = pattern.replace('*', '');
        return Array.from(values.keys()).filter((key) => key.startsWith(prefix));
      },
    });

    await storage.upsert({
      id: 'agent-1',
      url: 'http://agent-1',
      card: {
        protocolVersion: '1.0',
        name: 'Agent 1',
        description: 'desc',
        url: 'http://agent-1',
        version: '1.0',
      },
      status: 'unknown',
      tags: [],
      skills: [],
      registeredAt: new Date().toISOString(),
    });

    await storage.updateStatus('agent-1', 'healthy');
    await storage.updateStatus('missing', 'unhealthy');

    expect((await storage.get('agent-1'))?.status).toBe('healthy');
    expect(await storage.delete('missing')).toBe(false);
  });
});
