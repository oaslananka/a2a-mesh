# Migration Guide

## Migrating from 0.x to 1.0

`a2a-mesh` v1.0 aligns the public API, packaging and runtime behavior with A2A Protocol v1.0 and a GitHub-first open source release flow.

## Breaking Changes

1. `AgentCard.protocolVersion` must be `'1.0'`.
   `normalizeAgentCard()` still maps legacy `0.3` cards for compatibility, but new code should author canonical v1 cards.
2. `securitySchemes` replaces the legacy `authentication` array.
3. `defaultInputModes` and `defaultOutputModes` replace singular `defaultInputMode` and `defaultOutputMode`.
4. `message/send` and `message/stream` prefer `contextId`; `sessionId` remains accepted for compatibility but is deprecated.
5. `a2a-mesh` is the default public home for `A2AClient` and `AgentRegistryClient`.
   The dedicated `a2a-mesh-client` package remains available only for advanced or internal monorepo use.
6. All published packages now target Node.js `>=20` and ship dual ESM/CJS artifacts from `dist/`.

## AgentCard Mapping

Old:

```ts
super({
  protocolVersion: '0.3',
  defaultInputMode: 'text',
  defaultOutputMode: 'text',
  authentication: [],
  supportsAuthenticatedExtendedCard: true,
});
```

New:

```ts
super({
  protocolVersion: '1.0',
  defaultInputModes: ['text'],
  defaultOutputModes: ['text'],
  securitySchemes: [],
  capabilities: {
    extendedAgentCard: true,
  },
});
```

## Client Imports

Old:

```ts
import { A2AClient } from 'a2a-mesh';
```

New:

```ts
import { A2AClient } from 'a2a-mesh';
```

## Runtime Changes

- Health responses now include protocol version, uptime, task counters and memory usage.
- Task persistence is storage-backed; in-memory remains the default and SQLite is available for durable local state.
- `tasks/list` is available as an a2a-mesh extension for practical task inspection and monitoring.
- `A2AClient` now supports configurable retry behavior for transient upstream failures.

## Adapter Notes

- `OpenAIAdapter` uses the modern Chat Completions-compatible flow, not the deprecated Assistants API.
- `LangChainAdapter` targets runnable-style execution and normalized message history.
- Bridge adapters such as Google ADK and CrewAI now use stricter typed bridge payloads.
