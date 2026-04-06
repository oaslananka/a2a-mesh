<div align="center">
  <h1>a2a-mesh</h1>
  <p><strong>Production-grade TypeScript runtime for Google's Agent-to-Agent (A2A) Protocol</strong></p>
  <p>The missing infrastructure layer for multi-agent AI systems.</p>
</div>

<p align="center">
  <a href="https://www.npmjs.com/package/a2a-mesh">
    <img src="https://img.shields.io/npm/v/a2a-mesh?style=flat-square&color=2563eb" alt="npm version" />
  </a>
  <a href="https://www.npmjs.com/package/a2a-mesh">
    <img src="https://img.shields.io/npm/dm/a2a-mesh?style=flat-square&color=0f766e" alt="npm downloads" />
  </a>
  <img src="https://img.shields.io/badge/coverage-%E2%89%A585%25-brightgreen?style=flat-square" alt="Coverage" />
  <a href="./LICENSE">
    <img src="https://img.shields.io/badge/license-Apache%202.0-blue?style=flat-square" alt="License" />
  </a>
  <a href="https://google.github.io/A2A">
    <img src="https://img.shields.io/badge/A2A%20Protocol-v1.0-1d4ed8?style=flat-square" alt="A2A Protocol" />
  </a>
  <img src="https://img.shields.io/badge/Node.js-%3E%3D20-15803d?style=flat-square" alt="Node.js" />
</p>

---

## The problem

Every AI framework has its own way of making agents talk to each other. Getting a LangChain
agent to delegate work to an OpenAI-backed agent over HTTP usually means rebuilding transport,
auth, retries, streaming, task state, discovery, and observability from scratch.

**Google's A2A Protocol** defines the wire standard. `a2a-mesh` is the production runtime that
makes it practical to build with.

---

## What you get

| Capability                    | Details                                                                                   |
| ----------------------------- | ----------------------------------------------------------------------------------------- |
| **A2A Protocol v1.0 runtime** | JSON-RPC handling, SSE streaming, push notifications, health endpoints, agent cards       |
| **Multi-framework adapters**  | OpenAI, Anthropic, LangChain, Google ADK, LlamaIndex, CrewAI HTTP bridge                  |
| **Registry control plane**    | Agent discovery, capability matching, health polling, SSE registry updates, Redis backend |
| **Enterprise security**       | JWT auth hooks, tenant isolation, SSRF prevention, rate limiting                          |
| **Observability**             | OpenTelemetry spans, structured audit logs, Grafana and alerting artifacts                |
| **Network resilience**        | Retry, exponential backoff, jitter, timeouts, circuit breaker primitives                  |
| **Transport extensions**      | WebSocket transport package today, gRPC transport package in experimental form            |
| **Testing toolkit**           | `A2ATestServer`, `MockA2AClient`, fixtures, matchers, integration tests                   |
| **Scaffolding CLI**           | `npx create-a2a-mesh` for new agents and multi-agent starter packs                        |

---

## Try it in 30 seconds

```bash
npx create-a2a-mesh demo
cd demo
npm install
npm run dev
```

Then send a task:

```bash
curl -s -X POST http://localhost:3000/rpc \
  -H 'Content-Type: application/json' \
  -d '{"jsonrpc":"2.0","id":"1","method":"message/send","params":{"message":{"role":"user","messageId":"m1","timestamp":"2026-04-06T00:00:00.000Z","parts":[{"type":"text","text":"Hello agent!"}]}}}'
```

You will see a task get created, completed, and returned through the A2A runtime immediately.

---

## Quickstart

For a real multi-agent starter pack:

```bash
npx create-a2a-mesh my-team --adapter pack-research-team
cd my-team
cp .env.example .env
# add OPENAI_API_KEY to .env
npm install
npm run dev
```

This pack starts a local registry plus multiple agents wired together through A2A. The raw
registry catalog is available at `http://localhost:3099/agents`.

### Or install manually

```bash
npm install a2a-mesh
```

```ts
import { A2AServer, type AgentCard, type Artifact, type Message, type Task } from 'a2a-mesh';

const card: AgentCard = {
  protocolVersion: '1.0',
  name: 'My Agent',
  description: 'Does one thing well',
  url: 'http://localhost:3001',
  version: '1.0.0',
  capabilities: {
    streaming: true,
    pushNotifications: false,
    stateTransitionHistory: true,
  },
  skills: [
    {
      id: 'hello',
      name: 'Hello',
      description: 'Says hello back',
      tags: ['demo'],
      inputModes: ['text'],
      outputModes: ['text'],
    },
  ],
  defaultInputModes: ['text'],
  defaultOutputModes: ['text'],
  securitySchemes: [],
};

class MyAgent extends A2AServer {
  constructor() {
    super(card);
  }

  async handleTask(_task: Task, message: Message): Promise<Artifact[]> {
    const text = message.parts.find((part) => part.type === 'text');

    return [
      {
        artifactId: 'reply-1',
        parts: [
          {
            type: 'text',
            text: `Hello from a2a-mesh. You said: ${text?.type === 'text' ? text.text : ''}`,
          },
        ],
        index: 0,
        lastChunk: true,
      },
    ];
  }
}

new MyAgent().start(3001);
console.log('Agent running at http://localhost:3001');
```

