# Authorization Model

This document explains how `a2a-mesh` provides strict tenant isolation and principal ownership validation.

## Concepts

- **Principal ID:** Typically the user ID or service account ID of the caller initiating a task.
- **Tenant ID:** Represents an isolated organizational boundary or workspace.

## Task Ownership

When `a2a-mesh` runs with the `JwtAuthMiddleware` configured, it automatically extracts `sub`, `principalId`, `org_id`, or `tenantId` from the JWT claims.

If these claims are present, they are injected into the request context.

- During `message/send`, the newly created Task records the `principalId` and `tenantId`.
- Future requests to `tasks/get`, `tasks/list`, `tasks/cancel`, or `/stream` will **block** access if the caller's JWT claims do not match the task's recorded ownership.

## Registry Isolation

The Registry Server also supports tenant isolation.

- Agents registered while authenticated inherit the `tenantId` of the registrar.
- Optionally, agents can be marked as `isPublic: true`.
- When searching or listing agents via the Registry API, authenticated users will only see:
  - Public agents (`isPublic: true`)
  - Agents with no tenant bound (Global / Legacy)
  - Agents belonging to their own `tenantId`
