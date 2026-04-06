# Agent Metadata Model

This document details the enhancements made to the Agent Card metadata.

## Agent Capabilities & Transport

In the \`a2a-mesh\` specification, the \`AgentCard\` defines how an agent operates and what it supports.
We've extended the canonical \`AgentCard\` type to explicitly support the following properties for better discovery:

- **\`transport\`**: \`'http' | 'sse' | 'ws' | 'grpc'\`. The primary protocol binding of the agent. By default, if not present, the registry assumes \`http\`.
- **\`modelHints\`**: An array of strings providing hints about the underlying AI model powering the agent (e.g., \`['gpt-4-turbo']\` or \`['claude-3-5-sonnet']\`). This allows orchestrators to dynamically route tasks to agents with specific reasoning capabilities.
- **\`capabilities.mcpCompatible\`**: A boolean flag indicating whether the agent supports bridging its skills into the Model Context Protocol (MCP) tool ecosystem.
- **\`capabilities.backgroundJobs\`**: A boolean flag indicating whether the agent is designed to execute long-running asynchronous processes.

## RegisteredAgent Storage Metadata

When an agent registers with the Registry, the storage model wraps the \`AgentCard\` in a \`RegisteredAgent\` entity. The following fields have been added for the control plane:

- **\`consecutiveFailures\`**: The number of consecutive automated health checks that have failed.
- **\`lastSuccessAt\`**: An ISO-8601 timestamp of the last successful health check.
