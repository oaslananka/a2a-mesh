import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { randomUUID } from 'node:crypto';
import { A2AServer } from '../../packages/core/src/server/A2AServer.js';
import { A2AClient } from '../../packages/core/src/client/A2AClient.js';
import { ErrorCodes } from '../../packages/core/src/types/jsonrpc.js';
import type { Artifact, Message, Task } from '../../packages/core/src/types/task.js';
import {
  createUserMessage,
  postJsonRpc,
  readTextArtifacts,
  startTestServer,
  type StartedServer,
  waitForTaskState,
} from './helpers.js';

class ResearcherAgent extends A2AServer {
  constructor() {
    super({
      protocolVersion: '1.0',
      name: 'Researcher',
      description: 'Agent responsible for research tasks',
      url: 'http://localhost:0',
      version: '1.0.0',
      capabilities: { streaming: false, pushNotifications: false },
    });
  }

  async handleTask(_task: Task, message: Message): Promise<Artifact[]> {
    const query = message.parts.find((part) => part.type === 'text');
    return [
      {
        artifactId: 'research-result',
        parts: [
          {
            type: 'text',
            text: `Research findings for: "${query?.type === 'text' ? query.text : ''}" — [mock data]`,
          },
        ],
        index: 0,
        lastChunk: true,
      },
    ];
  }
}

class WriterAgent extends A2AServer {
  constructor() {
    super({
      protocolVersion: '1.0',
      name: 'Writer',
      description: 'Agent responsible for writing content',
      url: 'http://localhost:0',
      version: '1.0.0',
      capabilities: { streaming: false, pushNotifications: false },
    });
  }

  async handleTask(_task: Task, message: Message): Promise<Artifact[]> {
    const input = message.parts.find((part) => part.type === 'text');
    return [
      {
        artifactId: 'written-content',
        parts: [
          {
            type: 'text',
            text: `## Article\n\nBased on: ${input?.type === 'text' ? input.text : ''}`,
          },
        ],
        index: 0,
        lastChunk: true,
      },
    ];
  }
}

class OrchestratorAgent extends A2AServer {
  constructor(
    private readonly researcherUrl: string,
    private readonly writerUrl: string,
  ) {
    super({
      protocolVersion: '1.0',
      name: 'Orchestrator',
      description: 'Pipeline orchestrator agent',
      url: 'http://localhost:0',
      version: '1.0.0',
      capabilities: { streaming: false, pushNotifications: false },
    });
  }

  async handleTask(task: Task, message: Message): Promise<Artifact[]> {
    const contextId = task.contextId ?? 'pipeline-test';
    const sourceText = message.parts.find((part) => part.type === 'text');
    const researcherClient = new A2AClient(this.researcherUrl);
    const researcherTask = await researcherClient.sendMessage({
      message: createUserMessage(sourceText?.type === 'text' ? sourceText.text : '', {
        contextId,
      }),
      contextId,
    });
    const completedResearch = await waitForTaskState(researcherClient, researcherTask.id, [
      'completed',
    ]);
    const researchText = readTextArtifacts(completedResearch);

    const writerClient = new A2AClient(this.writerUrl);
    const writerTask = await writerClient.sendMessage({
      message: createUserMessage(researchText, { contextId }),
      contextId,
    });
    const completedWriter = await waitForTaskState(writerClient, writerTask.id, ['completed']);

    return completedWriter.artifacts ?? [];
  }
}

describe('Multi-Agent Pipeline Integration', () => {
  const handles: StartedServer[] = [];
  let researcherUrl = '';
  let writerUrl = '';
  let orchestratorUrl = '';

  beforeAll(async () => {
    const researcher = await startTestServer(new ResearcherAgent());
    const writer = await startTestServer(new WriterAgent());
    const orchestrator = await startTestServer(new OrchestratorAgent(researcher.url, writer.url));

    researcherUrl = researcher.url;
    writerUrl = writer.url;
    orchestratorUrl = orchestrator.url;
    handles.push(researcher, writer, orchestrator);
  });

  afterAll(async () => {
    await Promise.all(handles.map((handle) => handle.close()));
  });

  it('pipeline: orchestrator → researcher → writer → artifact', async () => {
    const client = new A2AClient(orchestratorUrl);
    const createdTask = await client.sendMessage({
      message: createUserMessage('TypeScript best practices 2026'),
      contextId: 'integration-test-1',
    });

    const task = await waitForTaskState(client, createdTask.id, ['completed'], 15000);
    expect(task.status.state).toBe('completed');
    expect(task.artifacts?.length ?? 0).toBeGreaterThan(0);
    expect(readTextArtifacts(task)).toContain('Article');
  }, 15000);

  it('preserves contextId across downstream agents', async () => {
    const contextId = `ctx-${randomUUID()}`;
    const client = new A2AClient(orchestratorUrl);

    const createdTask = await client.sendMessage({
      message: createUserMessage('Context propagation test'),
      contextId,
    });

    const task = await waitForTaskState(client, createdTask.id, ['completed'], 15000);
    expect(task.contextId).toBe(contextId);
    expect(task.status.state).toBe('completed');
  }, 15000);

  it('returns an A2A v1.0 compliant agent card', async () => {
    const client = new A2AClient(orchestratorUrl);
    const card = await client.resolveCard();

    expect(card.protocolVersion).toBe('1.0');
    expect(card.name).toBe('Orchestrator');
    expect(card.capabilities).toBeDefined();
    expect(typeof card.version).toBe('string');
  });

  it('returns a JsonRpcError for unknown RPC methods', async () => {
    const body = await postJsonRpc<{ error: { code: number } }>(orchestratorUrl, 'unknown/method');
    expect(body.error).toBeDefined();
    expect(body.error.code).toBe(ErrorCodes.MethodNotFound);
  });

  it('downstream agents are reachable', async () => {
    const researcherCard = await new A2AClient(researcherUrl).resolveCard();
    const writerCard = await new A2AClient(writerUrl).resolveCard();

    expect(researcherCard.name).toBe('Researcher');
    expect(writerCard.name).toBe('Writer');
  });
});
