/**
 * @file A2AClient.ts
 * Basic HTTP + SSE client for A2A-compatible agents.
 */

import EventSource from 'eventsource';
import type { AgentCard } from '../types/agent-card.js';
import type {
  JsonRpcFailureResponse,
  JsonRpcResponse,
  JsonRpcSuccessResponse,
} from '../types/jsonrpc.js';
import type {
  A2AHealthResponse,
  Message,
  MessageSendParams,
  PushNotificationConfig,
  Task,
  TaskListParams,
  TaskListResult,
} from '../types/task.js';
import type { AfterArgs, CallInterceptor, ClientCallOptions } from './interceptors.js';

export interface A2AClientOptions {
  fetchImplementation?: typeof fetch;
  cardPath?: string;
  rpcPath?: string;
  streamPath?: string;
  eventSourceImplementation?: typeof EventSource;
  interceptors?: CallInterceptor[];
  headers?: Record<string, string>;
  retry?: {
    maxAttempts?: number;
    backoffMs?: number;
    retryOn?: number[];
  };
}

interface RetryOptions {
  maxAttempts: number;
  backoffMs: number;
  retryOn: number[];
}

/**
 * HTTP and SSE client for interacting with A2A-compatible agents.
 *
 * @example
 * ```ts
 * const client = new A2AClient('http://localhost:3000');
 * const task = await client.sendMessage({
 *   role: 'user',
 *   parts: [{ type: 'text', text: 'Summarize this' }],
 *   messageId: crypto.randomUUID(),
 *   timestamp: new Date().toISOString(),
 * });
 * ```
 * @since 1.0.0
 */
export class A2AClient {
  private readonly fetchImplementation: typeof fetch;
  private readonly cardPath: string;
  private readonly rpcPath: string;
  private readonly streamPath: string;
  private readonly eventSourceImplementation: typeof EventSource;
  private readonly interceptors: CallInterceptor[];
  private readonly headers: Record<string, string>;
  private readonly retry: RetryOptions;

  constructor(
    public readonly baseUrl: string,
    options: A2AClientOptions = {},
  ) {
    this.fetchImplementation = options.fetchImplementation ?? fetch;
    this.cardPath = options.cardPath ?? '/.well-known/agent-card.json';
    this.rpcPath = options.rpcPath ?? '/a2a/jsonrpc';
    this.streamPath = options.streamPath ?? '/a2a/stream';
    this.eventSourceImplementation = options.eventSourceImplementation ?? EventSource;
    this.interceptors = options.interceptors ?? [];
    this.headers = options.headers ?? {};
    this.retry = {
      maxAttempts: options.retry?.maxAttempts ?? 3,
      backoffMs: options.retry?.backoffMs ?? 1000,
      retryOn: options.retry?.retryOn ?? [502, 503, 504],
    };
  }

  async resolveCard(): Promise<AgentCard> {
    const canonicalUrl = new URL(this.cardPath, this.baseUrl).toString();
    const legacyUrl = new URL('/.well-known/agent.json', this.baseUrl).toString();

    const response = await this.fetchWithRetry(canonicalUrl);
    if (response.ok) {
      return (await response.json()) as AgentCard;
    }

    const legacyResponse = await this.fetchWithRetry(legacyUrl);
    if (!legacyResponse.ok) {
      throw new Error(`Failed to resolve agent card from ${canonicalUrl}`);
    }

    return (await legacyResponse.json()) as AgentCard;
  }

  async sendMessage(params: Message | MessageSendParams): Promise<Task> {
    return this.rpc<Task, MessageSendParams>('message/send', this.normalizeParams(params));
  }

  async sendMessageStream(params: Message | MessageSendParams): Promise<AsyncGenerator<unknown>> {
    const task = await this.rpc<Task, MessageSendParams>(
      'message/stream',
      this.normalizeParams(params),
    );
    return this.subscribeToTask(task.id);
  }

  async getTask(taskId: string): Promise<Task> {
    return this.rpc<Task, { taskId: string }>('tasks/get', { taskId });
  }

  async listTasks(params: TaskListParams = {}): Promise<TaskListResult> {
    return this.rpc<TaskListResult, TaskListParams>('tasks/list', params);
  }

  async cancelTask(taskId: string): Promise<Task> {
    return this.rpc<Task, { taskId: string }>('tasks/cancel', { taskId });
  }

