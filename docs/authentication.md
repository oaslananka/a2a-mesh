# Authentication

## Supported schemes

`a2a-mesh` supports the following `AgentCard.securitySchemes`:

- `apiKey`
- `http` bearer
- `openIdConnect`

## API keys

API keys can be validated from either headers or query parameters.

```ts
const server = new MyServer(card, {
  auth: {
    securitySchemes: [{ type: 'apiKey', id: 'api-key', in: 'header', name: 'x-api-key' }],
    apiKeys: {
      'api-key': ['dev-secret', 'ci-secret'],
    },
  },
});
```

## Bearer tokens

HTTP bearer schemes decode bearer tokens and expose claims on the request auth context.

## OIDC

OIDC support uses discovery and JWKS resolution.

- Discovery starts from `openIdConnectUrl`.
- `jwks_uri` is taken from discovery unless overridden.
- Accepted algorithms default to `RS256` and `ES256`.
- Audience and issuer validation are enforced when configured.

## Protected endpoint

`agent/authenticatedExtendedCard` is protected when auth middleware is configured and the card declares `capabilities.extendedAgentCard`.

## Registry and client notes

- Use `a2a-mesh` client interceptors to attach and refresh auth headers.
- Prefer short-lived bearer tokens in production.
- Avoid query-parameter API keys except for tightly controlled internal tooling.
