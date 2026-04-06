# Testing Strategy

The `a2a-mesh` platform relies on a layered testing matrix to ensure extreme reliability, backward compatibility, and developer confidence.

## Test Pyramid

1. **Unit Tests (Vitest)**
   - Located inside `packages/*/tests/`.
   - Goal: Test isolated algorithms, classes, storage adapters, and routing logic.
   - Execution: `npm run test:unit`

2. **Integration Tests (Vitest + Supertest / HTTP)**
   - Located in the root `tests/integration/` folder.
   - Goal: Spin up real `A2AServer`, `RegistryServer`, and multiple `A2AClient` nodes running on ephemeral ports.
   - Validates end-to-end multi-agent pipelines (Orchestrator -> Researcher -> Writer).
   - Execution: `npm run test:integration`

3. **Contract / CLI Smoke Tests**
   - Located in `cli/tests/`.
   - Goal: Generate projects using the CLI scaffold (`create-a2a-mesh` / `a2a scaffold`), build the output, and assert the artifacts are production-ready.
4. **UI Smoke / E2E Tests (Playwright)**
   - Located in `apps/registry-ui/tests/`.
   - Goal: Boot the visual Control Plane, connect it to a mocked or local Registry, and visually assert that elements like Agent Cards, Status Badges, and Live Stream inputs render correctly without throwing JS errors.

## Flake Hunting

To prevent "flaky" tests:

- **No Hardcoded Ports:** All Integration and CLI tests must bind to ephemeral ports (`server.listen(0)`).
- **Jitter and Timeouts:** Timers in tests (like Redis health checks) should use `vi.useFakeTimers()` to instantly resolve, preventing race conditions.
- **Cleanup:** `afterEach` hooks **must** call `.close()` on any active HTTP server, EventSource, or WebSocket to prevent handle leaks.
