# Registry as a Control Plane

The `a2a-mesh` Registry is not just a passive list of agents; it is an active control plane that continually evaluates the health, capabilities, and transport support of the registered agents.

## Capability Searching

When searching the Registry API via `/agents/search`, you can filter by more than just keywords. The API now supports:

- \`skill\`, \`tag\`, \`name\`: Standard semantic matches.
- \`transport\`: Filter agents by how they can be communicated with (\`http\`, \`ws\`, \`grpc\`, \`sse\`).
- \`status\`: Retrieve only \`healthy\` or \`unhealthy\` agents.
- \`mcpCompatible\`: Filter specifically for agents that bridge into the MCP ecosystem.

## Health Status & Metrics

When an agent is registered, the Registry actively polls its \`/health\` endpoint.

- It records the number of \`consecutiveFailures\`.
- It tracks the \`lastSuccessAt\` timestamp.
  This metadata helps orchestrators decide if they should retry an agent, or fallback to an alternative.
