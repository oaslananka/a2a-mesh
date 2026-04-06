import express from 'express';
import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { A2AServer, type A2AServerOptions } from '../src/server/A2AServer.js';
import { ErrorCodes } from '../src/types/jsonrpc.js';
import type { AgentCard } from '../src/types/agent-card.js';
import type { Artifact, Message, Task } from '../src/types/task.js';

const agentCard: AgentCard = {
  protocolVersion: '1.0',
  name: 'Edge Harness Agent',
  description: 'A2AServer edge-case test harness',
  url: 'http://localhost:0',
  version: '1.0.0',
  capabilities: {
    streaming: true,
    pushNotifications: true,
    stateTransitionHistory: true,
    extendedAgentCard: true,
  },
};

class EdgeHarnessServer extends A2AServer {
  constructor(options: A2AServerOptions = {}) {
    super(agentCard, options);
  }

  async handleTask(_task: Task, message: Message): Promise<Artifact[]> {
    const text = message.parts.find((part) => part.type === 'text');

    return [
      {
        artifactId: 'artifact-1',
        index: 0,
        lastChunk: true,
        parts: [
          {
            type: 'text',
            text: text?.type === 'text' ? `echo:${text.text}` : 'echo:',
          },
        ],
      },
    ];
  }
}

function createMessage(text: string): Message {
  return {
    role: 'user',
    parts: [{ type: 'text', text }],
    messageId: `message-${text}`,
    timestamp: new Date().toISOString(),
  };
}

describe('A2AServer edge cases', () => {
  it('returns 429 when the JSON-RPC rate limit is exceeded', async () => {
    const server = new EdgeHarnessServer({
      rateLimit: { maxRequests: 2, windowMs: 60_000 },
    });

    const payload = {
      jsonrpc: '2.0' as const,
      method: 'message/send',
      params: { message: createMessage('rate-limit') },
    };

    await request(server.getExpressApp())
      .post('/rpc')
      .send({ ...payload, id: '1' })
      .expect(200);
    await request(server.getExpressApp())
      .post('/rpc')
      .send({ ...payload, id: '2' })
      .expect(200);

    const response = await request(server.getExpressApp())
      .post('/rpc')
      .send({ ...payload, id: '3' });

    expect(response.status).toBe(429);
    expect(response.body.error).toMatchObject({
      code: ErrorCodes.RateLimitExceeded,
      message: 'Too Many Requests',
    });
  });

  it('returns 401 for protected endpoints when auth headers are missing', async () => {
    const server = new EdgeHarnessServer({
      auth: {
        securitySchemes: [{ type: 'apiKey', id: 'api-key', in: 'header', name: 'x-api-key' }],
        apiKeys: { 'api-key': 'secret' },
      },
    });

    const response = await request(server.getExpressApp()).get('/tasks');

    expect(response.status).toBe(401);
    expect(response.text).toBe('Unauthorized');
  });

  it('returns 403 when a task stream is accessed from a different tenant', async () => {
    const server = new EdgeHarnessServer();
    const task = server
      .getTaskManager()
      .createTask('session-edge', 'context-edge', 'user-a', 'tenant-1');

    const app = express();
    app.use(express.json());
    app.use((req, _res, next) => {
      const principalId = req.header('x-principal');
      const tenantId = req.header('x-tenant');
      if (principalId) {
        (req as { principalId?: string }).principalId = principalId;
      }
      if (tenantId) {
        (req as { tenantId?: string }).tenantId = tenantId;
      }
      next();
    });
    app.use(server.getExpressApp());

    const response = await request(app)
      .get('/stream')
      .query({ taskId: task.id })
      .set('x-principal', 'user-a')
      .set('x-tenant', 'tenant-2');

    expect(response.status).toBe(403);
    expect(response.text).toBe('Forbidden');
  });

  it('returns a JSON-RPC TaskNotFound error envelope from the /rpc alias', async () => {
    const server = new EdgeHarnessServer();

    const response = await request(server.getExpressApp())
      .post('/rpc')
      .send({
        jsonrpc: '2.0',
        id: 'missing-task',
        method: 'tasks/get',
        params: { taskId: 'does-not-exist' },
      });

    expect(response.status).toBe(200);
    expect(response.body.error).toMatchObject({
      code: ErrorCodes.TaskNotFound,
      message: 'Task not found',
    });
  });

  it('rejects push notification webhook URLs that resolve to private networks', async () => {
    const server = new EdgeHarnessServer();
    const task = server.getTaskManager().createTask('session-ssrf', 'context-ssrf');

    const response = await request(server.getExpressApp())
      .post('/rpc')
      .send({
        jsonrpc: '2.0',
        id: 'push-block',
        method: 'tasks/pushNotification/set',
        params: {
          taskId: task.id,
          pushNotificationConfig: {
            url: 'http://127.0.0.1:8787/hook',
          },
        },
      });

    expect(response.status).toBe(200);
    expect(response.body.error.code).toBe(ErrorCodes.InvalidParams);
    expect(response.body.error.message).toContain('Invalid push notification URL');
    expect(response.body.error.message).toContain('Private IP addresses are not allowed');
  });
});
