# Context Continuation

`contextId` is the canonical way to continue a long-running conversation in `a2a-mesh` v1.0.

```ts
await client.sendMessage({
  message,
  contextId: 'customer-session-42',
});
```

Use `tasks/list` with the same `contextId` to inspect the whole execution trail for that conversation.
