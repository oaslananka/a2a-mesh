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

This repository does not rely on GitHub Actions for deployment.

### Package release

Use Changesets to prepare versions:

```bash
npx changeset
npm run build
npm run test
npm run release
```

### Docs deployment

For Vercel:

```bash
cd docs-site
npm install
npm run build
vercel
vercel --prod
```

For Netlify:

```bash
cd docs-site
npm install
npm run build
netlify deploy --dir .vitepress/dist --prod
```

For Railway or another container host, build the docs statically and serve `.vitepress/dist`
behind any CDN or static file service.
