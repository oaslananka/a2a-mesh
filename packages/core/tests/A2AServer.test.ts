import { afterEach, describe, expect, it } from 'vitest';
import { A2AServer } from '../src/server/A2AServer.js';
import { ErrorCodes, type JsonRpcRequest } from '../src/types/jsonrpc.js';
import type { AgentCard } from '../src/types/agent-card.js';
import type { Artifact, Message, Task } from '../src/types/task.js';

function createAgentCard(overrides: Partial<AgentCard> = {}): AgentCard {
  return {
    protocolVersion: '1.0',
    name: 'Harness Agent',
    description: 'Test harness agent',
    url: 'http://localhost:0',
    version: '1.0.0',
    capabilities: {
      streaming: true,
      pushNotifications: true,
      stateTransitionHistory: true,
      extendedAgentCard: true,
    },
    extensions: [{ uri: 'https://example.com/extensions/citations/v1' }],
    ...overrides,
  };
}

class HarnessServer extends A2AServer {
  constructor(
    private readonly mode: 'success' | 'failure' = 'success',
    cardOverrides: Partial<AgentCard> = {},
    withAuth = false,
  ) {
    super(
      createAgentCard(cardOverrides),
      withAuth
        ? {
            auth: {
              securitySchemes: [{ type: 'apiKey', id: 'api-key', in: 'header', name: 'x-api-key' }],
              apiKeys: { 'api-key': 'secret' },
            },
          }
        : {},
    );
  }

  async handleTask(_task: Task, message: Message): Promise<Artifact[]> {
    if (this.mode === 'failure') {
      throw new Error('boom');
    }

    const textPart = message.parts.find((part) => part.type === 'text');
    return [
      {
        artifactId: 'artifact-1',
        parts: [{ type: 'text', text: textPart?.type === 'text' ? textPart.text : 'empty' }],
        index: 0,
        lastChunk: true,
      },
    ];
  }

  async callRpc(request: JsonRpcRequest, headers: Record<string, string> = {}): Promise<unknown> {
    return this.handleRpc(request, {
      req: {
        header(name: string) {
          return headers[name] ?? headers[name.toLowerCase()];
        },
        query: {},
        body: request,
        requestId: 'request-1',
      } as never,
    });
  }

  normalize(task: Task, artifacts: Artifact[]) {
    return this.normalizeArtifacts(task, artifacts);
  }

  async process(task: Task, message: Message): Promise<void> {
    return this.processTaskInternal(task, message);
  }

  getTask(taskId: string): Task | undefined {
    return this.taskManager.getTask(taskId);
  }

  createTask(contextId?: string): Task {
    return this.taskManager.createTask(undefined, contextId);
  }
}

