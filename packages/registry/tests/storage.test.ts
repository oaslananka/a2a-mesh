import { describe, expect, it } from 'vitest';
import { InMemoryStorage } from '../src/storage/InMemoryStorage.js';

describe('InMemoryStorage', () => {
  it('upserts and searches agents by skill name', async () => {
    const storage = new InMemoryStorage();
    await storage.upsert({
      id: 'agent-1',
      url: 'http://agent-1',
      card: {
        protocolVersion: '1.0',
        name: 'Agent 1',
        description: 'desc',
        url: 'http://agent-1',
        version: '1.0',
        skills: [{ id: 's1', name: 'Writer', description: 'writes content' }],
      },
      status: 'healthy',
      tags: [],
      skills: ['Writer'],
      registeredAt: new Date().toISOString(),
    });

    const matches = await storage.findBySkill('wri');
    expect(matches).toHaveLength(1);
  });

  it('updates status and returns nullish results for missing agents', async () => {
    const storage = new InMemoryStorage();
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

    await storage.updateStatus('agent-1', 'unhealthy');
    await storage.updateStatus('missing', 'healthy');

    expect((await storage.get('agent-1'))?.status).toBe('unhealthy');
    expect(await storage.get('missing')).toBeNull();
    expect(await storage.delete('missing')).toBe(false);
  });
});
