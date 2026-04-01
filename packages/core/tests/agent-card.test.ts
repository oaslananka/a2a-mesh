import { describe, it, expect } from 'vitest';
import { normalizeAgentCard } from '../src/types/agent-card.js';
import type { AnyAgentCard } from '../src/types/agent-card.js';

describe('normalizeAgentCard', () => {
  it('should map a v0.3 AgentCard to v1.0 canonical format', () => {
    const v03Card: AnyAgentCard = {
      protocolVersion: '0.3',
      name: 'Test Agent',
      description: 'Description',
      url: 'http://test',
      version: '1.0.0',
      defaultInputMode: 'text',
      defaultOutputMode: 'text',
      supportsAuthenticatedExtendedCard: true,
      authentication: [{ type: 'apiKey', id: 'key', in: 'header', name: 'x-api-key' }],
      skills: [{ id: 's1', name: 'S1', description: 'D1' }],
    };

    const v1Card = normalizeAgentCard(v03Card);

    expect(v1Card.protocolVersion).toBe('1.0');
    expect(v1Card.defaultInputModes).toEqual(['text']);
    expect(v1Card.defaultOutputModes).toEqual(['text']);
    expect(v1Card.capabilities?.extendedAgentCard).toBe(true);
    expect(v1Card.securitySchemes?.length).toBe(1);
  });

  it('should return a v1.0 AgentCard unmodified', () => {
    const v1Card: AnyAgentCard = {
      protocolVersion: '1.0',
      name: 'Test Agent',
      description: 'Description',
      url: 'http://test',
      version: '1.0.0',
      capabilities: { extendedAgentCard: true },
      defaultInputModes: ['text'],
      defaultOutputModes: ['text'],
      skills: [{ id: 's1', name: 'S1', description: 'D1' }],
      securitySchemes: [{ type: 'apiKey', id: 'key', in: 'header', name: 'x-api-key' }],
    };

    const result = normalizeAgentCard(v1Card);

    expect(result).toEqual(v1Card);
  });

  it('omits optional v1.0 fields when a legacy card does not provide them', () => {
    const minimalV03Card: AnyAgentCard = {
      protocolVersion: '0.3',
      name: 'Minimal Agent',
      description: 'Minimal description',
      url: 'http://minimal',
      version: '0.3.0',
    };

    const normalized = normalizeAgentCard(minimalV03Card);

    expect(normalized).toEqual({
      protocolVersion: '1.0',
      name: 'Minimal Agent',
      description: 'Minimal description',
      url: 'http://minimal',
      version: '0.3.0',
    });
  });
});
