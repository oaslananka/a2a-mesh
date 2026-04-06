import { afterEach, describe, expect, it, vi } from 'vitest';
import { AgentRegistryClient } from 'a2a-mesh';
import { RegistryServer } from '../src/RegistryServer.js';
import { InMemoryStorage } from '../src/storage/InMemoryStorage.js';

describe('Registry Integration', () => {
  const handles: Array<{
    close: (cb: () => void) => void;
    closeAllConnections?: () => void;
  }> = [];

  afterEach(async () => {
    vi.restoreAllMocks();
    vi.useRealTimers();
    await Promise.all(
      handles.map(
        (handle) =>
          new Promise<void>((resolve) => {
            handle.closeAllConnections?.();
            handle.close(() => resolve());
          }),
      ),
    );
    handles.length = 0;
  });

  it('registers, searches, lists and manages agent records', async () => {
    const server = new RegistryServer();
    const listener = server.start(0);
    handles.push(listener);

    await new Promise((resolve) => setTimeout(resolve, 50));
    const port = (listener.address() as { port: number }).port;
    const baseUrl = `http://localhost:${port}`;
    const client = new AgentRegistryClient(baseUrl);

    await client.register('https://agent-1.com', {
      protocolVersion: '1.0',
      name: 'Agent 1',
      description: 'Desc',
      url: 'https://agent-1.com',
      version: '1.0',
      skills: [{ id: 's1', name: 'Web Search', description: 'desc', tags: ['search'] }],
    });

    await client.register('https://agent-2.com', {
      protocolVersion: '1.0',
      name: 'Agent 2',
      description: 'Desc',
      url: 'https://agent-2.com',
      version: '1.0',
      skills: [{ id: 's2', name: 'Writer', description: 'desc', tags: ['write'] }],
    });

    const all = await client.listAgents();
    expect(all).toHaveLength(2);

    const searches = await client.searchAgents('search');
    expect(searches).toHaveLength(1);
    expect(searches[0]?.url).toBe('https://agent-1.com');

    const health = await client.health();
    expect(health.status).toBe('ok');

    const metrics = await (await fetch(`${baseUrl}/metrics`)).text();
    expect(metrics).toContain('a2a_registry_agents');

    const agent = all[0] as { id: string };
    const details = await client.getAgent(agent.id);
    expect(details.id).toBe(agent.id);

    const heartbeat = await client.sendHeartbeat(agent.id);
    expect(heartbeat.status).toBe('healthy');

    const deletedResponse = await fetch(`${baseUrl}/agents/${agent.id}`, {
      method: 'DELETE',
    });
    expect(deletedResponse.status).toBe(204);

    server.stop();
  });

  it('returns validation and not-found responses and streams registry updates', async () => {
    const server = new RegistryServer();
    const listener = server.start(0);
    handles.push(listener);

    await new Promise((resolve) => setTimeout(resolve, 50));
    const port = (listener.address() as { port: number }).port;
    const baseUrl = `http://localhost:${port}`;
    const client = new AgentRegistryClient(baseUrl);
    const events = client.events();
    const firstEventPromise = events.next();

    const invalidRegister = await fetch(`${baseUrl}/agents/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });
    expect(invalidRegister.status).toBe(400);

    const invalidSearch = await fetch(`${baseUrl}/agents/search`);
    expect(invalidSearch.status).toBe(400);

    expect((await fetch(`${baseUrl}/agents/missing`)).status).toBe(404);
    expect((await fetch(`${baseUrl}/agents/missing/heartbeat`, { method: 'POST' })).status).toBe(
      404,
    );
    expect((await fetch(`${baseUrl}/agents/missing`, { method: 'DELETE' })).status).toBe(404);

    await client.register('https://agent-3.com', {
      protocolVersion: '1.0',
      name: 'Agent 3',
      description: 'Desc',
      url: 'https://agent-3.com',
      version: '1.0',
      skills: [{ id: 's3', name: 'Planner', description: 'desc', tags: ['plan'] }],
    });

    const firstEvent = await firstEventPromise;
    expect(firstEvent.value).toEqual(
      expect.objectContaining({
        type: 'registered',
        agent: expect.objectContaining({ url: 'https://agent-3.com' }),
      }),
    );

    await events.return(undefined);
    server.stop();
  });

  it('marks agents healthy and unhealthy during scheduled health checks', async () => {
    const storage = new InMemoryStorage();
    const healthyAgent = {
      id: 'healthy',
      url: 'https://healthy-agent.com',
      card: {
        protocolVersion: '1.0' as const,
        name: 'Healthy',
        description: 'desc',
        url: 'https://healthy-agent.com',
        version: '1.0',
      },
      status: 'unknown' as const,
      tags: [],
      skills: [],
      registeredAt: new Date().toISOString(),
    };
    const failingAgent = {
      ...healthyAgent,
      id: 'failing',
      url: 'https://failing-agent.com',
    };
    await storage.upsert(healthyAgent);
    await storage.upsert(failingAgent);

    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
      const url = typeof input === 'string' ? input : input.toString();
      if (url.startsWith('https://healthy-agent.com/')) {
        return new Response(null, { status: 200 });
      }
      throw new Error('offline');
    });

    const server = new RegistryServer({ storage, allowLocalhost: true });
    await (
      server as unknown as {
        executeHealthChecks: (agents: (typeof healthyAgent)[]) => Promise<void>;
      }
    ).executeHealthChecks([healthyAgent, failingAgent]);

    expect((await storage.get('healthy'))?.status).toBe('healthy');
    expect((await storage.get('failing'))?.status).toBe('unhealthy');

    server.stop();
  });
});
