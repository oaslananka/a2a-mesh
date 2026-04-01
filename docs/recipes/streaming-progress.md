# Streaming Progress

Use `message/stream` or the client-side `sendMessageStream()` helper to surface live task progress.

```ts
const stream = await client.sendMessageStream({ message, contextId: 'stream-demo' });
for await (const event of stream) {
  console.log(event);
}
```

Server-side, `a2a-mesh` will emit terminal task updates and close the SSE stream automatically.
