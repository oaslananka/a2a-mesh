import { randomUUID } from 'node:crypto';
import {
  A2AClient,
  AgentRegistryClient,
  type A2AClientOptions,
  type Message,
  type RegisteredAgent,
  type Task,
} from 'a2a-mesh';

export interface CodexToolDefinition<TInput = unknown, TOutput = unknown> {
  name: string;
  title?: string;
  description?: string;
  inputSchema: Record<string, unknown>;
  execute(input: TInput, context?: CodexToolExecutionContext): Promise<TOutput>;
}

export interface CodexToolExecutionContext {
  onProgress?(message: string): void | Promise<void>;
}

export interface A2ASendMessageToolInput {
  text: string;
  contextId?: string;
}

export interface A2ASendMessageToolOutput {
  taskId: string;
  contextId?: string;
  state: string;
  output: string;
  task: Task;
}

export interface CreateA2ASendMessageToolOptions {
  name: string;
  title?: string;
  description: string;
  agentUrl: string;
  clientOptions?: A2AClientOptions;
  messageFactory?(input: A2ASendMessageToolInput): Message;
  outputMapper?(task: Task): A2ASendMessageToolOutput;
}

export interface ListRegistryAgentsToolInput {
  query?: string;
  tag?: string;
  name?: string;
}

export interface ListRegistryAgentsToolOutput {
  total: number;
  agents: Array<{
    id: string;
    name: string;
    description: string;
    url: string;
    status: 'healthy' | 'unhealthy' | 'unknown';
    skills: string[];
    tags: string[];
  }>;
}

export interface CreateRegistryToolOptions {
  name: string;
  title?: string;
  description: string;
  registryUrl: string;
  fetchImplementation?: typeof fetch;
}

function defaultInputSchema(): Record<string, unknown> {
  return {
    type: 'object',
    properties: {
      text: {
        type: 'string',
        description: 'The text request to forward to the A2A agent.',
      },
      contextId: {
        type: 'string',
        description: 'Optional A2A context identifier used to continue an existing task thread.',
      },
    },
    required: ['text'],
    additionalProperties: false,
  };
}

function registryInputSchema(): Record<string, unknown> {
  return {
    type: 'object',
    properties: {
      query: {
        type: 'string',
        description: 'Optional skill query used when searching the registry.',
      },
      tag: {
        type: 'string',
        description: 'Optional tag filter used together with a search query.',
      },
      name: {
        type: 'string',
        description: 'Optional name filter used together with a search query.',
      },
    },
    additionalProperties: false,
  };
}

function defaultMessageFactory(input: A2ASendMessageToolInput): Message {
  return {
    role: 'user',
    parts: [{ type: 'text', text: input.text }],
    messageId: `codex-${randomUUID()}`,
    timestamp: new Date().toISOString(),
  };
}

function extractTaskText(task: Task): string {
  return (task.artifacts ?? [])
    .flatMap((artifact) => artifact.parts)
    .filter(
      (part): part is Extract<Message['parts'][number], { type: 'text' }> => part.type === 'text',
    )
    .map((part) => part.text)
    .join('\n')
    .trim();
}

function defaultOutputMapper(task: Task): A2ASendMessageToolOutput {
  return {
    taskId: task.id,
    ...(task.contextId ? { contextId: task.contextId } : {}),
    state: task.status.state,
    output: extractTaskText(task),
    task,
  };
}

export function createA2ASendMessageTool(
  options: CreateA2ASendMessageToolOptions,
): CodexToolDefinition<A2ASendMessageToolInput, A2ASendMessageToolOutput> {
  return {
    name: options.name,
    ...(options.title ? { title: options.title } : {}),
    description: options.description,
    inputSchema: defaultInputSchema(),
    async execute(input, context) {
      const client = new A2AClient(options.agentUrl, options.clientOptions);
      await context?.onProgress?.(`Connecting to ${options.agentUrl}`);
      const task = await client.sendMessage({
        message: (options.messageFactory ?? defaultMessageFactory)(input),
        ...(input.contextId ? { contextId: input.contextId } : {}),
      });
      await context?.onProgress?.(`Task ${task.id} finished with state ${task.status.state}`);
      return (options.outputMapper ?? defaultOutputMapper)(task);
    },
  };
}

export function createRegistryListTool(
  options: CreateRegistryToolOptions,
): CodexToolDefinition<ListRegistryAgentsToolInput, ListRegistryAgentsToolOutput> {
  return {
    name: options.name,
    ...(options.title ? { title: options.title } : {}),
    description: options.description,
    inputSchema: registryInputSchema(),
    async execute(input, context) {
      const client = new AgentRegistryClient(options.registryUrl, options.fetchImplementation);
      await context?.onProgress?.(`Fetching agents from ${options.registryUrl}`);

      const agents = input.query
        ? await client.searchAgents(input.query, {
            ...(input.tag ? { tag: input.tag } : {}),
            ...(input.name ? { name: input.name } : {}),
          })
        : await client.listAgents();

      return {
        total: agents.length,
        agents: agents.map((agent: RegisteredAgent) => ({
          id: agent.id,
          name: agent.card.name,
          description: agent.card.description,
          url: agent.url,
          status: agent.status,
          skills: agent.skills,
          tags: agent.tags,
        })),
      };
    },
  };
}
