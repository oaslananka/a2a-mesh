# `a2a-mesh-client`

Advanced companion package for teams that want the client SDK split out from the main runtime package.

This package stays in the monorepo, but it is **not part of the first public npm release wave**.

Most users should import `A2AClient` and `AgentRegistryClient` directly from `a2a-mesh`.

This package remains useful when you explicitly want a thinner client-only dependency.

It contains:

- resolving agent cards
- calling A2A JSON-RPC methods
- following SSE task streams
- querying `/health`
- using retry and header interceptors
