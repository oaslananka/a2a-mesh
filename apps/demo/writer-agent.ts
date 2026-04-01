import { logger, type Artifact, type Message, type Task } from 'a2a-mesh';
import { BaseAdapter } from 'a2a-mesh-adapters';

export class WriterAgent extends BaseAdapter {
  constructor(url: string) {
    super({
      protocolVersion: '1.0',
      name: 'Writer Agent',
      description: 'Creates markdown blog posts from research',
      url,
      provider: { name: 'DemoCorp', url: 'http://localhost' },
      version: '1.0.0',
      capabilities: {
        streaming: true,
        pushNotifications: false,
        stateTransitionHistory: true,
        extendedAgentCard: false,
      },
      skills: [
        {
          id: 'content-writing',
          name: 'Content Writing',
          description: 'Writes content',
          tags: ['writing'],
          examples: [],
          inputModes: ['text'],
          outputModes: ['text'],
        },
      ],
      defaultInputModes: ['text'],
      defaultOutputModes: ['text'],
      securitySchemes: [],
    });
  }

  async handleTask(task: Task, message: Message): Promise<Artifact[]> {
    logger.info(`Writer processing task ${task.id}`);
    const query = message.parts.find((part) => part.type === 'text');
    if (!query) throw new Error('Requires text query');

    await new Promise((r) => setTimeout(r, 1000));

    const textOut = `# Blog Post: TypeScript 5.0

Here are the amazing new features:
${query.text
  .split('\n')
  .filter((line) => line.startsWith('-'))
  .join('\n')}

Enjoy coding!`;

    return [
      {
        artifactId: `wrt-${Date.now()}`,
        name: 'Blog Post Draft',
        parts: [{ type: 'text', text: textOut }],
        index: 0,
        lastChunk: true,
      },
    ];
  }
}
