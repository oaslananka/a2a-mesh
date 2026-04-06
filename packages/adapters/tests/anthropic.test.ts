import { describe, expect, it, vi } from 'vitest';
import { AnthropicAdapter } from '../src/anthropic/AnthropicAdapter.js';
import type { AnyAgentCard, Message, Task } from 'a2a-mesh';

describe('AnthropicAdapter', () => {
  it('maps messages and returns content plus usage metadata', async () => {
    const card: AnyAgentCard = {
      protocolVersion: '1.0',
      name: 'Claude',
      description: 'desc',
      url: 'http://test',
      version: '1.0',
    };
    const client = {
      messages: {
        create: vi.fn().mockResolvedValue({
          content: [{ type: 'text', text: 'hello from claude' }],
          usage: { input_tokens: 12, output_tokens: 34 },
        }),
      },
    };

    const adapter = new AnthropicAdapter(card, client);
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
    expect(artifacts[0]?.parts[0]).toEqual({ type: 'text', text: 'hello from claude' });
  });

  it('supports streaming responses', async () => {
    const card: AnyAgentCard = {
      protocolVersion: '1.0',
      name: 'Claude',
      description: 'desc',
      url: 'http://test',
      version: '1.0',
    };
    const stream = {
      async *[Symbol.asyncIterator]() {
        yield { type: 'content_block_delta', delta: { type: 'text_delta', text: 'hi' } };
      },
    };
    const client = {
      messages: {
        create: vi.fn().mockResolvedValue(stream),
      },
    };

    const adapter = new AnthropicAdapter(card, client);
    const task: Task = {
      id: 'task-1',
      status: { state: 'working', timestamp: '' },
      history: [],
      metadata: { stream: true },
    };
    const message: Message = {
      role: 'user',
      parts: [{ type: 'text', text: 'hi' }],
      messageId: 'msg-1',
      timestamp: '',
    };

    const artifacts = await adapter.handleTask(task, message);
    expect(artifacts[0]?.parts[0]).toEqual({ type: 'text', text: 'hi' });
  });
});
