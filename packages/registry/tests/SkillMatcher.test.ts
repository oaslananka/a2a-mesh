import { describe, expect, it } from 'vitest';
import { SkillMatcher } from '../src/SkillMatcher.js';
import type { RegisteredAgent } from '../src/storage/IAgentStorage.js';

const agents: RegisteredAgent[] = [
  {
    id: 'mcp-agent',
    url: 'http://mcp',
    card: {
      protocolVersion: '1.0' as const,
      name: 'MCP Bridge',
      description: 'MCP ready',
      url: 'http://mcp',
      version: '1.0',
      transport: 'ws',
      capabilities: {
        mcpCompatible: true,
      },
    },
    status: 'unhealthy' as const,
    tags: [],
    skills: [],
    registeredAt: new Date().toISOString(),
  },
  {
    id: 'writer',
    url: 'http://writer',
    card: {
      protocolVersion: '1.0' as const,
      name: 'Writer Agent',
      description: 'Writes polished content',
      url: 'http://writer',
      version: '1.0',
      skills: [
        {
          id: 'skill-1',
          name: 'Writing',
          description: 'Long-form writing and editing',
          tags: ['content', 'creative'],
        },
      ],
    },
    status: 'healthy' as const,
    tags: ['content', 'creative'],
    skills: ['Writing'],
    registeredAt: new Date().toISOString(),
  },
  {
    id: 'plain',
    url: 'http://plain',
    card: {
      protocolVersion: '1.0' as const,
      name: 'Plain Agent',
      description: 'General purpose agent',
      url: 'http://plain',
      version: '1.0',
    },
    status: 'unknown' as const,
    tags: [],
    skills: [],
    registeredAt: new Date().toISOString(),
  },
];

describe('SkillMatcher', () => {
  it('matches agents by name, skill description and tags', () => {
    expect(SkillMatcher.match(agents, { name: 'writer' })).toHaveLength(1);
    expect(SkillMatcher.match(agents, { skill: 'editing' })).toHaveLength(1);
    expect(SkillMatcher.match(agents, { tag: 'creative' })).toHaveLength(1);
  });

  it('matches agents by extended capability filters (mcp, status, transport)', () => {
    expect(SkillMatcher.match(agents, { mcpCompatible: true })).toHaveLength(1);
    expect(SkillMatcher.match(agents, { status: 'unhealthy' })).toHaveLength(1);
    expect(SkillMatcher.match(agents, { transport: 'ws' })).toHaveLength(1);

    // Testing default HTTP fallback assumption in SkillMatcher
    expect(SkillMatcher.match(agents, { transport: 'http' }).map((a) => a.id)).toEqual([
      'writer',
      'plain',
    ]);
  });

  it('excludes agents without skills when a skill or tag query is required', () => {
    expect(SkillMatcher.match(agents, { skill: 'search' })).toHaveLength(0);
    expect(SkillMatcher.match(agents, { tag: 'content', name: 'plain' })).toHaveLength(0);
    expect(SkillMatcher.match(agents, { name: 'plain' })).toHaveLength(1);
  });
});
