# Live Orchestration Demo

This document outlines a live `a2a-mesh` demonstration focused on multi-agent orchestration and runtime visibility.

## The Demo Scenario

We provide a pre-configured scenario out-of-the-box:

1. **Orchestrator Agent**: Receives user input, plans the workflow, and coordinates the other agents.
2. **Researcher Agent**: Specializes in gathering data (mocked).
3. **Writer Agent**: Polishes the data into a final draft.

## Running the Demo

Open two terminals.

**Terminal 1:** Start the backend mesh services and the agents.

```bash
npm run demo:local
```

This command starts the local Registry on port `3099`, the Researcher on `3001`, the Writer on `3002`, and the Orchestrator on `3003`, then registers them automatically.

**Terminal 2:** Start the Visual Control Plane UI.

```bash
cd apps/registry-ui
npm install
npx vite
```

Navigate to <http://localhost:5173> in your browser.

- Ensure the Registry URL points to <http://localhost:3099>.
- You will see the three agents loaded.

## Initiating a Task

Open a third terminal (or send a curl command) to push a task to the orchestrator:

```bash
curl -X POST http://localhost:3003/rpc \
  -H 'Content-Type: application/json' \
  -d '{"jsonrpc": "2.0", "method": "message/send", "params": {"message": {"role": "user", "parts": [{"type": "text", "text": "Research AI agents and write a short summary"}], "messageId": "msg-1", "timestamp": "'$(date -Iseconds)'"}}, "id": 1}'
```

Watch your server terminal for the assigned `taskId`. Enter this ID in the UI, open the **Orchestrator Agent** inspector, and attach to the task stream to observe the end-to-end flow.
