#!/usr/bin/env bash
set -euo pipefail

# Azure DevOps private repo -> GitLab mirror sync.
# Only sync the main branch and version tags.

if [[ -z "${GITLAB_TOKEN:-}" || -z "${GITLAB_REPO:-}" ]]; then
  echo "GITLAB_TOKEN and GITLAB_REPO must be set" >&2
  exit 1
fi

GITLAB_HOST="${GITLAB_HOST:-gitlab.com}"
GITLAB_REMOTE_URL="https://oauth2:${GITLAB_TOKEN}@${GITLAB_HOST}/${GITLAB_REPO}.git"

if git remote get-url gitlab >/dev/null 2>&1; then
  git remote set-url gitlab "${GITLAB_REMOTE_URL}"
else
  git remote add gitlab "${GITLAB_REMOTE_URL}"
fi

git fetch --tags origin
git push gitlab main --force

mapfile -t VERSION_TAGS < <(git tag --list 'v*')
if [[ ${#VERSION_TAGS[@]} -gt 0 ]]; then
  git push gitlab "${VERSION_TAGS[@]}"
fi

echo "✓ GitLab mirror synced: https://${GITLAB_HOST}/${GITLAB_REPO}"
