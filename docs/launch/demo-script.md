# a2a-mesh Launch Demo Script

This script provides a step-by-step guide to presenting `a2a-mesh` to developers, stakeholders, or conference audiences in a professional, product-focused way.

## Pre-requisites

1. Node.js 20+ installed.
2. An OpenAI API Key (\`OPENAI_API_KEY\`).
3. Local ports \`3001\`, \`3002\`, \`3003\`, \`3099\`, and \`5173\` are open.

---

## 🎬 Act 1: Quick Start

**Speaker Notes:** "Many agent stacks require a significant amount of setup before you can observe real collaboration. With `a2a-mesh`, we can stand up a small multi-agent environment quickly and inspect it with the same operational surface we would use in development."

**Action:**

1. Open a terminal.
2. Run the scaffold command:

   ```bash
   npx create-a2a-mesh my-research-team --adapter pack-research-team
   ```

3. CD into the directory, copy \`.env.example\`, and inject the API key.

   ```bash
   cd my-research-team
   cp .env.example .env
   # Add OPENAI_API_KEY
   ```

4. Start the network:

   ```bash
   npm install && npm run dev
   ```

**Speaker Notes:** "This starts a local control plane registry and registers three distinct A2A agents: a Researcher, an Analyst, and a Writer. They can now discover one another and exchange work through the mesh."

---

## 🎬 Act 2: Visual Orchestration

**Speaker Notes:** "Terminal logs are useful, but distributed systems need observability. The control plane gives us a live view of topology, task activity, and streaming output."

**Action:**

1. Open a new terminal tab and start the Control Plane UI:

   ```bash
   cd apps/registry-ui
   npm install && npm run dev &
   ```

2. Open a browser to <http://localhost:5173>.
3. Show the **Agent Topology** view. Point out the nodes (Researcher, Analyst, Writer) and how they are connected.
4. Show the **Live Stream Panel**.

**Action (Triggering the Flow):**

1. Send a cURL request or use the UI to trigger the Researcher agent.

   ```bash
   curl -X POST http://localhost:3003/rpc \
    -H "Content-Type: application/json" \
    -d '{"jsonrpc":"2.0","id":"demo-1","method":"message/send","params":{"message":{"role":"user","parts":[{"type":"text","text":"Research the latest advancements in solid-state batteries and write a summary."}]}}}'
   ```

2. **Watch the UI:** Show how the request moves through the topology map from Researcher -> Analyst -> Writer.
3. Point out the SSE streaming logs arriving in the control plane in real time.

---

## 🎬 Act 3: MCP Bridge

**Speaker Notes:** "If we want to expose this workflow to Claude Desktop or another MCP-compatible client, we do not need a separate orchestration layer. `a2a-mesh` can bridge directly to the Model Context Protocol."

**Action:**

1. Open \`src/mcp-server.ts\` (part of the starter pack).
2. Highlight the \`createMcpToolFromAgent\` function.

   ```typescript
   const myMcpTool = createMcpToolFromAgent({
     agentUrl: 'http://localhost:3001',
     name: 'researcher',
     description: 'Triggers the entire research pipeline.',
   });
   ```

3. Show Claude Desktop interacting with the Researcher agent natively as a tool.

---

## 🎬 Act 4: Production Readiness

**Speaker Notes:** "The demo surface is intentionally simple, but the runtime behavior is designed for production use. While that flow ran, `a2a-mesh` was automatically:"

1. **Protecting against SSRF:** Validating every health check to ensure it doesn't hit private AWS metadata endpoints.
2. **Tracing everything:** Using OpenTelemetry to propagate spans across the Researcher, Analyst, and Writer HTTP calls.
3. **Throttling gracefully:** The Registry used chunked Redis \`SCAN\` calls and Jitter to prevent thundering herds on health checks.

**Closing:** "This is `a2a-mesh`: a TypeScript runtime and control plane for interoperable A2A systems."

## Launch Checklist

Before the public demo or launch, update the GitHub repository metadata manually:

- Description: `Production-ready TypeScript runtime for Google's Agent2Agent (A2A) Protocol — server runtime, adapters for 6 frameworks, registry, MCP bridge & CLI.`
- Topics: `a2a agent2agent ai-agents multi-agent typescript mcp langchain openai anthropic google-adk llamaindex crewai protocol nodejs monorepo llm orchestration`
