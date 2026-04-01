import { afterEach, describe, expect, it, vi } from 'vitest';
import { CrewAIAdapter } from '../src/crewai/CrewAIAdapter.js';
import type { AnyAgentCard, Message, Task } from 'a2a-mesh';

describe('CrewAIAdapter', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('maps bridge JSON responses into artifacts', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ output: 'crewai response' }), { status: 200 }),
    );

    const card: AnyAgentCard = {
      protocolVersion: '1.0',
      name: 'Crew',
      description: 'desc',
      url: 'http://test',
      version: '1.0',
    };
    const adapter = new CrewAIAdapter(card, 'https://example.com/bridge');
    const task: Task = {
      id: 'task-1',
      status: { state: 'working', timestamp: '' },
      history: [],
    };
    const message: Message = {
      role: 'user',
      parts: [{ type: 'text', text: 'hi' }],
      messageId: 'msg-1',
      timestamp: '',
    };

    const artifacts = await adapter.handleTask(task, message);
    expect(artifacts[0]?.parts[0]).toEqual({ type: 'text', text: 'crewai response' });
  });
});