---

## Framework adapters

```ts
// OpenAI
import OpenAI from 'openai';
import { OpenAIAdapter } from 'a2a-mesh-adapters';

class MyOpenAIAgent extends OpenAIAdapter {
  constructor() {
    super(card, new OpenAI({ apiKey: process.env.OPENAI_API_KEY }), 'gpt-5-mini');
  }
}

// Anthropic Claude
import Anthropic from '@anthropic-ai/sdk';
import { AnthropicAdapter } from 'a2a-mesh-adapters';

class MyClaudeAgent extends AnthropicAdapter {
  constructor() {
    super(
      card,
      new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY }),
      'claude-sonnet-4-20250514',
    );
  }
}

// LangChain
import { LangChainAdapter } from 'a2a-mesh-adapters';

const runnable = {
  async invoke(input: unknown) {
    return JSON.stringify(input);
  },
};

class MyLangChainAgent extends LangChainAdapter {
  constructor() {
    super(card, runnable);
  }
}
```

---

## MCP bridge

Expose any A2A agent as an MCP tool:

```ts
import { createMcpToolFromAgent, handleA2AMcpToolCall } from 'a2a-mesh-mcp-bridge';

const config = {
  agentUrl: 'http://localhost:3001',
  name: 'researcher',
  description: 'Searches and summarizes web content.',
};

const tool = createMcpToolFromAgent(config);
const result = await handleA2AMcpToolCall(config, {
  message: 'Summarize the latest A2A protocol changes.',
});
```

Wrap an MCP tool definition as an A2A-discoverable skill:

```ts
import { createA2ASkillFromMcpTool } from 'a2a-mesh-mcp-bridge';

const skill = createA2ASkillFromMcpTool(tool, {
  tags: ['search', 'mcp'],
  inputModes: ['json'],
});
```

---

## Architecture

```text
┌──────────────────── Control Plane ────────────────────┐
│ Registry UI                                             │
│ Topology · Live task stream · Health · Search           │
└────────────────────────────┬───────────────────────────┘
                             │ SSE / HTTP
                      ┌──────▼──────┐
                      │  Registry   │ ← InMemory or Redis
                      │   :3099     │
                      └──┬──────┬───┘
                         │      │
               Register +│      │Search / heartbeats
                         │      │
                ┌────────▼──┐  ┌▼────────────┐
                │  Agent A  │  │   Agent B   │
                │   :3001   │◄─►    :3002    │
                └───────────┘  └─────────────┘
                       │               │
                 MCP bridge      OpenAI / Anthropic /
                                  LangChain / ADK / ...
```

---

## Packages

| Package               | Status   | Description                                                                  |
| --------------------- | -------- | ---------------------------------------------------------------------------- |
| `a2a-mesh`            | npm      | Core runtime: server, client, auth, telemetry, storage                       |
| `a2a-mesh-adapters`   | npm      | Framework adapters for OpenAI, Anthropic, LangChain, ADK, CrewAI, LlamaIndex |
| `a2a-mesh-registry`   | npm      | Registry server with discovery, health polling, SSE updates                  |
| `a2a-mesh-cli`        | npm      | CLI for discovery, validation, sending, monitoring, and scaffolding          |
| `create-a2a-mesh`     | npm      | Project scaffolder                                                           |
| `a2a-mesh-client`     | monorepo | Standalone client surface kept in-repo today                                 |
| `a2a-mesh-testing`    | monorepo | Testing helpers, fixtures, and matchers                                      |
| `a2a-mesh-mcp-bridge` | monorepo | MCP ↔ A2A bridge, prepared for npm release                                   |
| `a2a-mesh-ws`         | monorepo | Experimental WebSocket transport                                             |
| `a2a-mesh-grpc`       | monorepo | Experimental gRPC transport                                                  |

---

## Deployment

**Docker Compose** runs the registry, demo agents, Redis, and Jaeger locally:

```bash
docker compose up
```

See [docs/deployment.md](./docs/deployment.md) for manual deployment guidance covering Docker,
Kubernetes, Cloud Run, Railway, and docs-site publishing without GitHub Actions.

---

## Contributing

See [CONTRIBUTING.md](./CONTRIBUTING.md). Add a changeset for public package changes and run the
local verification suite before opening a PR.

---

## AI assistance note

`a2a-mesh` is maintainer-directed software. AI tools are used as development assistants, not as
autonomous authors of the project.

- The social preview image at `.github/og-image.png` was generated with Gemini Nano Bana and then
  selected for the repository by the maintainer.
- Codex is used in this repository as a coding assistant for refactors, documentation work, review
  support, and repetitive implementation tasks.
- Final architecture, API design, security review, release decisions, and project ownership remain
  with the maintainer.

---

## License

Apache 2.0 — see [LICENSE](./LICENSE).
