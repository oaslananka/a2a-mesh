# a2a-mesh-ws

`a2a-mesh-ws` provides experimental WebSocket transport primitives for `a2a-mesh`.

## Status

This package is intentionally marked experimental for the v1.0 launch. It focuses on JSON-RPC request and response transport over WebSockets so teams can prototype A2A-compatible flows before the full transport binding lands.

## Installation

```bash
npm install a2a-mesh-ws ws
```

## Client example

```ts
import { WsClient } from 'a2a-mesh-ws';

const client = new WsClient('ws://localhost:3000a2a-mesh-ws');
await client.connect();
const task = await client.sendMessage({
  role: 'user',
  parts: [{ type: 'text', text: 'Hello from WebSocket transport' }],
  messageId: 'msg-1',
  timestamp: new Date().toISOString(),
});
```

## Server example

```ts
import { WsServer } from 'a2a-mesh-ws';

const server = new WsServer({
  port: 3010,
  async handleRequest(request) {
    if (request.method === 'tasks/list') {
      return { tasks: [], total: 0 };
    }

    return { ok: true };
  },
});

await server.start();
```
