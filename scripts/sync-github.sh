#!/usr/bin/env bash
set -euo pipefail

# Azure DevOps private repo -> GitHub public mirror sync.
# Only sync the main branch and version tags.
# GitHub Pages deploys automatically from mirrored pushes that touch docs-site/**.

if [[ -z "${GITHUB_PAT:-}" || -z "${GITHUB_REPO:-}" ]]; then
  echo "GITHUB_PAT and GITHUB_REPO must be set" >&2
  exit 1
fi

GITHUB_REMOTE_URL="https://${GITHUB_PAT}@github.com/${GITHUB_REPO}.git"

if git remote get-url github >/dev/null 2>&1; then
  git remote set-url github "${GITHUB_REMOTE_URL}"
else
  git remote add github "${GITHUB_REMOTE_URL}"
fi

git fetch --tags origin
git push github main --force

mapfile -t VERSION_TAGS < <(git tag --list 'v*')
if [[ ${#VERSION_TAGS[@]} -gt 0 ]]; then
  git push github "${VERSION_TAGS[@]}"
fi

echo "✓ GitHub mirror synced: https://github.com/${GITHUB_REPO}"
