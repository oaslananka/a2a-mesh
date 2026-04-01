# `a2a-mesh-codex-bridge`

Use the Codex bridge package when you want to expose `a2a-mesh` agents behind
Codex, App Server, or MCP-style tool calls.

```ts
import { createA2ASendMessageTool, createRegistryListTool } from 'a2a-mesh-codex-bridge';
```

This package is intentionally bridge-focused:

- map tool input to `message/send`
- map A2A task output back to tool output
- expose registry listing/search to a host app
- report progress through host-owned callbacks

It does not replace `a2a-mesh`; it sits on top of the existing A2A
runtime and client SDK.

For the first public launch, `a2a-mesh-codex-bridge` remains an in-repo
integration package and is **not part of the initial npm release wave**.