describe('A2AServer', () => {
  const handles: Array<{ close: (cb: () => void) => void }> = [];

  afterEach(async () => {
    await Promise.all(
      handles.map(
        (handle) =>
          new Promise<void>((resolve) => {
            handle.close(() => resolve());
          }),
      ),
    );
    handles.length = 0;
  });

  it('exposes express internals and normalizes legacy agent cards', () => {
    const server = new HarnessServer();
    expect(server.getExpressApp()).toBeTruthy();
    expect(server.getAgentCard().name).toBe('Harness Agent');
    expect(
      A2AServer.fromCard({
        protocolVersion: '0.3' as '1.0',
        name: 'Legacy',
        description: 'desc',
        url: 'http://legacy',
        version: '0.3',
      }),
    ).toEqual(
      expect.objectContaining({
        protocolVersion: '1.0',
        name: 'Legacy',
      }),
    );
  });

  it('returns validation errors for invalid HTTP requests and stream requests without a task id', async () => {
    const server = new HarnessServer();
    const listener = server.start(0);
    handles.push(listener);

    await new Promise((resolve) => setTimeout(resolve, 25));
    const port = (listener.address() as { port: number }).port;
    const baseUrl = `http://localhost:${port}`;

    const invalidRpcResponse = await fetch(`${baseUrl}/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ jsonrpc: '1.0', method: 'message/send', id: 'bad-request' }),
    });
    const invalidPayload = (await invalidRpcResponse.json()) as {
      error: { code: number; message: string };
    };
    expect(invalidPayload.error.code).toBe(ErrorCodes.InvalidParams);
    expect(invalidPayload.error.message).toBe('Invalid parameters');

    const streamResponse = await fetch(`${baseUrl}/stream`);
    expect(streamResponse.status).toBe(400);
    expect(await streamResponse.text()).toContain('Missing taskId');
  });

  it('handles rpc task lifecycle, extension negotiation and auth errors', async () => {
    const server = new HarnessServer('success', {}, true);
    const message: Message = {
      role: 'user',
      parts: [{ type: 'text', text: 'hello' }],
      messageId: 'message-1',
      timestamp: new Date().toISOString(),
    };

    const task = (await server.callRpc({
      jsonrpc: '2.0',
      id: 'send-1',
      method: 'message/send',
      params: {
        message,
        contextId: 'ctx-1',
        configuration: {
          extensions: [{ uri: 'https://example.com/extensions/citations/v1', required: true }],
        },
      },
    })) as Task;

    expect(task.contextId).toBe('ctx-1');
    expect(
      (
        (await server.callRpc({
          jsonrpc: '2.0',
          id: 'get-1',
          method: 'tasks/get',
          params: { taskId: task.id },
        })) as Task
      ).id,
    ).toBe(task.id);
    expect(
      (
        (await server.callRpc({
          jsonrpc: '2.0',
          id: 'cancel-1',
          method: 'tasks/cancel',
          params: { taskId: task.id },
        })) as Task
      ).status.state,
    ).toBe('canceled');

    await expect(
      server.callRpc({
        jsonrpc: '2.0',
        id: 'ext-1',
        method: 'message/send',
        params: {
          message,
          configuration: {
            extensions: [{ uri: 'https://unsupported.example/extensions/a', required: true }],
          },
        },
      }),
    ).rejects.toMatchObject({
      code: ErrorCodes.ExtensionRequired,
    });

    await expect(
      server.callRpc({
        jsonrpc: '2.0',
        id: 'auth-1',
        method: 'agent/authenticatedExtendedCard',
      }),
    ).rejects.toMatchObject({
      code: ErrorCodes.Unauthorized,
    });

    expect(
      await server.callRpc(
        {
          jsonrpc: '2.0',
          id: 'auth-2',
          method: 'agent/authenticatedExtendedCard',
        },
        { 'x-api-key': 'secret' },
      ),
    ).toEqual(expect.objectContaining({ name: 'Harness Agent' }));
  });

  it('lists tasks, skips unsupported optional extensions and reports health details', async () => {
    const server = new HarnessServer();
    const listener = server.start(0);
    handles.push(listener);
    await new Promise((resolve) => setTimeout(resolve, 25));

    const port = (listener.address() as { port: number }).port;
    const baseUrl = `http://localhost:${port}`;

    const task = (await server.callRpc({
      jsonrpc: '2.0',
      id: 'list-1',
      method: 'message/send',
      params: {
        message: {
          role: 'user',
          parts: [{ type: 'text', text: 'hello list' }],
          messageId: 'message-list-1',
          timestamp: new Date().toISOString(),
        },
        contextId: 'ctx-list',
        configuration: {
          extensions: [
            { uri: 'https://example.com/extensions/citations/v1', required: true },
            { uri: 'https://unsupported.example/extensions/optional', required: false },
          ],
        },
      },
    })) as Task;

    expect(task.extensions).toEqual(['https://example.com/extensions/citations/v1']);

    const listed = (await server.callRpc({
      jsonrpc: '2.0',
      id: 'list-2',
      method: 'tasks/list',
      params: {
        contextId: 'ctx-list',
        limit: 10,
        offset: 0,
      },
    })) as { tasks: Task[]; total: number };

    expect(listed.total).toBe(1);
    expect(listed.tasks[0]?.id).toBe(task.id);

    const healthResponse = await fetch(`${baseUrl}/health`);
    const health = (await healthResponse.json()) as {
      protocol: string;
      uptime: number;
      tasks: { total: number; active: number };
      memory: { heapUsedMb: number; heapTotalMb: number };
    };

    expect(health.protocol).toBe('A2A/1.0');
    expect(health.uptime).toBeGreaterThanOrEqual(0);
    expect(health.tasks.total).toBeGreaterThanOrEqual(1);
    expect(health.tasks.active).toBeGreaterThanOrEqual(0);
    expect(health.memory.heapUsedMb).toBeGreaterThan(0);
    expect(health.memory.heapTotalMb).toBeGreaterThan(0);
  });

  it('reuses task ids, stores push configs and lists all tasks without a context filter', async () => {
    const server = new HarnessServer();
    const message: Message = {
      role: 'user',
      parts: [{ type: 'text', text: 'hello again' }],
      messageId: 'message-reuse-1',
      timestamp: new Date().toISOString(),
    };

    const created = (await server.callRpc({
      jsonrpc: '2.0',
      id: 'reuse-1',
      method: 'message/send',
      params: {
        message,
      },
    })) as Task;

    expect(
      await server.callRpc({
        jsonrpc: '2.0',
        id: 'push-get-empty',
        method: 'tasks/pushNotification/get',
        params: { taskId: created.id },
      }),
    ).toBeNull();

    const reused = (await server.callRpc({
      jsonrpc: '2.0',
      id: 'reuse-2',
      method: 'message/send',
      params: {
        taskId: created.id,
        message: {
          ...message,
          messageId: 'message-reuse-2',
        },
      },
    })) as Task;

    expect(reused.id).toBe(created.id);

    const pushConfig = {
      url: 'https://example.com/hook',
      token: 'secret-token',
    };
    expect(
      await server.callRpc({
        jsonrpc: '2.0',
        id: 'push-set',
        method: 'tasks/pushNotification/set',
        params: {
          taskId: created.id,
          pushNotificationConfig: pushConfig,
        },
      }),
    ).toEqual(pushConfig);

    expect(
      await server.callRpc({
        jsonrpc: '2.0',
        id: 'push-get',
        method: 'tasks/pushNotification/get',
        params: { taskId: created.id },
      }),
    ).toEqual(pushConfig);

    const listed = (await server.callRpc({
      jsonrpc: '2.0',
      id: 'list-all',
      method: 'tasks/list',
      params: {},
    })) as { tasks: Task[]; total: number };

    expect(listed.total).toBeGreaterThanOrEqual(1);
    expect(listed.tasks.some((task) => task.id === created.id)).toBe(true);
  });

  it('rejects unsupported operations and missing task parameters', async () => {
    const server = new HarnessServer('success', {
      capabilities: {
        streaming: true,
        pushNotifications: false,
        stateTransitionHistory: true,
        extendedAgentCard: false,
      },
      extensions: [],
    });

    await expect(
      server.callRpc({
        jsonrpc: '2.0',
        id: 'missing-task',
        method: 'tasks/get',
        params: {},
      }),
    ).rejects.toMatchObject({
      code: ErrorCodes.InvalidParams,
    });

    await expect(
      server.callRpc({
        jsonrpc: '2.0',
        id: 'unsupported-card',
        method: 'agent/authenticatedExtendedCard',
      }),
    ).rejects.toMatchObject({
      code: ErrorCodes.UnsupportedOperation,
    });

    await expect(
      server.callRpc({
        jsonrpc: '2.0',
        id: 'unknown-method',
        method: 'tasks/unknown',
      }),
    ).rejects.toMatchObject({
      code: ErrorCodes.MethodNotFound,
    });
  });

  it('rejects missing push params and unknown task ids across task operations', async () => {
    const server = new HarnessServer();
    const message: Message = {
      role: 'user',
      parts: [{ type: 'text', text: 'unknown task' }],
      messageId: 'message-unknown-task',
      timestamp: new Date().toISOString(),
    };

    await expect(
      server.callRpc({
        jsonrpc: '2.0',
        id: 'push-invalid',
        method: 'tasks/pushNotification/set',
        params: {
          taskId: 'missing-task',
        },
      }),
    ).rejects.toMatchObject({
      code: ErrorCodes.InvalidParams,
    });

    await expect(
      server.callRpc({
        jsonrpc: '2.0',
        id: 'push-get-invalid',
        method: 'tasks/pushNotification/get',
        params: {},
      }),
    ).rejects.toMatchObject({
      code: ErrorCodes.InvalidParams,
    });

    await expect(
      server.callRpc({
        jsonrpc: '2.0',
        id: 'cancel-missing',
        method: 'tasks/cancel',
        params: { taskId: 'missing-task' },
      }),
    ).rejects.toMatchObject({
      code: ErrorCodes.TaskNotFound,
    });

    await expect(
      server.callRpc({
        jsonrpc: '2.0',
        id: 'send-missing',
        method: 'message/send',
        params: {
          taskId: 'missing-task',
          message,
        },
      }),
    ).rejects.toMatchObject({
      code: ErrorCodes.TaskNotFound,
    });

    await expect(
      server.callRpc({
        jsonrpc: '2.0',
        id: 'push-set-missing-task',
        method: 'tasks/pushNotification/set',
        params: {
          taskId: 'missing-task',
          pushNotificationConfig: { url: 'https://example.com/hook' },
        },
      }),
    ).rejects.toMatchObject({
      code: ErrorCodes.TaskNotFound,
    });
  });

  it('returns the extended card when auth is not configured', async () => {
    const server = new HarnessServer();

    await expect(
      server.callRpc({
        jsonrpc: '2.0',
        id: 'auth-open',
        method: 'agent/authenticatedExtendedCard',
      }),
    ).resolves.toEqual(expect.objectContaining({ name: 'Harness Agent' }));
  });

  it('normalizes artifact metadata and marks failed tasks when task processing raises', async () => {
    const successServer = new HarnessServer();
    const task = successServer.createTask('ctx-42');
    task.extensions = ['https://example.com/extensions/citations/v1'];
    const normalized = successServer.normalize(task, [
      {
        artifactId: 'artifact-1',
        parts: [{ type: 'text', text: 'hi' }],
        index: 0,
      },
    ]);

    expect(normalized[0]).toEqual(
      expect.objectContaining({
        extensions: ['https://example.com/extensions/citations/v1'],
        metadata: expect.objectContaining({
          taskId: task.id,
          contextId: 'ctx-42',
          appliedExtensions: ['https://example.com/extensions/citations/v1'],
        }),
      }),
    );

    const failureServer = new HarnessServer('failure');
    const failingTask = failureServer.createTask('ctx-fail');
    const message: Message = {
      role: 'user',
      parts: [{ type: 'text', text: 'explode' }],
      messageId: 'message-2',
      timestamp: new Date().toISOString(),
    };

    await expect(failureServer.process(failingTask, message)).rejects.toThrow('boom');
    expect(failureServer.getTask(failingTask.id)?.status.state).toBe('failed');
  });

  it('stores artifacts and marks tasks completed when task processing succeeds', async () => {
    const server = new HarnessServer();
    const task = server.createTask('ctx-success');
    const message: Message = {
      role: 'user',
      parts: [{ type: 'text', text: 'done' }],
      messageId: 'message-success',
      timestamp: new Date().toISOString(),
    };

    await server.process(task, message);

    expect(server.getTask(task.id)).toEqual(
      expect.objectContaining({
        status: expect.objectContaining({ state: 'completed' }),
        artifacts: [
          expect.objectContaining({
            artifactId: 'artifact-1',
          }),
        ],
      }),
    );
  });
});
