# Roadmap

## v1.0 — Released (April 2026)

- [x] A2A Protocol v1.0 full compliance (JSON-RPC, SSE streaming, push notifications)
- [x] `A2AServer` with JWT auth, rate limiting, SSRF protection, tenant isolation
- [x] `TaskManager` with pluggable storage (InMemory, SQLite)
- [x] `A2AClient` with retry/backoff/jitter via `fetchWithPolicy`
- [x] `CircuitBreaker` for downstream resilience
- [x] OpenTelemetry distributed tracing across agent hops
- [x] Registry with InMemory + Redis backends, SSE live updates, health polling
- [x] `SkillMatcher` for capability-based agent discovery
- [x] Multi-framework adapters: OpenAI, Anthropic, LangChain, Google ADK, CrewAI (HTTP bridge), LlamaIndex
- [x] WebSocket transport (`a2a-mesh-ws` package)
- [x] MCP ↔ A2A bidirectional bridge (`a2a-mesh-mcp-bridge` package)
- [x] `create-a2a-mesh` scaffolding CLI
- [x] `a2a-mesh-cli` with discover, validate, send, monitor, benchmark commands
- [x] Testing utilities: `A2ATestServer`, `MockA2AClient`, custom matchers
- [x] Structured audit logging, structured JSON production output
- [x] Docker Compose multi-service stack (registry + demo + Redis + Jaeger)
- [x] Grafana dashboard bundle, Prometheus alerts, Helm chart skeleton

## v1.1 — Q2 2026

- [ ] Mastra.ai adapter
- [ ] AutoGen adapter
- [ ] `a2a-mesh-ws` publish to npm (currently in monorepo, not yet published)
- [ ] `a2a-mesh-mcp-bridge` publish to npm
- [ ] StackBlitz / CodeSandbox live demo environment
- [ ] VitePress docs site public deployment
- [ ] Registry UI v1.0 stable release (full topology graph, live task stream)
- [ ] `create-a2a-mesh` interactive prompt mode (currently flags-only)

## v1.2 — Q3 2026

- [ ] AG2 (AutoGen 2) adapter
- [ ] Semantic Kernel adapter
- [ ] Full A2A compliance test suite (sharable, importable)
- [ ] Helm chart production-ready values + ArtifactHub listing
- [ ] gRPC transport stable release (currently experimental in monorepo)
- [ ] OIDC provider integration (Auth0, Keycloak examples)

## v2.0 — Q4 2026

- [ ] Fastify transport option (alongside Express)
- [ ] Worker threads-based task executor for CPU-bound agents
- [ ] Native A2A Protocol binary encoding (MessagePack over WebSocket)
- [ ] Agent mesh visualization (force-directed graph, live message flow)
- [ ] Voice/multimodal session support (WebRTC placeholder already in core)
