# Streaming Model

This document outlines how real-time communication behaves in the `a2a-mesh` server.

## Server-Sent Events (SSE)

For real-time observability of task progress (status changes, logs, stream chunks from LLMs), `a2a-mesh` provides a subscribe endpoint at `/tasks/:id/stream`.

### Heartbeats

Streaming connections can run long and stay idle if the upstream LLM is processing large inputs. This causes load balancers (e.g., AWS ALB, Nginx, Render proxies) to abruptly terminate the connection (usually around 60s).

**Solution:** The internal `SSEStreamer` component emits a comment-based heartbeat (`: heartbeat\n\n`) to all connected subscribers every 15 seconds. This keeps the TCP socket active and prevents proxy timeouts.

### Incremental Stream Processing

Adapters parsing upstream responses (like `GoogleADKAdapter` processing HTTP SSE events from external endpoints) read the stream incrementally using `Response.body.getReader()`. By iterating over the chunks asynchronously, memory spikes are avoided rather than buffering the entire `response.text()`.
