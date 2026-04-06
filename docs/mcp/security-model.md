# MCP Bridge Security

When bridging `a2a-mesh` to MCP, there are two distinct security domains that must be carefully managed.

## Exposing A2A as an MCP Tool

When creating an MCP tool using `createMcpToolFromAgent(config)`, you can securely pass authentication parameters via `config.token`.

- The bridge uses `createAuthenticatingFetchWithRetry` to inject the HTTP Bearer token securely when communicating with your protected A2A network.
- The `token` is never logged or exposed in the generated MCP Tool definition.

## Exposing MCP as an A2A Skill

When an A2A agent connects to an external MCP Server (e.g. using STDIO or SSE transports), it must adhere to the A2A authorization model natively.

- Any tasks generated to interact with the MCP server are securely bound to the `principalId` of the user.
- If the MCP server exposes sensitive tools, those specific tools can be gated on the A2A Agent side before they are executed.
