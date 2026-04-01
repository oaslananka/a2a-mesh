# Deployment

## Docker

Recommended container flow:

1. Install dependencies with `npm ci`.
2. Build the monorepo with `npm run build`.
3. Start the required package or app using the generated `dist` entrypoint.

For local orchestration, `docker-compose.yml` provides the quickest path for demo services.

## Cloud Run

Cloud Run works best for stateless HTTP/SSE agents.

- Expose the A2A HTTP endpoint on the service port expected by Cloud Run.
- Ensure push notification targets are publicly reachable or routed through a gateway.
- Keep secrets in Secret Manager or the platform equivalent instead of baking them into images.

## Kubernetes

Recommended split:

- Deploy each agent as its own deployment and service.
- Deploy the registry separately so it can scale independently.
- Wire liveness and readiness probes to `/health`.
- Scrape the registry `/metrics` endpoint for fleet visibility.
- Use ConfigMaps and Secrets for auth and adapter configuration.

## Release workflow

- Build, test, and publish from Azure DevOps.
- Publish npm packages from the release pipeline only.
- Use `scripts/sync-github.sh` to mirror `main` and semver tags to GitHub.
