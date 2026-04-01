# Contributing Guide

## Branching

- `feature/*` for new work
- `fix/*` for bug fixes
- `main` as the release branch

## Required checks

Every contribution should pass:

```bash
npm run lint
npm run typecheck
npm run build
npm run test -- --coverage
python3 scripts/azuredevops.py --help
```

## Tests

- Add unit tests for new public APIs.
- Add integration tests for protocol flows, auth, registry interactions, or CLI changes when behavior crosses package boundaries.
- Keep coverage thresholds aligned with `vitest.config.ts`.

## Documentation

Update docs whenever a user-facing workflow, command, adapter behavior, auth model, or release process changes.

## Releases

- Use Changesets for package changes.
- Azure DevOps is the only CI/CD authority.
- Do not add GitHub Actions workflows.