  async setPushNotification(
    taskId: string,
    pushNotificationConfig: PushNotificationConfig,
  ): Promise<PushNotificationConfig> {
    return this.rpc<
      PushNotificationConfig,
      { taskId: string; pushNotificationConfig: PushNotificationConfig }
    >('tasks/pushNotification/set', {
      taskId,
      pushNotificationConfig,
    });
  }

  async getPushNotification(taskId: string): Promise<PushNotificationConfig | null> {
    return this.rpc<PushNotificationConfig | null, { taskId: string }>(
      'tasks/pushNotification/get',
      {
        taskId,
      },
    );
  }

  async health(): Promise<A2AHealthResponse> {
    const response = await this.fetchWithRetry(new URL('/health', this.baseUrl), {
      headers: this.headers,
    });
    if (!response.ok) {
      throw new Error(`Health check failed with status ${response.status}`);
    }
    return (await response.json()) as A2AHealthResponse;
  }

  private async rpc<T, TParams extends object>(method: string, params: TParams): Promise<T> {
    const options: ClientCallOptions = { headers: { ...this.headers } };
    const payload = {
      jsonrpc: '2.0' as const,
      id: `${Date.now()}`,
      method,
      params,
    };

    for (const interceptor of this.interceptors) {
      await interceptor.before({ method, body: payload, options });
    }

    const response = await this.fetchWithRetry(new URL(this.rpcPath, this.baseUrl), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(options.headers ?? {}),
        ...(options.serviceParameters ?? {}),
      },
      ...(options.signal ? { signal: options.signal } : {}),
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      throw new Error(`RPC request failed with status ${response.status}`);
    }

    const json = (await response.json()) as JsonRpcResponse<T>;
    if ('error' in json) {
      const failure = json as JsonRpcFailureResponse;
      throw new Error(`${failure.error.message} (${failure.error.code})`);
    }

    const success = json as JsonRpcSuccessResponse<T>;
    for (const interceptor of this.interceptors) {
      await interceptor.after?.({ method, response: success.result } satisfies AfterArgs<T>);
    }
    return success.result;
  }

  private normalizeParams(params: Message | MessageSendParams): MessageSendParams {
    if ('message' in params) {
      return params;
    }

    return { message: params };
  }

  private async *subscribeToTask(taskId: string): AsyncGenerator<unknown> {
    const streamUrl = new URL(this.streamPath, this.baseUrl);
    streamUrl.searchParams.set('taskId', taskId);

    const queue: unknown[] = [];
    let resolveNext: (() => void) | undefined;
    let closed = false;

    const source = new this.eventSourceImplementation(streamUrl.toString(), {
      headers: this.headers,
    });

    const push = (data: unknown): void => {
      queue.push(data);
      resolveNext?.();
    };

    source.addEventListener('task_updated', (event) => {
      const data = 'data' in event ? JSON.parse(String(event.data)) : null;
      push(data);
      if (
        data &&
        typeof data === 'object' &&
        'status' in data &&
        typeof data.status === 'object' &&
        data.status !== null &&
        'state' in data.status &&
        ['completed', 'failed', 'canceled'].includes(String(data.status.state))
      ) {
        closed = true;
        source.close();
        resolveNext?.();
      }
    });

    source.onerror = () => {
      closed = true;
      source.close();
      resolveNext?.();
    };

    try {
      while (!closed || queue.length > 0) {
        if (queue.length === 0) {
          await new Promise<void>((resolve) => {
            resolveNext = resolve;
          });
          resolveNext = undefined;
        }

        const next = queue.shift();
        if (next !== undefined) {
          yield next;
        }
      }
    } finally {
      source.close();
    }
  }

  private async fetchWithRetry(
    input: Parameters<typeof fetch>[0],
    init?: Parameters<typeof fetch>[1],
  ): Promise<Response> {
    let lastError: unknown;

    for (let attempt = 1; attempt <= this.retry.maxAttempts; attempt += 1) {
      try {
        const response = await this.fetchImplementation(input, init);
        if (
          response.ok ||
          attempt === this.retry.maxAttempts ||
          !this.retry.retryOn.includes(response.status)
        ) {
          return response;
        }
      } catch (error) {
        lastError = error;
        if (attempt === this.retry.maxAttempts) {
          throw error;
        }
      }

      await new Promise<void>((resolve) => {
        setTimeout(resolve, this.retry.backoffMs * attempt);
      });
    }

    throw new Error(
      `Request failed after ${this.retry.maxAttempts} attempts: ${String(lastError)}`,
    );
  }
}
