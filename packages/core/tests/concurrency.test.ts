import { describe, expect, it } from 'vitest';
import { randomUUID } from 'node:crypto';
import type { Server } from 'node:http';
import { A2AServer } from '../src/server/A2AServer.js';
import { A2AClient } from '../src/client/A2AClient.js';
import type { Artifact, Message, Task } from '../src/types/task.js';

class DelayAgent extends A2AServer {
  constructor(private readonly delayMs = 50) {
    super({
      protocolVersion: '1.0',
      name: 'DelayAgent',
      description: 'Delay-based agent for concurrency testing',
      url: 'http://localhost:0',
      version: '1.0.0',
      capabilities: { streaming: false },
    });
  }

  async handleTask(task: Task, _message: Message): Promise<Artifact[]> {
    await new Promise((resolve) => setTimeout(resolve, this.delayMs));
    return [
      {
        artifactId: `artifact-${task.id}`,
        parts: [{ type: 'text', text: `Completed: ${task.id}` }],
        index: 0,
        lastChunk: true,
      },
    ];
  }
}

async function startServer(agent: A2AServer): Promise<{ url: string; close: () => Promise<void> }> {
  const server = agent.start(0) as Server;
  await new Promise<void>((resolve) => server.once('listening', resolve));
  const port = (server.address() as { port: number }).port;
  const url = `http://localhost:${port}`;
  agent.getAgentCard().url = url;

  return {
    url,
    close: () =>
      new Promise<void>((resolve, reject) => {
        server.close((error) => {
          if (error) {
            reject(error);
            return;
          }
          resolve();
        });
      }),
  };
}

function createMessage(text: string): Message {
  return {
    role: 'user',
    parts: [{ type: 'text', text }],
    messageId: randomUUID(),
    timestamp: new Date().toISOString(),
  };
}

async function waitForTerminalTask(
  client: A2AClient,
  taskId: string,
  timeoutMs = 5000,
): Promise<Task> {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    const task = await client.getTask(taskId);
    if (['completed', 'failed', 'canceled'].includes(task.status.state)) {
      return task;
    }
    await new Promise((resolve) => setTimeout(resolve, 20));
  }

  throw new Error(`Timed out waiting for task ${taskId} to finish`);
}

describe('Concurrency safety', () => {
  it('creates unique tasks for 10 concurrent requests and completes them all', async () => {
    const { url, close } = await startServer(new DelayAgent(30));

    try {
      const client = new A2AClient(url);
      const createdTasks = await Promise.all(
        Array.from({ length: 10 }, (_, index) =>
          client.sendMessage(createMessage(`concurrent request ${index}`)),
        ),
      );

      expect(createdTasks).toHaveLength(10);
      expect(new Set(createdTasks.map((task) => task.id)).size).toBe(10);

      const completedTasks = await Promise.all(
        createdTasks.map((task) => waitForTerminalTask(client, task.id)),
      );
      expect(completedTasks.every((task) => task.status.state === 'completed')).toBe(true);
    } finally {
      await close();
    }
  }, 15000);

  it('returns consistent results for repeated parallel tasks/get calls', async () => {
    const { url, close } = await startServer(new DelayAgent(10));

    try {
      const client = new A2AClient(url);
      const createdTask = await client.sendMessage(createMessage('base task'));
      const task = await waitForTerminalTask(client, createdTask.id);

      const results = await Promise.all(Array.from({ length: 5 }, () => client.getTask(task.id)));
      results.forEach((result) => {
        expect(result.id).toBe(task.id);
        expect(result.status.state).toBe(task.status.state);
      });
    } finally {
      await close();
    }
  }, 10000);

  it('continues serving health checks after repeated request load', async () => {
    const { url, close } = await startServer(new DelayAgent(5));

    try {
      const client = new A2AClient(url);
      for (let index = 0; index < 50; index += 1) {
        const createdTask = await client.sendMessage(createMessage(`memory test ${index}`));
        await waitForTerminalTask(client, createdTask.id);
      }

      const health = await fetch(`${url}/health`);
      expect(health.status).toBe(200);
    } finally {
      await close();
    }
  }, 30000);

  it('handles concurrent cancel and get requests without crashing', async () => {
    const { url, close } = await startServer(new DelayAgent(200));

    try {
      const client = new A2AClient(url);
      const createdTask = await client.sendMessage(createMessage('cancel concurrency test'));

      const [cancelResult, getResult] = await Promise.all([
        client.cancelTask(createdTask.id),
        client.getTask(createdTask.id),
      ]);

      expect(cancelResult.id).toBe(createdTask.id);
      expect(getResult.id).toBe(createdTask.id);

      const finalTask = await waitForTerminalTask(client, createdTask.id, 10000);
      expect(['canceled', 'completed', 'failed']).toContain(finalTask.status.state);
    } finally {
      await close();
    }
  }, 10000);
});
