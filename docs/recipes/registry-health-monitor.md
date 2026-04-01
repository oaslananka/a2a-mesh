# Registry Health Monitor

Run a lightweight cron job that calls the registry `/health` endpoint and alerts when availability or registration counts drift unexpectedly.

Useful checks:

- registry responds within an agreed latency budget
- Redis-backed storage is reachable
- expected agents still appear in `/agents`
- stale heartbeat counts stay below your threshold
