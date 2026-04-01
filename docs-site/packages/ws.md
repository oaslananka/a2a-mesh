# a2a-mesh-ws

`a2a-mesh-ws` is the experimental WebSocket transport layer for `a2a-mesh`.

## What it includes

- `WsClient` for JSON-RPC requests over WebSocket
- `WsServer` for lightweight JSON-RPC transport handling
- A practical bridge for teams exploring low-latency A2A-style flows before the transport matures further

## Install

```bash
npm install a2a-mesh-ws ws
```

## Status

This package ships as an experimental v1.0 companion. The stable HTTP + SSE transport in `a2a-mesh` remains the primary recommendation for production deployments.

It is kept in the repository but is **not part of the first public npm launch wave**. A later npm
release can publish it once the transport surface stabilizes.
