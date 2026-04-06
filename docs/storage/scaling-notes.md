# Scaling Notes

This document describes how `a2a-mesh` services are designed to scale and the strategies used to manage backpressure under load.

## Health Check Backpressure

The `RegistryServer` performs automated health checks on all registered agents to maintain an up-to-date registry state. In production environments, attempting to `fetch()` thousands of health check endpoints simultaneously leads to a phenomenon known as the "thundering herd" problem, which can:

- Overwhelm local network sockets and bandwidth.
- Cause cascading timeouts.
- Introduce arbitrary delays to agent routing logic.

**Solution:**
Health checks are executed using a batched and chunked concurrency model:

- The registry processes agents in chunks of 5 concurrently.
- A randomized jitter (0–500ms) is introduced before pinging each agent to further smear network traffic over the time window.

## Push Notification Queue

Agents that stream status updates to webhooks (`PushNotificationService`) generate significant network outbound traffic.

**Solution:**
The service uses an in-memory queue to bound concurrency:

- When a task update is triggered, it is pushed onto an internal queue.
- A background worker loop processes the queue, guaranteeing that no more than `maxConcurrent` (default: 10) deliveries are executing simultaneously.
- Combined with `CircuitBreaker` and `fetchWithPolicy`, the queue elegantly handles upstream unresponsiveness and throttles failed webhooks without blocking the primary A2A application.
