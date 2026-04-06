# Changelog

All notable changes to `a2a-mesh` are documented in this file.

The repository uses Changesets for versioning and release notes generation.

## Unreleased

### Fixed

- Remove duplicate `module` fields from published package manifests before release packaging.
- Correct the roadmap and architecture docs to reflect already-shipped features and real npm package names.
- Replace internal-only CI wording with contributor-friendly local verification and Changesets guidance.
- Add a non-breaking `/rpc` JSON-RPC alias and validate push notification URLs against SSRF rules.

### Added

- `a2a-mesh-mcp-bridge` README and publish metadata for the upcoming npm release wave.
- WebSocket integration coverage via `packages/ws/tests/ws.test.ts`.
- Registry control-plane endpoints for metrics summary, agent streaming, recent tasks, and task streaming.
- Registry UI rewrite with Vite, React, Tailwind, live topology, and task stream views.
- Demo smoke-test flow, embedded registry fallback, and public docs-site deploy configuration.

## 1.0.0 - 2026-04-01

### Added

- Production-ready A2A Protocol v1.0 server runtime with task lifecycle, push notifications, extension negotiation and richer health reporting.
- Main `a2a-mesh` package now includes the default client APIs for discovery, JSON-RPC, SSE and registry access.
- Adapter coverage for OpenAI, Anthropic, LangChain, Google ADK, CrewAI and LlamaIndex.
- Registry package with in-memory and Redis-backed storage.
- Testing utilities package for in-process A2A integration tests.
- Public repository community surface with issue forms, PR template, security policy and governance docs.
- Manual release hardening and repository maintenance workflows.

### Changed

- All public packages are versioned as `1.0.0` and target Node.js `>=20`.
- Package metadata, exports and publish surfaces were normalized for npm launch quality.
- Root documentation was rewritten around v1.0 positioning and operational adoption.
- Migration guidance now documents the 0.x to 1.0 API and packaging changes.

### Removed

- Mandatory GitHub delivery assumptions from public-facing documentation.
- Legacy singular AgentCard mode fields from the documented public surface.
