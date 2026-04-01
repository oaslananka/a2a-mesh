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

1. Open PRs on GitHub against `main`.
2. Add tests for every public behavior change.
3. Add or update docs when user-facing behavior changes.
4. Add a changeset for public package changes.
5. Keep PRs focused and release-note friendly.

## CI and releases

- GitHub is the public contribution surface for issues, PRs and discussions.
- GitHub Actions provide public CI, dependency hygiene and security scanning.
- Azure DevOps remains the authoritative release and publish backend.
- npm publishing and GitHub release creation happen from Azure DevOps release pipelines.

Detailed contributor guidance lives in [docs/contributing.md](./docs/contributing.md).
