# MCP Bridge Examples

Below is a complete example of setting up an A2A Agent as an MCP Tool and registering it with the official `@modelcontextprotocol/sdk`.

```typescript
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { CallToolRequestSchema, ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import { createMcpToolFromAgent, handleA2AMcpToolCall } from 'a2a-mesh-mcp-bridge';

const server = new Server(
  { name: 'a2a-mesh-mcp-bridge', version: '1.0.0' },
  { capabilities: { tools: {} } },
);

const myA2AAgent = {
  agentUrl: 'http://localhost:3001',
  name: 'a2a-researcher',
  description: 'Gathers deep contextual data on topics.',
  token: process.env.A2A_API_KEY,
};

server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [createMcpToolFromAgent(myA2AAgent)],
  };
});

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  if (request.params.name === 'a2a-researcher') {
    const args = request.params.arguments as any;
    return await handleA2AMcpToolCall(myA2AAgent, args);
  }

  throw new Error('Tool not found');
});

const transport = new StdioServerTransport();
await server.connect(transport);
```
