# a2a-mesh

Production-ready TypeScript runtime for Google's Agent2Agent (A2A) Protocol v1.0.

## Public packages

- `a2a-mesh` for the main runtime, client APIs, auth, telemetry, and storage
- `a2a-mesh-adapters` for provider integrations
- `a2a-mesh-registry` for optional shared registry deployments
- `a2a-mesh-cli` for validation, monitoring, benchmarking, export, and scaffolding
- `create-a2a-mesh` for project scaffolding

Most users start with `npm install a2a-mesh` and only add adapters, registry, or CLI when they actually need them.

The repository also contains advanced in-repo packages for client-only installs, testing utilities, transport experiments, and ecosystem bridges. Those remain documented, but they are not part of the first public npm release wave.

## Start here

- [Guide / Introduction](./guide/introduction)
- [Quick Start](./guide/quick-start)
- [Packages](./packages/core)
- [Protocol docs](./protocol/compliance)
