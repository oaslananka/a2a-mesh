# a2a-mesh Architecture

This document describes the high-level architecture of `a2a-mesh` as of April 2026. The system has evolved from a basic protocol implementation into a secure, observable, multi-tenant agent platform capable of acting as both a Model Context Protocol (MCP) tool and an A2A agent network.

## System Topology

`a2a-mesh` is designed around a **Mesh Topology** where agents act as both clients and servers, registering with an optional but recommended **Control Plane (Registry)** for discovery, health tracking, and visual orchestration.

```text
[ Control Plane UI ] <--- (SSE/HTTP) ---> [ Registry Server ]
                                               ^
                                               | (Heartbeats / Registration)
                                               v
[ A2A Agent (Researcher) ] <---> [ A2A Agent (Writer) ] <---> [ MCP Ecosystem ]
```

## Core Packages

The monorepo is divided into the following public package surfaces:

### 1. `a2a-mesh`

The foundation of the runtime.

- **Server:** Implements the `A2AServer` class (Express-based), handling HTTP, JSON-RPC, and Server-Sent Events (SSE) streaming endpoints. It handles tenant isolation, authentication, and OpenTelemetry instrumentation.
- **Client:** The `A2AClient` allows agents to invoke each other with robust networking via `fetchWithPolicy` (idempotent retries, jitter, backoff).
- **Streaming:** Manages SSE connections with heartbeat keepalives.

### 2. `a2a-mesh-registry`

The Control Plane backend.

- **Service Discovery:** Agents register their endpoints, capabilities, MCP compatibility, and transport limits.
- **Health Polling:** Implements backpressure-aware health polling (chunked, jittered) over a Redis `SCAN` storage backend, preventing thundering herds.
- **Event Timeline:** Emits registry state changes to the UI.

### 3. `a2a-mesh-adapters`

Bridging external LLM frameworks into the A2A standard.

- **Supported Frameworks:** LangChain, OpenAI, CrewAI, Anthropic, LlamaIndex, Google ADK.
- **Responsibility:** Normalizes proprietary task formats and streams into the standard A2A JSON-RPC `{role, content}` format.

### 4. `a2a-mesh-mcp-bridge`

The integration layer for the Model Context Protocol.

- **Agent to Tool (`createMcpToolFromAgent`):** Exposes an A2A agent's skills as an MCP-compliant tool, consumable by Claude Desktop or any MCP Client.
- **Tool to Skill (`createA2ASkillFromMcpTool`):** Wraps an external MCP Tool into a callable A2A format.

## Security Model

- **SSRF Protection:** All outbound registry health checks and webhooks are passed through `validateSafeUrl`, strictly blocking RFC1918 private IP ranges, loopback addresses, and metadata APIs.
- **Tenant Isolation:** A strict `principalId` and `tenantId` model governs task access. Cross-tenant access is blocked with HTTP 403 Forbidden responses.

## Observability

- **OpenTelemetry:** Every request is wrapped in an OpenTelemetry span (`a2aMeshTracer`), providing end-to-end trace correlation across agent hops.
- **Audit Logs:** A dedicated `logger.audit()` channel outputs SIEM-ready structured JSON for security and operational monitoring.

## Background Jobs & Real-Time

- Tasks in `a2a-mesh` are modeled with long-running states: `queued`, `in_progress`, `waiting_on_external`, `completed`, and `failed`.
- Real-time event streams are supported via SSE, with architectural hooks planned for future WebRTC integration (`RealtimeTransport`).
