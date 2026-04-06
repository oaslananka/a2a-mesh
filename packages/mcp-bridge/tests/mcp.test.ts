import { describe, it, expect, vi, afterEach } from 'vitest';
import { createMcpToolFromAgent, handleA2AMcpToolCall } from '../src/A2ATool.js';
import { createA2ASkillFromMcpTool } from '../src/McpToolSkill.js';
import type { Tool } from '@modelcontextprotocol/sdk/types.js';

describe('A2A to MCP Tool Bridge', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('generates an MCP Tool schema from an A2A Agent configuration', () => {
    const tool = createMcpToolFromAgent({
      agentUrl: 'http://localhost:3001',
      name: 'Researcher Agent',
      description: 'Finds information on the internet.',
    });

    expect(tool.name).toBe('researcher-agent');
    expect(tool.description).toContain('[A2A Agent Proxy]');
    expect(tool.inputSchema.required).toContain('message');
  });

  it('forwards the tool call to the A2A Agent and maps output', async () => {
    // Mock the global fetch to return a completed task structure
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(
        JSON.stringify({
          jsonrpc: '2.0',
          id: null,
          result: {
            id: 'task-1',
            status: { state: 'completed' },
            artifacts: [{ parts: [{ type: 'text', text: 'This is the research data.' }] }],
          },
        }),
      ),
    );

    const result = await handleA2AMcpToolCall(
      { agentUrl: 'http://localhost:3001', name: 'Researcher', description: 'test' },
      { message: 'What is A2A?' },
    );
    const firstContent = result.content[0];

    expect(result.isError).toBe(false);
    expect(firstContent).toBeDefined();
    expect(firstContent?.type).toBe('text');
    if (!firstContent || firstContent.type !== 'text') {
      throw new Error('Expected a text content item');
    }
    expect(firstContent.text).toBe('This is the research data.');
  });
});

describe('MCP to A2A Skill Bridge', () => {
  it('maps an MCP Tool to an A2A Skill', () => {
    const mcpTool: Tool = {
      name: 'calculator',
      description: 'Adds two numbers',
      inputSchema: { type: 'object' },
    };

    const skill = createA2ASkillFromMcpTool(mcpTool, { tags: ['math'] });

    expect(skill.id).toBe('mcp-calculator');
    expect(skill.name).toBe('calculator');
    expect(skill.description).toContain('[MCP Tool]');
    expect(skill.tags).toContain('math');
    expect(skill.tags).toContain('mcp');
  });
});
