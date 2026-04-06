# `a2a-mesh-codex-bridge`

Experimental bridge utilities for connecting Codex or MCP-style tool servers to `a2a-mesh`.

This package does not replace the A2A protocol. Instead, it helps you expose
`a2a-mesh` agents behind a tool-calling surface such as Codex app-server or an
MCP server.

## What it gives you

- A tool definition shape that maps cleanly to Codex/App Server tool metadata
- A ready-made `message/send` bridge for A2A agents
- Registry listing/search helpers for discovery-style tools
- Optional progress callbacks so host apps can surface intermediate status

## Example

```ts
import { createA2ASendMessageTool } from 'a2a-mesh-codex-bridge';

const askResearchAgent = createA2ASendMessageTool({
  name: 'ask_research_agent',
  title: 'Ask research agent',
  description: 'Sends a text request to the research orchestrator.',
  agentUrl: 'http://localhost:3100',
});

const result = await askResearchAgent.execute({
  text: 'Summarize the current multi-agent architecture.',
});

console.log(result.output);
```

## Current scope

The first release is intentionally narrow:

- text input/output
- direct A2A agent calls
- registry search/list helpers
- host-driven progress reporting

Future iterations can add richer mappings for streaming task state, structured
tool outputs, auth propagation, and Codex/App Server-specific adapters.

This package remains in the repository, but it is not part of the first public npm release wave.
