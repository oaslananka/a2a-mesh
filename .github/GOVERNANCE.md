# Governance

## Roles

- **Maintainer**: @oaslananka — final decisions on direction, releases and security.
- **Contributor**: Anyone with a merged pull request.
- **Adapter Champion**: Responsible for the quality and roadmap of a specific adapter.

## Decision Making

Significant changes such as breaking API changes, new packages or architectural shifts should be proposed as an RFC in GitHub Discussions under Ideas.

- Consensus period: 7 days
- Final decision: maintainer

## Release Process

1. Changesets accumulate on `main`.
2. Contributors verify changes locally with `npm run lint`, `npm run typecheck`, `npm run build`, and `npm run test`.
3. Releases are cut manually by the maintainer with Changesets.
4. Optional external pipelines may be used for manual validation, docs packaging, or artifact preparation, but they are not required for open source contributions.
