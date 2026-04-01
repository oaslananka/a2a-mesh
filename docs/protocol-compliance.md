# Protocol Compliance

## Discovery and transport

| Feature | Status | Notes |
| --- | --- | --- |
| `/.well-known/agent-card.json` | Supported | Canonical v1 path |
| `/.well-known/agent.json` | Supported | Legacy compatibility alias |
| JSON-RPC over HTTP | Supported | `POST /` and `POST /a2a/jsonrpc` |
| SSE task streaming | Supported | `GET /stream` and `GET /a2a/stream` |

## Task methods

| Method | Status | Notes |
| --- | --- | --- |
| `message/send` | Supported | Creates or resumes tasks |
| `message/stream` | Supported | Returns a task handle and streams updates |
| `tasks/get` | Supported | Returns the latest task snapshot |
| `tasks/cancel` | Supported | Marks the task canceled |
| `tasks/pushNotification/set` | Supported | Stores per-task push config |
| `tasks/pushNotification/get` | Supported | Returns per-task push config |

## Extended behaviors

| Capability | Status | Notes |
| --- | --- | --- |
| `contextId` propagation | Supported | Stored on task, history, metadata, and logs |
| Push notifications | Supported | Webhook delivery with retry and exponential backoff |
| Extensions | Supported | Required extensions fail fast, optional extensions degrade gracefully |
| Authenticated extended cards | Supported | Guarded by API key, bearer, or OIDC middleware |
| Rate limiting | Supported | JSON-RPC `429` responses with rate limit headers |
| OpenTelemetry hooks | Supported | Optional peer dependency |

## Known limits

- Task storage is in-memory inside the core runtime.
- Cross-agent task aggregation is intentionally not part of the registry.
- gRPC transport exists separately from the default HTTP/SSE runtime path.
