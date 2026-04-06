# a2a-mesh demo

Three-agent pipeline: Researcher → Writer, orchestrated by a coordinator and registered with a
local A2A control plane.

## Prerequisites

- Node.js 20+
- `OPENAI_API_KEY`
- Optional `ANTHROPIC_API_KEY` for the writer agent

## Run

```bash
cp .env.example .env
# Add your OPENAI_API_KEY to .env
npm install
npm run dev
```

By default the demo starts an embedded local registry on `:3099` when it cannot reach one.

## What runs

| Agent        | Port    | Role                                                    |
| ------------ | ------- | ------------------------------------------------------- |
| Researcher   | `:3001` | Collects and synthesizes factual findings               |
| Writer       | `:3002` | Rewrites findings as a polished final response          |
| Orchestrator | `:3003` | Coordinates the pipeline and exposes the public A2A API |

Registry runs at `:3099`. Open `http://localhost:3099/agents` to inspect registered agents or run
the control plane UI from this monorepo with `cd apps/registry-ui && npm run dev`.

## Send a task

```bash
curl -X POST http://localhost:3003/rpc \
  -H 'Content-Type: application/json' \
  -d '{
    "jsonrpc": "2.0",
    "id": "1",
    "method": "message/send",
    "params": {
      "message": {
        "role": "user",
        "messageId": "demo-1",
        "timestamp": "2026-04-06T00:00:00.000Z",
        "parts": [{ "type": "text", "text": "What is the Agent-to-Agent protocol?" }]
      }
    }
  }'
```

## Verify with the smoke test

```bash
npm run smoke-test
```
