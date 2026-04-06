import { afterEach, describe, expect, it, vi } from 'vitest';

import { A2AClient, type A2AClientOptions } from '../src/client/A2AClient.js';

class MockEventSource {
  static instances: MockEventSource[] = [];
  static readonly CONNECTING = 0;
  static readonly OPEN = 1;
  static readonly CLOSED = 2;
  static readonly ReadyState = {
    CONNECTING: MockEventSource.CONNECTING,
    OPEN: MockEventSource.OPEN,
    CLOSED: MockEventSource.CLOSED,
  };

  public onerror: (() => void) | undefined;
  public closed = false;
  private readonly listeners = new Map<string, Array<(event: { data: string }) => void>>();

  constructor(
    public readonly url: string,
    public readonly options?: { headers?: Record<string, string> },
  ) {
    MockEventSource.instances.push(this);
  }

  addEventListener(eventName: string, listener: (event: { data: string }) => void): void {
    const listeners = this.listeners.get(eventName) ?? [];
    listeners.push(listener);
    this.listeners.set(eventName, listeners);
  }

  emit(eventName: string, payload: unknown): void {
    const listeners = this.listeners.get(eventName) ?? [];
    const event = { data: JSON.stringify(payload) };
    listeners.forEach((listener) => listener(event));
  }

  close(): void {
    this.closed = true;
  }

  static reset(): void {
    MockEventSource.instances.length = 0;
  }
}

function createTaskPayload(id: string, state: 'submitted' | 'working' | 'completed' = 'submitted') {
  return {
    id,
    status: {
      state,
      timestamp: new Date().toISOString(),
    },
    history: [],
  };
}

describe('A2AClient streaming and retry branches', () => {
  afterEach(() => {
    MockEventSource.reset();
    vi.restoreAllMocks();
  });

  const eventSourceImplementation = MockEventSource as unknown as NonNullable<
    A2AClientOptions['eventSourceImplementation']
  >;

  it('resolves the canonical agent card without falling back to the legacy path', async () => {
    const fetchSpy = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(
        JSON.stringify({
          protocolVersion: '1.0',
          name: 'Canonical',
          description: 'Primary card',
          url: 'http://localhost:3000',
          version: '1.0.0',
        }),
        { status: 200 },
      ),
    );

    const client = new A2AClient('http://localhost:3000', {
      fetchImplementation: fetchSpy,
    });

    const card = await client.resolveCard();
    expect(card.name).toBe('Canonical');
    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });

  it('does not retry non-retryable HTTP failures', async () => {
    const fetchSpy = vi.fn<typeof fetch>().mockResolvedValue(new Response(null, { status: 404 }));
    const client = new A2AClient('http://localhost:3000', {
      fetchImplementation: fetchSpy,
      retry: {
        maxAttempts: 3,
        backoffMs: 1,
        retryOn: [503],
      },
    });

    await expect(client.health()).rejects.toThrow('Health check failed with status 404');
    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });

  it('keeps wrapped message params intact when calling sendMessage', async () => {
    const fetchSpy = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(
        JSON.stringify({
          jsonrpc: '2.0',
          id: '1',
          result: createTaskPayload('task-wrapped'),
        }),
        { status: 200 },
      ),
    );

    const client = new A2AClient('http://localhost:3000', {
      fetchImplementation: fetchSpy,
    });

    await client.sendMessage({
      message: {
        role: 'user',
        parts: [{ type: 'text', text: 'wrapped params' }],
        messageId: 'wrapped-message',
        timestamp: new Date().toISOString(),
      },
      contextId: 'ctx-wrapped',
      configuration: {
        blocking: true,
      },
    });

    const [, init] = fetchSpy.mock.calls[0] ?? [];
    const body = JSON.parse(String(init?.body)) as {
      params: { contextId?: string; message: { messageId: string } };
    };
    expect(body.params.contextId).toBe('ctx-wrapped');
    expect(body.params.message.messageId).toBe('wrapped-message');
  });

  it('streams task updates until a terminal state is received', async () => {
    const fetchSpy = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(
        JSON.stringify({
          jsonrpc: '2.0',
          id: '1',
          result: createTaskPayload('task-stream', 'working'),
        }),
        { status: 200 },
      ),
    );

    const client = new A2AClient('http://localhost:3000', {
      fetchImplementation: fetchSpy,
      eventSourceImplementation,
      headers: { authorization: 'Bearer token' },
    });

    const stream = await client.sendMessageStream({
      role: 'user',
      parts: [{ type: 'text', text: 'stream please' }],
      messageId: 'message-stream',
      timestamp: new Date().toISOString(),
    });

    const collectedPromise = (async () => {
      const states: string[] = [];
      for await (const update of stream) {
        const task = update as { status?: { state?: string } };
        if (task.status?.state) {
          states.push(task.status.state);
        }
      }
      return states;
    })();

    await Promise.resolve();
    const source = MockEventSource.instances[0];
    if (!source) {
      throw new Error('Expected a mocked EventSource instance');
    }
    source.emit('task_updated', createTaskPayload('task-stream', 'working'));
    source.emit('task_updated', createTaskPayload('task-stream', 'completed'));

    await expect(collectedPromise).resolves.toEqual(['working', 'completed']);
    expect(source.closed).toBe(true);
    expect(source.options?.headers).toEqual({ authorization: 'Bearer token' });
  });

  it('closes the stream when the EventSource errors before emitting data', async () => {
    const fetchSpy = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(
        JSON.stringify({
          jsonrpc: '2.0',
          id: '1',
          result: createTaskPayload('task-error', 'working'),
        }),
        { status: 200 },
      ),
    );

    const client = new A2AClient('http://localhost:3000', {
      fetchImplementation: fetchSpy,
      eventSourceImplementation,
    });

    const stream = await client.sendMessageStream({
      role: 'user',
      parts: [{ type: 'text', text: 'fail the stream' }],
      messageId: 'message-stream-error',
      timestamp: new Date().toISOString(),
    });

    const nextItem = stream.next();
    await Promise.resolve();
    const source = MockEventSource.instances[0];
    if (!source?.onerror) {
      throw new Error('Expected stream error handler to be registered');
    }
    source.onerror();

    await expect(nextItem).resolves.toEqual({
      done: true,
      value: undefined,
    });
    expect(source.closed).toBe(true);
  });
});
