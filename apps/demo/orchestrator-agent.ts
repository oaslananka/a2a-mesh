import {
  A2AClient,
  AgentRegistryClient,
  logger,
  type Artifact,
  type Message,
  type Task,
} from 'a2a-mesh';
import { BaseAdapter } from 'a2a-mesh-adapters';

export class OrchestratorAgent extends BaseAdapter {
  private registry: AgentRegistryClient;

  constructor(registryUrl: string, publicUrl: string) {
    super({
      protocolVersion: '1.0',
      name: 'Orchestrator Agent',
      description: 'Delegates tasks to specialists',
      url: publicUrl,
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
          id: 'orchestrate',
          name: 'Orchestration',
          description: 'Delegates',
          tags: ['delegate'],
          examples: [],
          inputModes: ['text'],
          outputModes: ['text'],
        },
      ],
      defaultInputModes: ['text'],
      defaultOutputModes: ['text'],
      securitySchemes: [],
    });
    this.registry = new AgentRegistryClient(registryUrl);
  }

  async handleTask(task: Task, message: Message): Promise<Artifact[]> {
    logger.info(`Orchestrator received task ${task.id}`);
    const query = message.parts.find((part) => part.type === 'text');
    if (!query) throw new Error('Requires text query');
    const input = query.text;

    const resAgents = await this.registry.searchAgents('research');
    const writerAgents = await this.registry.searchAgents('writing');

    if (!resAgents.length || !writerAgents.length) {
      throw new Error('Required specialists not found in registry');
    }

    const researchAgent = resAgents[0];
    const writerAgent = writerAgents[0];
    if (!researchAgent || !writerAgent) {
      throw new Error('Required specialists not found in registry');
    }

    const resClient = new A2AClient(researchAgent.url);
    const wClient = new A2AClient(writerAgent.url);

    // Delegate Research
    this.getTaskManager().updateTaskState(task.id, 'working', {
      role: 'agent',
      messageId: 'm1',
      timestamp: new Date().toISOString(),
      parts: [{ type: 'text', text: 'Delegating to Researcher...' }],
    });
    const resTask = await resClient.sendMessage({
      role: 'user',
      parts: [{ type: 'text', text: input }],
      messageId: `msg-${Date.now()}`,
      timestamp: new Date().toISOString(),
    });

    // Simple poll
    let resResult: Task | undefined;
    for (let i = 0; i < 10; i++) {
      resResult = await resClient.getTask(resTask.id);
      if (resResult?.status.state === 'completed') break;
      await new Promise((r) => setTimeout(r, 1000));
    }

    const researchPart = resResult?.artifacts?.[0]?.parts.find((part) => part.type === 'text');
    if (!researchPart) throw new Error('Research agent returned no text artifact');
    const findings = researchPart.text;

    // Delegate Writing
    this.getTaskManager().updateTaskState(task.id, 'working', {
      role: 'agent',
      messageId: 'm2',
      timestamp: new Date().toISOString(),
      parts: [{ type: 'text', text: 'Delegating to Writer...' }],
    });
    const writeTask = await wClient.sendMessage({
      role: 'user',
      parts: [{ type: 'text', text: findings }],
      messageId: `msg-${Date.now()}`,
      timestamp: new Date().toISOString(),
    });

    let wResult: Task | undefined;
    for (let i = 0; i < 10; i++) {
      wResult = await wClient.getTask(writeTask.id);
      if (wResult?.status.state === 'completed') break;
      await new Promise((r) => setTimeout(r, 1000));
    }

    const writerPart = wResult?.artifacts?.[0]?.parts.find((part) => part.type === 'text');
    if (!writerPart) throw new Error('Writer agent returned no text artifact');

    return [
      {
        artifactId: `orch-${Date.now()}`,
        name: 'Final Delivered Output',
        parts: [{ type: 'text', text: writerPart.text }],
        index: 0,
        lastChunk: true,
      },
    ];
  }
}
