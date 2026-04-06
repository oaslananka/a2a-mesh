# Registry Hardening

This document outlines the security hardening measures implemented in the `a2a-mesh` Registry.

## SSRF Prevention

The Registry must fetch health status from agents. Allowing users to register arbitrary URLs poses a Server-Side Request Forgery (SSRF) risk if those URLs point to internal infrastructure (e.g., `localhost`, `169.254.169.254`, `10.x.x.x`).

**Implementation:**
We use a specialized `validateSafeUrl` utility to parse incoming agent URLs during registration and before health checks:

1. Validates the protocol (`http:` or `https:`).
2. Parses the hostname.
3. If the hostname is an IP, checks against private/loopback/link-local ranges.
4. If it's a domain name, resolves it via DNS and verifies that none of the returned addresses are in a private range.

_Note: For local development, SSRF protection can be bypassed by setting `allowLocalhost: true` in the `RegistryServerOptions`._

## Health Check Timeouts

Health check requests (`fetch`) are now wrapped with an `AbortController`. This prevents hanging requests from exhausting Registry resources if an agent stops responding but keeps the TCP connection open. The default timeout is 5 seconds.

## Authentication

The `/agents/register` and `DELETE /agents/:id` endpoints now support optional Bearer Token authentication. This is configured via `requireAuth: true` and `registrationToken: "..."` in the `RegistryServerOptions`.
