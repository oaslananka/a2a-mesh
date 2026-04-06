# Tracing

This document describes how `a2a-mesh` implements OpenTelemetry (OTel) context propagation and trace IDs.

## Context Propagation

When an RPC request is received, the `A2AServer` automatically extracts W3C Trace Context and Baggage from HTTP headers if present.
If no parent context exists, a new Trace and Span are started.

**Correlated Properties:**

- `traceId`: Bound to the trace context and injected into all application logs during the request lifecycle.
- `spanId`: Represents the current operation (e.g., `rpc.message/send`).
- `a2a.task_id`: Captured in baggage to trace a task across multiple agent hops.
- `a2a.context_id`: Used to relate multiple tasks participating in the same orchestration conversation.

This ensures that downstream adapters (e.g., `fetchWithPolicy`) automatically attach `traceparent` headers to outbound calls, enabling seamless distributed tracing in systems like Jaeger, DataDog, or New Relic.
