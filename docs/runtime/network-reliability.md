# Network Reliability

This document outlines the network reliability mechanisms built into the `a2a-mesh` runtime to ensure stability across distributed agent calls.

## The `fetchWithPolicy` wrapper

To prevent agents from hanging indefinitely and to gracefully handle transient network glitches, we use a custom `fetchWithPolicy` wrapper for all outbound HTTP requests (including adapter calls to LLM providers and Push Notifications).

### Key Features

1. **Timeouts:** Every outbound request enforces a strict timeout via `AbortController`. The default is typically 30s to 60s depending on the adapter.
2. **Idempotent Retries:** For transient errors (HTTP 408, 429, 500+), the wrapper automatically retries the request.
3. **Exponential Backoff & Jitter:** Retries use exponential backoff (`backoffBaseMs * 2^attempt`) combined with "full jitter" to prevent thundering herd problems on upstream services.
4. **Header Redaction:** Sensitive headers (e.g., `Authorization`, `x-api-key`) are scrubbed before any debug logging or tracing.

## Usage in Custom Adapters

If you are building a custom adapter that needs to communicate with external APIs, import and use `fetchWithPolicy` instead of the global `fetch`:

```typescript
import { fetchWithPolicy } from 'a2a-mesh';

const response = await fetchWithPolicy(
  'https://api.example.com/endpoint',
  {
    method: 'POST',
    body: JSON.stringify(data),
  },
  {
    timeoutMs: 15000,
    retries: 3,
  },
);
```
