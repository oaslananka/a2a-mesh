import { describe, it, expect, vi } from 'vitest';
import { OpenAIAdapter } from '../src/openai/OpenAIAdapter.js';
import type { AnyAgentCard, Task, Message } from 'a2a-mesh';

describe('OpenAIAdapter', () => {
  it('should map history and invoke chat completions', async () => {
    const card: AnyAgentCard = {
      protocolVersion: '1.0',
      name: 'OAI',
      description: 'desc',
      url: 'http://test',
      version: '1.0',
    };

    const mockOpenAIClient = {
      chat: {
        completions: {
          create: vi.fn().mockResolvedValue({
            choices: [{ message: { content: 'hello from openai' } }],
          }),
        },
      },
    };

    const adapter = new OpenAIAdapter(
      card,
      mockOpenAIClient as any,
      'gpt-4o',
      'You are a test bot.',
    );

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

    expect(mockOpenAIClient.chat.completions.create).toHaveBeenCalledWith({
      model: 'gpt-4o',
      messages: [
        { role: 'system', content: 'You are a test bot.' },
        { role: 'user', content: 'hi' },
        { role: 'user', content: 'whats up' },
      ],
    });
    expect(artifacts.length).toBe(1);
    const firstArtifact = artifacts[0];
    if (!firstArtifact) {
      throw new Error('Expected one artifact');
    }
    const firstPart = firstArtifact.parts[0];
    expect(firstPart).toEqual({ type: 'text', text: 'hello from openai' });
  });
});
