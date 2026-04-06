# a2a-mesh-mcp-bridge

Bidirectional bridge between the A2A Protocol and the Model Context Protocol (MCP).

## Install

```bash
npm install a2a-mesh-mcp-bridge
```

## Expose an A2A agent as an MCP tool

```ts
import { createMcpToolFromAgent, handleA2AMcpToolCall } from 'a2a-mesh-mcp-bridge';

const config = {
  agentUrl: 'http://localhost:3001',
  name: 'researcher',
  description: 'Researches any topic and returns a structured summary.',
};

const tool = createMcpToolFromAgent(config);
const result = await handleA2AMcpToolCall(config, {
  message: 'Summarize the A2A protocol.',
});
```

## Wrap an MCP tool as an A2A skill

```ts
import { createA2ASkillFromMcpTool } from 'a2a-mesh-mcp-bridge';

const skill = createA2ASkillFromMcpTool(tool, {
  tags: ['web_search'],
  inputModes: ['json'],
});
```

## Status

Not yet published to npm. Available in the monorepo. Planned for standalone publication in v1.1.
