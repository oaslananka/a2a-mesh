# Metrics

This document explains the Prometheus metrics exposed by `a2a-mesh`.

## Registry Metrics

The `RegistryServer` exposes a standard `/metrics` endpoint formatted for Prometheus text-based exposition.

**Available Counters & Gauges:**

- `a2a_registry_registrations_total`: Total successful agent registration operations since uptime.
- `a2a_registry_searches_total`: Total `/agents/search` calls.
- `a2a_registry_heartbeats_total`: Total manual heartbeat operations.
- `a2a_registry_agents`: Gauge of the total known agents.
- `a2a_registry_healthy_agents`: Gauge of agents actively reporting `healthy` via health checks.
- `a2a_registry_active_tenants`: Number of unique organizational boundaries running agents in this registry.
- `a2a_registry_public_agents`: Number of public, globally discoverable agents in the registry.

## Node / Runtime Health

The Core `A2AServer` exposes a basic `/health` endpoint that includes internal task telemetry:

- active tasks
- completed / failed tasks
- memory utilization
