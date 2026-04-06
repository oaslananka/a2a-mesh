# Multi-Tenant Roadmap

This document outlines the strategic future of multi-tenant environments within the `a2a-mesh` platform.

## Current State (Phase 4)

- **Principal Awareness:** Tasks are bound to `principalId` and `tenantId` extracted from incoming JWTs.
- **Registry Namespacing:** Agents can be associated with a specific tenant namespace, allowing the Registry to hide private agents from other tenants while exposing `isPublic` agents.
- **Agent Call Authorization:** The `A2AServer` strictly forbids access to another principal's tasks (`HTTP 403 Forbidden`).

## Next Steps

In future phases, the following aspects will be extended:

1. **API Keys per Tenant:** `A2A_API_KEY` configurations will support hierarchical structures, moving away from simple single-key lists to tenant-scoped token management.
2. **Billing and Quotas:** The existing RateLimiter middleware will be mapped per-tenant instead of merely globally per IP or API key.
3. **Admin/Service Roles:** Roles will be added to the JWT claims allowing "Platform Administrators" to list all tasks and agents across all tenants.
