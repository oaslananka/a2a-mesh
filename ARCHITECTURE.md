# Architecture

## Goals

The v1 architecture targets four things at once:

- A2A protocol compliance, including push notifications and extension negotiation.
- Production-readiness with structured logging, auth, rate limiting, telemetry, and health surfaces.
- Adapter breadth across multiple agent ecosystems.
- A developer workflow that is easy to scaffold, test, release, and operate from Azure DevOps.

## Runtime Layers

### Core runtime

`packages/core` owns the protocol model and execution pipeline.

- `A2AServer` exposes the HTTP card endpoint, JSON-RPC methods, and SSE streaming.
- `TaskManager` stores tasks, `contextId` indexes, artifacts, and per-task push notification settings.
- `PushNotificationService` delivers task snapshots to webhooks with retry and exponential backoff.
- `JwtAuthMiddleware` enforces API key, bearer, and OIDC security schemes.
- `createRateLimiter` protects HTTP endpoints with JSON-RPC-compatible throttling responses.
- `logger` and telemetry helpers provide request-scoped observability hooks.

### Client runtime

`packages/client` exposes typed consumers for the protocol.

- `A2AClient` resolves agent cards, sends JSON-RPC messages, subscribes to SSE task updates, and configures push notifications.
- `AgentRegistryClient` manages registry registration, discovery, heartbeats, health checks, and event subscriptions.
- `a2a-mesh` is the default public home for the client APIs.

### Adapters

`packages/adapters` bridges provider-specific runtimes to A2A task handling.

- `BaseAdapter` subclasses `A2AServer` and normalizes agent cards.
- Provider adapters translate provider-specific history, responses, streaming events, and metadata into A2A artifacts.
- Bridge-style adapters such as Google ADK and CrewAI assume a remote runtime and map HTTP event streams back into A2A semantics.

### Registry

`packages/registry` provides agent discovery and lightweight fleet visibility.

- Storage is abstracted through `IAgentStorage`.
- `InMemoryStorage` supports local development and tests.
- `RedisStorage` supports persistent registry state for production deployments.
- The registry exposes REST discovery routes, Prometheus-style metrics, health, heartbeats, and SSE updates.

### Operator surfaces

- `apps/registry-ui` gives a browser-based view of agents, health, tags, skills, and live events.
- `cli` wraps discovery, task execution, health checks, validation, scaffolding, and local registry startup.
- `scripts/azuredevops.py` and `scripts/sync-github.sh` automate CI/CD and mirror workflows.

## Request Flow

1. A client resolves `/.well-known/agent-card.json`.
2. The client sends `message/send` or `message/stream` with optional `contextId`, push configuration, and requested extensions.
3. `A2AServer` validates the payload, authenticates when needed, negotiates extensions, and creates or resumes a task.
4. `TaskManager` persists state and emits task lifecycle updates.
5. The adapter-specific `handleTask` implementation generates artifacts.
6. `SSEStreamer` broadcasts updates to subscribed clients.
7. `PushNotificationService` sends webhook notifications whenever task state changes.

## Compatibility Strategy

- Canonical discovery uses `/.well-known/agent-card.json`.
- The legacy `/.well-known/agent.json` endpoint remains as a compatibility alias.
- `A2AServer.fromCard` normalizes older cards to the v1 surface.
- Companion packages still exist for internal modularity, but the public install story centers on `a2a-mesh`.

## Observability Strategy

- Request IDs are assigned at the HTTP middleware layer.
- Structured logs carry `taskId`, `contextId`, method, agent name, and duration.
- OpenTelemetry spans wrap JSON-RPC handling, task processing, and SSE notifications.
- Registry metrics expose registration, search, heartbeat, and health counts for scraping.

## Release Strategy

- Source of truth for CI/CD is Azure DevOps under `pipelines/`.
- Releases publish npm packages and create GitHub releases from Azure DevOps.
- GitHub remains a read-only mirror synchronized by `scripts/sync-github.sh`.
- Versioning is managed through Changesets with linked package groups for coordinated releases.
