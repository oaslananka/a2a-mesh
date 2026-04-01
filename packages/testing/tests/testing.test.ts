import { afterEach, describe, expect, it } from 'vitest';
import { A2ATestServer } from '../src/A2ATestServer.js';
import { MockA2AClient } from '../src/MockA2AClient.js';
import { basicAgentCard, createTestAgentCard } from '../src/fixtures/agent-cards.js';
import { createTestMessage, createTestTask } from '../src/fixtures/tasks.js';
import { toHaveCompletedTask } from '../src/matchers/toHaveCompletedTask.js';

async function waitFor(
  predicate: () => boolean,
  timeoutMs = 2_000,
  intervalMs = 20,
): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (predicate()) {
      return;
    }
    await new Promise<void>((resolve) => {
      setTimeout(resolve, intervalMs);
    });
  }

  throw new Error('Condition was not met before timeout');
}

describe('a2a-mesh-testing', () => {
  const servers: A2ATestServer[] = [];

  afterEach(async () => {
    await Promise.all(servers.map((server) => server.stop()));
    servers.length = 0;
  });

  it('starts an in-process server and completes tasks through the mock client', async () => {
    const server = new A2ATestServer();
    servers.push(server);

    expect(() => server.port).toThrow('A2ATestServer has not been started yet');
    await server.stop();

    const firstPort = await server.start(0);
    const secondPort = await server.start(0);
    expect(secondPort).toBe(firstPort);
    expect(server.url).toBe(`http://127.0.0.1:${firstPort}`);

    const client = server.client({ retry: { maxAttempts: 1, backoffMs: 1 } });
    expect(client.baseUrl).toBe(server.url);

    const task = await client.sendMessage(createTestMessage('hello world', 'ctx-1'));
    await waitFor(() => server.getTask(task.id)?.status.state === 'completed');

    const storedTask = server.getTask(task.id);
    expect(storedTask?.history[0]?.contextId).toBe('ctx-1');
    expect(storedTask?.artifacts?.[0]?.parts).toEqual([{ type: 'text', text: 'hello world' }]);
    expect(toHaveCompletedTask(storedTask!).pass).toBe(true);
    expect(toHaveCompletedTask(storedTask!).message()).toContain('not to be completed');
  });

  it('supports custom handlers, reusable fixtures and direct mock client construction', async () => {
    const server = new A2ATestServer({
      card: { name: 'Fixture Agent' },
      handler: async (task, message) => [
        {
          artifactId: `${task.id}-artifact`,
          parts: [{ type: 'text', text: JSON.stringify(message.parts) }],
          index: 0,
          lastChunk: true,
        },
      ],
    });
    servers.push(server);
    await server.start(0);

    const client = MockA2AClient.fromServer(server);
    const task = await client.sendMessage(createTestMessage('fixture test'));
    await waitFor(() => server.getTask(task.id)?.status.state === 'completed');

    const failedTask = createTestTask({
      status: {
        state: 'failed',
        timestamp: new Date().toISOString(),
      },
    });

    expect(createTestAgentCard({ name: 'Fixture Agent' }).name).toBe('Fixture Agent');
    expect(basicAgentCard.protocolVersion).toBe('1.0');
    expect(toHaveCompletedTask(failedTask).pass).toBe(false);
    expect(toHaveCompletedTask(failedTask).message()).toContain('received failed');
  });
});
