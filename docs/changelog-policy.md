# Changelog Policy

## Versioning model

The repository uses Changesets for package versioning and changelog generation.

## Semantic intent

- `feat:` maps to a minor release
- `fix:` maps to a patch release
- `feat!:` or `BREAKING CHANGE:` maps to a major release
- `chore:`, `docs:`, and `test:` normally do not require a release on their own

## Linked packages

These packages are linked for coordinated releases:

- `a2a-mesh`
- `a2a-mesh-adapters`
- `a2a-mesh-registry`
- `a2a-mesh-cli`

## Author workflow

```bash
npx changeset
```

Choose the affected packages, write a concise summary, and commit the generated markdown file with the feature or fix.

## Release workflow

- Maintainers apply version updates through Changesets.
- Maintainers publish npm packages manually from a verified local environment.
- The root `CHANGELOG.md` remains the canonical public release log.
