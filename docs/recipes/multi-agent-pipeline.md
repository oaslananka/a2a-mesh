# Multi-Agent Pipeline

Use a shared `contextId` when an orchestrator delegates work to specialist agents.

```ts
const contextId = crypto.randomUUID();
await researcherClient.sendMessage({ message, contextId });
await writerClient.sendMessage({ message, contextId });
```

This keeps task history, telemetry, and registry lookups correlated across the whole workflow.
