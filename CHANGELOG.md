# Changelog

All notable changes to `a2a-mesh` are documented in this file.

The repository uses Changesets for versioning and release notes generation.

## 1.0.0 - 2026-04-01

### Added

- Production-ready A2A Protocol v1.0 server runtime with task lifecycle, push notifications, extension negotiation and richer health reporting.
- Main `a2a-mesh` package now includes the default client APIs for discovery, JSON-RPC, SSE and registry access.
- Adapter coverage for OpenAI, Anthropic, LangChain, Google ADK, CrewAI and LlamaIndex.
- Registry package with in-memory and Redis-backed storage.
- Testing utilities package for in-process A2A integration tests.
- GitHub-first open source community surface with issue forms, PR template, security policy and governance docs.
- Public CI workflows for GitHub plus Azure DevOps release hardening.

### Changed

- All public packages are versioned as `1.0.0` and target Node.js `>=20`.
- Package metadata, exports and publish surfaces were normalized for npm launch quality.
- Root documentation was rewritten around GitHub-first adoption and v1.0 positioning.
- Migration guidance now documents the 0.x to 1.0 API and packaging changes.

### Removed

- Azure-first wording from public-facing documentation.
- Legacy singular AgentCard mode fields from the documented public surface.
