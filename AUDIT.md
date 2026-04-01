# a2a-mesh Repository Audit (March 2026)

## Overview
An exhaustive review and refactoring of the `a2a-mesh` monorepo was performed to assess protocol compliance, monorepo architecture, testing robustness, and standard ecosystem expectations. The goal was to align the library with the stable **A2A Protocol v1.0.0** while simultaneously preserving backwards compatibility with **A2A v0.3.0**.

## Findings

| Claim / Component | Actual State (Pre-Refactor) | Risk Level | Fix / Action Taken |
|-------------------|----------------------------|------------|--------------------|
| **Monorepo Build** | Broken TS resolution, generated `.js`/`.d.ts` artifacts checked into `src/`. | **High** | Wiped generated artifacts from `src/`. Switched to standard TS Project References via `tsconfig.base.json`. Adopted `unbuild` to dual-publish ESM (`.mjs`) and CJS (`.cjs`). |
| **A2A Protocol Version** | Hardcoded to `v0.3` across the entire repo. Did not reflect the 1.0.0 realities. | **Critical** | Redesigned the core `AgentCard` schema to align with `v1.0`. Implemented a `normalizeAgentCard` mapper to support backwards compatibility for older agents identifying as `v0.3`. |
| **OpenAI Adapter** | Deprecated Assistants API implementation using naive polling logic. | **High** | Completely rewrote `OpenAIAdapter` to use the modern OpenAI Chat Completions API (`client.chat.completions`). |
| **LangChain Adapter** | Used legacy `executor.invoke({ input })` pattern, not mapping modern conversation history correctly. | **High** | Refactored `LangChainAdapter` to invoke modern LangChain JS v1 runnables and map standard task history to LangChain message formats. |
| **Task / Server Streaming** | Only supported a single subscriber per task via simple map assignments. | **Medium** | Improved `SSEStreamer` to manage a Set of Express `Response` objects per task, allowing multiple streams to subscribe to a task state simultaneously. |
| **Testing** | Limited and superficial unit tests. `typecheck` and `lint` did not pass cleanly. | **High** | Fixed typings, improved test suite reliability, and ran end-to-end multi-agent orchestration via `apps/demo`. |
| **CLI & Registry** | Skill matching assumed `.tags` was always present. Broken docker bindings. | **Medium** | Hardened `SkillMatcher` with safe optional chaining. Removed docker dependencies from CLI examples and created reliable demo environments. |

## Protocol Compliance Reality Check
- `/.well-known/agent.json`: Fully supported for both v0.3 and v1.0 models.
- `message/send` & `message/stream` (SSE): Supported.
- `agent/authenticatedExtendedCard`: Re-mapped correctly inside `capabilities.extendedAgentCard`.
- `tasks/pushNotification/*`: Explicitly **unsupported**.
- gRPC transport: Fully typed and functional.

## Next Steps / Remaining Risks
- The current OpenAI and LangChain adapters are marked as **experimental** as they assume primarily textual task workflows (tool calling loops and structural output definitions are out of scope for the current v0.1 release baseline).
- The `RegistryServer` serves as an excellent development or local helper, but lacks persistent backing stores for production loads.
- The `eslint` v9 (flat config) and `changesets` setup provide CI confidence, but maintaining backward compatibility rules requires periodic oversight against ecosystem shifts.