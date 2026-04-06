# Registry Storage

This document details how `a2a-mesh` manages agent data within the Registry and how it is optimized for high scale.

## Redis Optimization (KEYS vs SCAN)

In early versions, the Registry utilized the `KEYS *` command to retrieve the list of all registered agents. The `KEYS` command is extremely problematic in production Redis environments because it scans the entire key space in a single blocking operation. For a large number of agents or shared Redis clusters, this would lock the event loop, causing severe latency spikes and timeouts across all clients.

**The Solution:**
The `RedisStorage` engine has been updated to use the cursor-based `SCAN` command.

### Why SCAN?

- **Non-blocking:** `SCAN` retrieves keys in small chunks (e.g., 100 at a time), allowing Redis to handle other commands in between.
- **Chunked Data Fetching:** After obtaining the keys, the system executes `GET` operations in batches (e.g., 100 parallel `GET`s per chunk) rather than a single massive `Promise.all` which could exhaust Node's network socket pool or overload the Redis proxy.

## Implementation details

If a custom Redis client is passed to `RedisStorage` that does not support `scan()`, the registry will gracefully fallback to `keys()`, but a warning is implied for production environments. Ensure you are using an updated version of `ioredis` or a compatible driver.
