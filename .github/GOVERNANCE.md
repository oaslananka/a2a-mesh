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
2. GitHub Actions run public CI and security scans.
3. Azure DevOps runs the authoritative release pipeline.
4. Maintainer merges the release work.
5. Azure DevOps publishes to npm and creates the GitHub release.
