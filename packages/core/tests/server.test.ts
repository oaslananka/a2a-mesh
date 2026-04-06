import { describe, it, expect } from 'vitest';
import { A2AServer } from '../src/server/A2AServer.js';
import type { Artifact, Message, Task } from '../src/types/task.js';

class MockServer extends A2AServer {
  constructor() {
    super({
      protocolVersion: '1.0',
      name: 'Mock Agent',
      description: 'A mock agent for testing',
      url: 'http://localhost:3000',
      provider: { name: 'Test', url: 'http://test.com' },
      version: '1.0.0',
      capabilities: {
        streaming: true,
        pushNotifications: false,
        stateTransitionHistory: true,
        extendedAgentCard: false,
      },
      skills: [],
      defaultInputModes: ['text'],
      defaultOutputModes: ['text'],
      securitySchemes: [],
    });
  }

  async handleTask(_task: Task, _message: Message): Promise<Artifact[]> {
    return [
      {
        artifactId: 'art-1',
        parts: [{ type: 'text', text: 'mock output' }],
        index: 0,
        lastChunk: true,
      },
    ];
  }
}

describe('A2AServer', () => {
  it('should create an instance', () => {
    const server = new MockServer();
    expect(server).toBeInstanceOf(A2AServer);
  });
});
