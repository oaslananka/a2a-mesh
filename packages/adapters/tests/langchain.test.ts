import { describe, it, expect, vi } from 'vitest';
import { LangChainAdapter } from '../src/langchain/LangChainAdapter.js';
import type { AnyAgentCard, Task, Message } from 'a2a-mesh';

describe('LangChainAdapter', () => {
  it('should map history and invoke the runnable', async () => {
    const card: AnyAgentCard = {
      protocolVersion: '1.0',
      name: 'LC',
      description: 'desc',
      url: 'http://test',
      version: '1.0',
    };

    const mockRunnable = {
      invoke: vi.fn().mockResolvedValue({
        messages: [{ role: 'assistant', content: 'hello from lc' }],
      }),
    };

    const adapter = new LangChainAdapter(card, mockRunnable);

    const task: Task = {
      id: 'task-1',
      status: { state: 'working', timestamp: '' },
      history: [
        {
          role: 'user',
          parts: [{ type: 'text', text: 'hi' }],
          messageId: 'msg-0',
          timestamp: '',
        },
      ],
    };

    const currentMsg: Message = {
      role: 'user',
      parts: [{ type: 'text', text: 'whats up' }],
      messageId: 'msg-1',
      timestamp: '',
    };

    const artifacts = await adapter.handleTask(task, currentMsg);

    expect(mockRunnable.invoke).toHaveBeenCalledWith({
      messages: [
        { role: 'user', content: 'hi' },
        { role: 'user', content: 'whats up' },
      ],
    });
    expect(artifacts.length).toBe(1);
    expect((artifacts[0].parts[0] as any).text).toBe('hello from lc');
  });
});
