import type { AgentCard } from 'a2a-mesh';

export function createTestAgentCard(overrides: Partial<AgentCard> = {}): AgentCard {
  return {
    protocolVersion: '1.0',
    name: 'Test Agent',
    description: 'In-process A2A test agent',
    url: 'http://localhost:0',
    version: '1.0.0',
    capabilities: {
      streaming: true,
      pushNotifications: true,
      stateTransitionHistory: true,
      extendedAgentCard: true,
    },
    defaultInputModes: ['text'],
    defaultOutputModes: ['text'],
    securitySchemes: [],
    ...overrides,
  };
}

export const basicAgentCard = createTestAgentCard();
