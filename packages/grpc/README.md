# a2a-mesh-grpc

gRPC transport bindings for `a2a-mesh`.

This package contains the proto definition plus server and client helpers for gRPC-based A2A transport experiments.

It remains in the repository, but it is not part of the first public npm release wave.

## Status

`a2a-mesh-grpc` is in the monorepo as an experimental transport layer.
It is **not yet published to npm** and has no stability guarantee.

Use it if you want to experiment with gRPC-based A2A transport.
Production use: wait for the v1.2 stable release.

## Usage (experimental)

```ts
import { GrpcServer } from 'a2a-mesh-grpc';

const server = new GrpcServer({
  port: 50051,
  handleRequest: async (req) => ({ requestId: req.id ?? 'ok' }),
});

await server.start();
```

The `.proto` definition lives at `proto/a2a.proto`.
