import { randomUUID } from 'node:crypto';
import type { Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import type { A2AServer } from '../../packages/core/src/server/A2AServer.js';
import type { A2AClient } from '../../packages/core/src/client/A2AClient.js';
import type { Message, Task, TaskStatus } from '../../packages/core/src/types/task.js';

export interface StartedServer {
  server: Server;
  url: string;
  close: () => Promise<void>;
}

export async function startTestServer(agent: A2AServer): Promise<StartedServer> {
  const server = agent.start(0) as Server;
  await new Promise<void>((resolve) => server.once('listening', resolve));
  const port = (server.address() as AddressInfo).port;
  const url = `http://localhost:${port}`;
  agent.getAgentCard().url = url;

  return {
    server,
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

export function createUserMessage(text: string, overrides: Partial<Message> = {}): Message {
  return {
    role: 'user',
    parts: [{ type: 'text', text }],
    messageId: randomUUID(),
    timestamp: new Date().toISOString(),
    ...overrides,
  };
}

export async function waitForTaskState(
  client: A2AClient,
  taskId: string,
  states: TaskStatus['state'][] = ['completed'],
  timeoutMs = 5000,
  intervalMs = 25,
): Promise<Task> {
  const startedAt = Date.now();

  while (Date.now() - startedAt < timeoutMs) {
    const task = await client.getTask(taskId);
    if (states.includes(task.status.state)) {
      return task;
    }
    await new Promise<void>((resolve) => setTimeout(resolve, intervalMs));
  }

  throw new Error(`Timed out waiting for task ${taskId} to reach ${states.join(', ')}`);
}

export function readTextArtifacts(task: Task): string {
  return (task.artifacts ?? [])
    .flatMap((artifact) => artifact.parts)
    .filter((part) => part.type === 'text')
    .map((part) => (part.type === 'text' ? part.text : ''))
    .join('\n');
}

export async function postJsonRpc<TResult>(
  baseUrl: string,
  method: string,
  params?: Record<string, unknown>,
  headers: Record<string, string> = {},
): Promise<TResult> {
  const response = await fetch(`${baseUrl}/`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...headers,
    },
    body: JSON.stringify({
      jsonrpc: '2.0',
      id: randomUUID(),
      method,
      ...(params ? { params } : {}),
    }),
  });

  return (await response.json()) as TResult;
}
