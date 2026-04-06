import type { AgentSkill } from 'a2a-mesh';
import type { Tool } from '@modelcontextprotocol/sdk/types.js';

export interface McpSkillOptions {
  /** Map MCP tool to explicit A2A Agent Skill tags */
  tags?: string[];
  /** Expected input schema stringification hint */
  inputModes?: string[];
}

/**
 * Transforms an MCP Tool definition into an A2A AgentSkill for registry indexing.
 * This allows an A2A orchestrator to discover that an agent can execute an MCP Tool.
 *
 * @param tool The MCP Tool definition provided by an external MCP server.
 * @param options Additional mapping options.
 * @returns A canonical A2A AgentSkill definition.
 */
export function createA2ASkillFromMcpTool(tool: Tool, options?: McpSkillOptions): AgentSkill {
  return {
    id: `mcp-${tool.name}`,
    name: tool.name,
    description: `[MCP Tool] ${tool.description ?? 'Executes external MCP capability'}`,
    tags: ['mcp', 'tool', ...(options?.tags ?? [])],
    inputModes: options?.inputModes ?? ['json'],
    outputModes: ['json', 'text'],
  };
}
