import type { Server } from 'node:http';
import {
  A2AServer,
  type A2AServerOptions,
  type A2AClientOptions,
  type AgentCard,
  type Artifact,
  type Message,
  type Task,
} from 'a2a-mesh';
import { createTestAgentCard } from './fixtures/agent-cards.js';
import { MockA2AClient } from './MockA2AClient.js';

export type TestTaskHandler = (task: Task, message: Message) => Promise<Artifact[]>;

export interface A2ATestServerOptions extends A2AServerOptions {
  card?: Partial<AgentCard>;
  handler?: TestTaskHandler;
}

const defaultHandler: TestTaskHandler = async (_task, message) => {
  const textPart = message.parts.find((part) => part.type === 'text');
  return [
    {
      artifactId: 'test-artifact',
      parts: [{ type: 'text', text: textPart?.type === 'text' ? textPart.text : 'empty' }],
      index: 0,
      lastChunk: true,
    },
  ];
};

class TestHarnessServer extends A2AServer {
  constructor(
    card: AgentCard,
    options: A2AServerOptions,
    private readonly handler: TestTaskHandler,
  ) {
    super(card, options);
  }

  async handleTask(task: Task, message: Message): Promise<Artifact[]> {
    return this.handler(task, message);
  }

  getTask(taskId: string): Task | undefined {
    return this.taskManager.getTask(taskId);
  }
}

export class A2ATestServer {
  private readonly server: TestHarnessServer;
  private listener: Server | undefined;

  constructor(options: A2ATestServerOptions = {}) {
    this.server = new TestHarnessServer(
      createTestAgentCard(options.card),
      options,
      options.handler ?? defaultHandler,
    );
  }

  async start(port = 0): Promise<number> {
    if (!this.listener) {
      this.listener = this.server.start(port);
      await new Promise<void>((resolve) => {
        this.listener?.once('listening', () => resolve());
      });
    }

    return this.port;
  }

  async stop(): Promise<void> {
    if (!this.listener) {
      return;
    }

    await new Promise<void>((resolve, reject) => {
      this.listener?.close((error) => {
        if (error) {
          reject(error);
          return;
        }
        resolve();
      });
    });
    this.listener = undefined;
  }

  get port(): number {
    if (!this.listener) {
      throw new Error('A2ATestServer has not been started yet');
    }

    const address = this.listener.address();
    if (!address || typeof address === 'string') {
      throw new Error('A2ATestServer is not bound to a TCP port');
    }

    return address.port;
  }

  get url(): string {
    return `http://127.0.0.1:${this.port}`;
  }

  client(options: A2AClientOptions = {}): MockA2AClient {
    return MockA2AClient.fromServer(this, options);
  }

  getTask(taskId: string): Task | undefined {
    return this.server.getTask(taskId);
  }
}
