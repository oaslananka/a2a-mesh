# Audit Events

This document details the `a2a-mesh` Audit Trail mechanism.

## The `audit` Logger

In enterprise environments, knowing _who_ did _what_ and _when_ is critical for compliance and security forensics. The `logger.audit()` method writes explicit, predictable log formats specifically designed to be ingested by SIEMs (Security Information and Event Management) like Splunk or ELK.

### Event Format

An `a2a-mesh` audit event is written at the `INFO` level with the following structured properties:

- `isAudit`: Always `true`. This flag is used by your log shippers to route events into secure audit indexes.
- `action`: The high-level operation name (e.g., `task_created`, `task_cancel`, `register_agent`, `delete_agent`).
- `principalId`: The authenticated identity (or `anonymous`) initiating the action.
- `targetResource`: The resource affected (e.g., `task:abc-123`, `agent:xyz-789`).
- `outcome`: Either `success` or `failure`.
- `tenantId` (optional): The namespace or tenant bounding the context.

### Example

```json
{
  "timestamp": "2026-04-03T12:00:00.000Z",
  "level": "info",
  "message": "AUDIT: task_cancel",
  "isAudit": true,
  "action": "task_cancel",
  "principalId": "user-a",
  "tenantId": "org-xyz",
  "targetResource": "task:abc-123",
  "outcome": "success"
}
```
