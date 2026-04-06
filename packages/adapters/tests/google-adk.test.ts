import { afterEach, describe, expect, it, vi } from 'vitest';
import { GoogleADKAdapter } from '../src/google-adk/GoogleADKAdapter.js';
import type { AnyAgentCard, Message, Task } from 'a2a-mesh';

describe('GoogleADKAdapter', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('maps HTTP JSON responses into artifacts', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ output: 'google adk' }), { status: 200 }),
    );

    const card: AnyAgentCard = {
      protocolVersion: '1.0',
      name: 'ADK',
      description: 'desc',
      url: 'http://test',
      version: '1.0',
    };
    const adapter = new GoogleADKAdapter(card, 'https://example.com/adk');
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
    expect(artifacts[0]?.parts[0]).toEqual({ type: 'text', text: 'google adk' });
  });

  it('maps event-stream responses into artifacts', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response('data: hello\ndata: world\n', {
        status: 200,
        headers: { 'Content-Type': 'text/event-stream' },
      }),
    );

    const card: AnyAgentCard = {
      protocolVersion: '1.0',
      name: 'ADK',
      description: 'desc',
      url: 'http://test',
      version: '1.0',
    };
    const adapter = new GoogleADKAdapter(card, 'https://example.com/adk');
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
    expect(artifacts[0]?.parts[0]).toEqual({ type: 'text', text: 'hello\nworld' });
  });
});
