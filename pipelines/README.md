# Azure DevOps Pipelines

This repository keeps its Azure DevOps YAML definitions in this folder.

## Files

- `../azure-pipelines.yml` — default CI entrypoint for Azure DevOps auto-detection
- `azure-pipelines-ci.yml` — shared CI wrapper used for build, docs, tests, and coverage
- `azure-pipelines-pr.yml` — PR validation pipeline with changeset enforcement
- `azure-pipelines-release.yml` — tag-based release pipeline for changesets and npm publish
- `templates/ci-job.yml` — reusable CI job template

## Bootstrap with Azure CLI

From the repository root:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\setup-azure-devops.ps1 `
  -Organization https://dev.azure.com/oaslananka `
  -Project open-source `
  -QueueCiRun
```

The script installs or upgrades the `azure-devops` Azure CLI extension, configures
the default organization and project, and then creates or updates the CI, PR, and
release pipelines against the YAML files in this repo.

## Secrets

Before running the release pipeline, add these secrets in Azure DevOps:

- `NPM_TOKEN` for `npm publish`
- any adapter/provider secrets you need for smoke or release tasks later

## Useful commands

```bash
az pipelines list
az pipelines run --name a2a-mesh-ci --branch main
python scripts/azuredevops.py health
python scripts/azuredevops.py status
```
