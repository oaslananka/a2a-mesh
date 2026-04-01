import { describe, expect, it, vi } from 'vitest';
import { LlamaIndexAdapter } from '../src/llamaindex/LlamaIndexAdapter.js';
import type { AnyAgentCard, Message, Task } from 'a2a-mesh';

describe('LlamaIndexAdapter', () => {
  it('supports query engines', async () => {
    const card: AnyAgentCard = {
      protocolVersion: '1.0',
      name: 'Llama',
      description: 'desc',
      url: 'http://test',
      version: '1.0',
    };
    const engine = {
      query: vi.fn().mockResolvedValue({
        response: 'query response',
        sourceNodes: [{ score: 0.9, node: { metadata: { source: 'doc-1' } } }],
      }),
    };

    const adapter = new LlamaIndexAdapter(card, engine);
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
    expect(artifacts[0]?.parts[0]).toEqual({ type: 'text', text: 'query response' });
  });

  it('supports chat engines', async () => {
    const card: AnyAgentCard = {
      protocolVersion: '1.0',
      name: 'Llama Chat',
      description: 'desc',
      url: 'http://test',
      version: '1.0',
    };
    const engine = {
      chat: vi.fn().mockResolvedValue({
        response: 'chat response',
        sourceNodes: [],
      }),
    };

    const adapter = new LlamaIndexAdapter(card, engine);
    const task: Task = {
      id: 'task-1',
      status: { state: 'working', timestamp: '' },
      history: [],
    };
    const message: Message = {
      role: 'user',
      parts: [{ type: 'text', text: 'hello' }],
      messageId: 'msg-1',
      timestamp: '',
    };

    const artifacts = await adapter.handleTask(task, message);
    expect(artifacts[0]?.parts[0]).toEqual({ type: 'text', text: 'chat response' });
  });

  it('throws when chat engine returns an async iterable', async () => {
    const card: AnyAgentCard = {
      protocolVersion: '1.0',
      name: 'Llama Chat',
      description: 'desc',
      url: 'http://test',
      version: '1.0',
    };
    const engine = {
      chat: vi.fn().mockResolvedValue({
        async *[Symbol.asyncIterator]() {
          yield { response: 'chunk' };
        },
      }),
    };

    const adapter = new LlamaIndexAdapter(card, engine);
    await expect(
      adapter.handleTask(
        {
          id: 'task-1',
          status: { state: 'working', timestamp: '' },
          history: [],
        },
        {
          role: 'user',
          parts: [{ type: 'text', text: 'hello' }],
          messageId: 'msg-1',
          timestamp: '',
        },
      ),
    ).rejects.toThrow('Streaming LlamaIndex responses are not supported');
  });
});
