import { logger, type Artifact, type Message, type Task } from 'a2a-mesh';
import { BaseAdapter } from 'a2a-mesh-adapters';

export class ResearcherAgent extends BaseAdapter {
  constructor(url: string) {
    super({
      protocolVersion: '1.0',
      name: 'Researcher Agent',
      description: 'Finds factual information from web APIs',
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
          id: 'web-research',
          name: 'Web Research',
          description: 'Searches the web',
          tags: ['research'],
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
    logger.info(`Researcher processing task ${task.id}`);
    const query = message.parts.find((part) => part.type === 'text');
    if (!query) throw new Error('Requires text query');

    // Simulate API call to fetch data
    await new Promise((r) => setTimeout(r, 1000));

    const textOut = `Research findings for '${query.text}':
- TypeScript 5.0 introduces new decorators.
- Better enum performance.
- const type parameters.`;

    return [
      {
        artifactId: `res-${Date.now()}`,
        name: 'Research Findings',
        parts: [{ type: 'text', text: textOut }],
        index: 0,
        lastChunk: true,
      },
    ];
  }
}
