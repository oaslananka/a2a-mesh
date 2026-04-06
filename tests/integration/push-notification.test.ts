import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import type { AddressInfo } from 'node:net';
import { A2AServer } from '../../packages/core/src/server/A2AServer.js';
import { A2AClient } from '../../packages/core/src/client/A2AClient.js';
import type { Artifact, Message, Task } from '../../packages/core/src/types/task.js';
import { createUserMessage, startTestServer, type StartedServer } from './helpers.js';

class SlowAgent extends A2AServer {
  constructor() {
    super({
      protocolVersion: '1.0',
      name: 'SlowAgent',
      description: 'Slow agent used for push notification testing',
      url: 'http://localhost:0',
      version: '1.0.0',
      capabilities: { pushNotifications: true, streaming: false },
    });
  }

  async handleTask(_task: Task, _message: Message): Promise<Artifact[]> {
    await new Promise((resolve) => setTimeout(resolve, 50));
    return [
      {
        artifactId: 'slow-result',
        parts: [{ type: 'text', text: 'Done after delay' }],
        index: 0,
        lastChunk: true,
      },
    ];
  }
}

async function createWebhookReceiver(): Promise<{
  url: string;
  receivedPayloads: Task[];
  close: () => Promise<void>;
}> {
  const receivedPayloads: Task[] = [];
  const server = createServer((req: IncomingMessage, res: ServerResponse) => {
    let body = '';
    req.on('data', (chunk: Buffer) => {
      body += chunk.toString();
    });
    req.on('end', () => {
      try {
        receivedPayloads.push(JSON.parse(body) as Task);
      } catch {
        // ignore parse errors in tests
      }
      res.writeHead(200);
      res.end('ok');
    });
  });

  await new Promise<void>((resolve) => server.listen(0, resolve));
  const port = (server.address() as AddressInfo).port;
  return {
    url: `http://localhost:${port}`,
    receivedPayloads,
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

describe('Push Notification Lifecycle', () => {
  let agentHandle: StartedServer;
  let webhookReceiver: Awaited<ReturnType<typeof createWebhookReceiver>>;

  beforeAll(async () => {
    agentHandle = await startTestServer(new SlowAgent());
    webhookReceiver = await createWebhookReceiver();
  });

  afterAll(async () => {
    await Promise.all([agentHandle.close(), webhookReceiver.close()]);
  });

  it('push notification webhook tetiklenir ve task snapshot teslim edilir', async () => {
    const client = new A2AClient(agentHandle.url);

    const task = await client.sendMessage({
      message: createUserMessage('trigger push notification'),
      configuration: {
        pushNotificationConfig: {
          url: webhookReceiver.url,
          token: 'test-token-123',
        },
      },
    });

    expect(task.id).toBeDefined();

    await new Promise<void>((resolve) => {
      const poll = setInterval(() => {
        if (webhookReceiver.receivedPayloads.length > 0) {
          clearInterval(poll);
          resolve();
        }
      }, 50);

      setTimeout(() => {
        clearInterval(poll);
        resolve();
      }, 5000);
    });

    expect(webhookReceiver.receivedPayloads.length).toBeGreaterThan(0);
    const deliveredSnapshots = webhookReceiver.receivedPayloads.filter(
      (payload) => payload.id === task.id,
    );
    expect(deliveredSnapshots.length).toBeGreaterThan(0);
    expect(deliveredSnapshots.some((payload) => payload.status.state === 'completed')).toBe(true);
  }, 10000);

  it('tasks/pushNotification/set ve get roundtrip', async () => {
    const client = new A2AClient(agentHandle.url);

    const task = await client.sendMessage({
      message: createUserMessage('create task for push config test'),
    });

    const pushConfig = { url: webhookReceiver.url, token: 'roundtrip-token' };
    await client.setPushNotification(task.id, pushConfig);
    const retrieved = await client.getPushNotification(task.id);

    expect(retrieved?.url).toBe(pushConfig.url);
    expect(retrieved?.token).toBe(pushConfig.token);
  }, 10000);
});
