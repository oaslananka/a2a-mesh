# Observability

`a2a-mesh` emits useful operational signals out of the box:

- OpenTelemetry spans around JSON-RPC handling, task execution, and SSE delivery
- Health endpoint metrics for uptime, task counts, and memory usage
- Registry-side health and storage metrics

## OpenTelemetry example

```ts
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import { SimpleSpanProcessor } from '@opentelemetry/sdk-trace-base';
import { NodeTracerProvider } from '@opentelemetry/sdk-trace-node';

const provider = new NodeTracerProvider();
provider.addSpanProcessor(
  new SimpleSpanProcessor(new OTLPTraceExporter({ url: 'http://jaeger:4318/v1/traces' })),
);
provider.register();
```

Start your agent after telemetry has been registered:

```ts
import { BaseAdapter } from 'a2a-mesh-adapters';

const agent = new MyAgent(card);
agent.start(3000);
```

## Health endpoint

`GET /health` returns:

```json
{
  "status": "healthy",
  "version": "1.0.0",
  "protocol": "A2A/1.0",
  "uptime": 3600,
  "tasks": {
    "active": 3,
    "completed": 147,
    "failed": 2,
    "total": 152
  },
  "memory": {
    "heapUsedMb": 45.2,
    "heapTotalMb": 128
  }
}
```

## Recommended dashboards

- Task lifecycle counters by state
- RPC latency p50 / p95 / p99
- Push notification success and retry counts
- Registry availability and agent registration totals
- Memory and uptime trends for long-lived agents
