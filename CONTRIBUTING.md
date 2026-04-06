# Contributing

Thanks for helping improve `a2a-mesh`.

## Local workflow

1. Install dependencies with `npm install`.
2. Run `npm run lint`.
3. Run `npm run typecheck`.
4. Run `npm run build`.
5. Run `npm run test -- --coverage`.
6. Verify the CLI and docs changes relevant to your work.

## Pull requests

1. Open PRs against `main` on the public collaboration surface in use.
2. Add tests for every public behavior change.
3. Add or update docs when user-facing behavior changes.
4. Add a changeset for public package changes.
5. Keep PRs focused and release-note friendly.

## CI and releases

Tests run locally via `npm run test` and `npm run typecheck`.
To verify your change before submitting a PR, run the full check suite:

```bash
npm install
npm run lint
npm run typecheck
npm run build
npm run test -- --coverage
```

Releases are cut by the maintainer using [Changesets](https://github.com/changesets/changesets).
Add a changeset for any public package change with `npx changeset`.
You do not need CI/CD access to contribute — local test pass is sufficient.

## AI-assisted contributions

AI-assisted contributions are welcome, but contributors remain responsible for correctness,
security, licensing, and test coverage.

If you use tools such as Codex or Gemini while preparing a contribution, review the output
carefully and treat it as draft material that still needs human verification.

Detailed contributor guidance lives in [docs/contributing.md](./docs/contributing.md).
