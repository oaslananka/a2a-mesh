# A2A to MCP Bridge

The `a2a-mesh-mcp-bridge` package provides bi-directional interoperability between Google's Agent2Agent (A2A) Protocol and the open Model Context Protocol (MCP).

## Concept

1. **A2A as an MCP Tool**: Expose your advanced, orchestrated, multi-step A2A Agent network to any standard MCP Client (like Claude Desktop) as a simple Tool.
2. **MCP Tool as an A2A Skill**: Dynamically wrap any MCP server tool and expose it to your A2A Orchestrator.

## Exposing A2A Agents to MCP

```typescript
import { createMcpToolFromAgent, handleA2AMcpToolCall } from 'a2a-mesh-mcp-bridge';

// 1. Generate the MCP Schema
const myToolDefinition = createMcpToolFromAgent({
  agentUrl: 'http://localhost:3001',
  name: 'researcher',
  description: 'Searches the internet and synthesizes findings.',
});

// 2. Execute via your MCP Server handler
const result = await handleA2AMcpToolCall(
  { agentUrl: 'http://localhost:3001', name: 'researcher', description: '' },
  { message: args.message },
);
```

## Exposing MCP Tools to A2A

```typescript
import { createA2ASkillFromMcpTool } from 'a2a-mesh-mcp-bridge';

// Convert an MCP tool definition into an A2A AgentSkill
const skill = createA2ASkillFromMcpTool(mcpToolDef, { tags: ['data', 'mcp'] });

// Now register this skill in your A2A AgentCard
agentCard.skills.push(skill);
agentCard.capabilities.mcpCompatible = true;
```
