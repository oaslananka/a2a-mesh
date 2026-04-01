import { describe, expect, it, vi } from 'vitest';
import { createA2ASendMessageTool, createRegistryListTool } from '../src/index.js';

describe('a2a-mesh-codex-bridge', () => {
  it('creates a send-message tool that maps A2A task output into tool output', async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          jsonrpc: '2.0',
          id: '1',
          result: {
            id: 'task-1',
            contextId: 'ctx-1',
            status: { state: 'completed', timestamp: new Date().toISOString() },
            history: [],
            artifacts: [
              {
                artifactId: 'artifact-1',
                parts: [{ type: 'text', text: 'Bridge output' }],
                index: 0,
                lastChunk: true,
              },
            ],
          },
        }),
        { status: 200 },
      ),
    );

    const tool = createA2ASendMessageTool({
      name: 'ask_agent',
      description: 'Send a text task to an A2A agent.',
      agentUrl: 'http://localhost:3100',
      clientOptions: { fetchImplementation: fetchMock },
    });

    const progress = vi.fn();
    const result = await tool.execute(
      { text: 'hello', contextId: 'ctx-1' },
      { onProgress: progress },
    );

    expect(result.taskId).toBe('task-1');
    expect(result.contextId).toBe('ctx-1');
    expect(result.state).toBe('completed');
    expect(result.output).toBe('Bridge output');
    expect(progress).toHaveBeenCalledTimes(2);
  });

  it('creates a registry list tool that can list agents without a search query', async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValueOnce(
      new Response(
        JSON.stringify([
          {
            id: 'agent-1',
            url: 'http://localhost:3101',
            status: 'healthy',
            tags: ['research'],
            skills: ['Web Research'],
            registeredAt: new Date().toISOString(),
            card: {
              protocolVersion: '1.0',
              name: 'Researcher Agent',
              description: 'Finds factual information',
              url: 'http://localhost:3101',
              version: '1.0.0',
              capabilities: { streaming: true, pushNotifications: false },
              defaultInputModes: ['text'],
              defaultOutputModes: ['text'],
              securitySchemes: [],
            },
          },
        ]),
        { status: 200 },
      ),
    );

    const tool = createRegistryListTool({
      name: 'list_agents',
      description: 'List agents from the registry.',
      registryUrl: 'http://localhost:3099',
      fetchImplementation: fetchMock,
    });

    const result = await tool.execute({});
    expect(result.total).toBe(1);
    expect(result.agents[0]?.name).toBe('Researcher Agent');
    expect(result.agents[0]?.status).toBe('healthy');
  });
});
