import request from 'supertest';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { AgentCard, Task } from 'a2a-mesh';
import { RegistryServer } from '../src/RegistryServer.js';

function createAgentCard(name: string): AgentCard {
  return {
    protocolVersion: '1.0',
    name,
    description: `${name} description`,
    version: '1.0.0',
    url: 'http://localhost:0',
    capabilities: {
      streaming: true,
      pushNotifications: false,
      stateTransitionHistory: true,
      extendedAgentCard: false,
      mcpCompatible: true,
    },
    skills: [
      {
        id: `${name.toLowerCase().replace(/\s+/g, '-')}-skill`,
        name: 'Research',
        description: 'Searches, analyzes and summarizes information',
        tags: ['research', 'analysis'],
        examples: [],
        inputModes: ['text'],
        outputModes: ['text'],
      },
    ],
    defaultInputModes: ['text'],
    defaultOutputModes: ['text'],
    securitySchemes: [],
  };
}

function createTask(
  id: string,
  status: Task['status']['state'],
  timestamp: string,
  summary: string,
): Task {
  return {
    id,
    status: {
      state: status,
      timestamp,
    },
    history: [
      {
        role: 'user',
        messageId: `message-${id}`,
        timestamp,
        parts: [{ type: 'text', text: `history ${id}` }],
      },
    ],
    artifacts: [
      {
        artifactId: `artifact-${id}`,
        index: 0,
        lastChunk: true,
        parts: [{ type: 'text', text: summary }],
      },
    ],
  };
}

function toUrl(input: RequestInfo | URL): string {
  if (typeof input === 'string') {
    return input;
  }

  if (input instanceof URL) {
    return input.toString();
  }

  return input.url;
}

describe('RegistryServer control plane endpoints', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('returns metrics summary with registration, search, heartbeat and tenant counts', async () => {
    const server = new RegistryServer({ allowLocalhost: true });

    const registerResponse = await request(server['app'])
      .post('/agents/register')
      .send({
        agentUrl: 'http://localhost:3001',
        agentCard: createAgentCard('Metrics Agent'),
        tenantId: 'tenant-metrics',
        isPublic: true,
      });

    expect(registerResponse.status).toBe(201);

    const agentId = registerResponse.body.id as string;
    await request(server['app']).get('/agents/search').query({ name: 'metrics' }).expect(200);
    await request(server['app']).post(`/agents/${agentId}/heartbeat`).expect(200);

    const response = await request(server['app']).get('/metrics/summary');

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      registrations: 1,
      searches: 1,
      heartbeats: 1,
      agentCount: 1,
      healthyAgents: 1,
      unhealthyAgents: 0,
      unknownAgents: 0,
      activeTenants: 1,
      publicAgents: 1,
    });
  });

  it('aggregates recent tasks across registered agents for the control plane', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
      const url = toUrl(input);

      if (url === 'http://localhost:3001/tasks?limit=20') {
        return new Response(
          JSON.stringify([
            createTask(
              'task-researcher',
              'working',
              '2026-04-06T10:00:00.000Z',
              'Researcher is collecting source material.',
            ),
          ]),
          {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          },
        );
      }

      if (url === 'http://localhost:3002/tasks?limit=20') {
        return new Response(
          JSON.stringify([
            createTask(
              'task-writer',
              'completed',
              '2026-04-06T10:05:00.000Z',
              'Writer produced a polished final report.',
            ),
          ]),
          {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          },
        );
      }

      return new Response('Not found', { status: 404 });
    });

    const server = new RegistryServer({
      allowLocalhost: true,
      taskPollingIntervalMs: 60_000,
      maxRecentTasks: 10,
    });

    await request(server['app'])
      .post('/agents/register')
      .send({
        agentUrl: 'http://localhost:3001',
        agentCard: createAgentCard('Researcher Agent'),
      });
    await request(server['app'])
      .post('/agents/register')
      .send({
        agentUrl: 'http://localhost:3002',
        agentCard: createAgentCard('Writer Agent'),
      });

    const response = await request(server['app']).get('/tasks/recent').query({ limit: 2 });

    expect(response.status).toBe(200);
    expect(fetchSpy).toHaveBeenCalledTimes(2);
    expect(response.body).toHaveLength(2);
    expect(response.body[0]).toMatchObject({
      taskId: 'task-writer',
      agentName: 'Writer Agent',
      agentUrl: 'http://localhost:3002',
      status: 'completed',
      updatedAt: '2026-04-06T10:05:00.000Z',
      summary: 'Writer produced a polished final report.',
      historyCount: 1,
      artifactCount: 1,
    });
    expect(response.body[1]).toMatchObject({
      taskId: 'task-researcher',
      agentName: 'Researcher Agent',
      agentUrl: 'http://localhost:3001',
      status: 'working',
      updatedAt: '2026-04-06T10:00:00.000Z',
      summary: 'Researcher is collecting source material.',
      historyCount: 1,
      artifactCount: 1,
    });

    const limited = await request(server['app']).get('/tasks/recent').query({ limit: 1 });
    expect(limited.status).toBe(200);
    expect(limited.body).toHaveLength(1);
    expect(limited.body[0].taskId).toBe('task-writer');
  });
});
