import { createServer } from 'node:http';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { exportJWK, generateKeyPair, SignJWT } from 'jose';
import { JwtAuthMiddleware } from '../src/auth/JwtAuthMiddleware.js';

function encodeSegment(value: Record<string, unknown>): string {
  return Buffer.from(JSON.stringify(value)).toString('base64url');
}

describe('JwtAuthMiddleware', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('validates api keys from headers', async () => {
    const middleware = new JwtAuthMiddleware({
      securitySchemes: [{ type: 'apiKey', id: 'api-key', in: 'header', name: 'x-api-key' }],
      apiKeys: { 'api-key': 'secret' },
    });

    const result = await middleware.authenticateRequest({
      header(name: string) {
        return name === 'x-api-key' ? 'secret' : undefined;
      },
      query: {},
    } as never);

    expect(result.schemeId).toBe('api-key');
  });

  it('validates api keys from query parameters', async () => {
    const middleware = new JwtAuthMiddleware({
      securitySchemes: [{ type: 'apiKey', id: 'api-key', in: 'query', name: 'api_key' }],
      apiKeys: { 'api-key': ['secret'] },
    });

    const result = await middleware.authenticateRequest({
      header() {
        return undefined;
      },
      query: { api_key: 'secret' },
    } as never);

    expect(result.schemeId).toBe('api-key');
  });

  it('rejects invalid api keys', async () => {
    const middleware = new JwtAuthMiddleware({
      securitySchemes: [{ type: 'apiKey', id: 'api-key', in: 'header', name: 'x-api-key' }],
      apiKeys: { 'api-key': 'secret' },
    });

    await expect(
      middleware.authenticateRequest({
        header() {
          return 'wrong';
        },
        query: {},
      } as never),
    ).rejects.toThrow('Invalid API key');
  });

  it('reads bearer tokens for http auth schemes', async () => {
    const payload = encodeSegment({ sub: 'user-1' });
    const token = `aaa.${payload}.bbb`;
    const middleware = new JwtAuthMiddleware({
      securitySchemes: [{ type: 'http', id: 'bearer', scheme: 'bearer' }],
    });

    const result = await middleware.authenticateRequest({
      header(name: string) {
        return name === 'authorization' ? `Bearer ${token}` : undefined;
      },
      query: {},
    } as never);

    expect(result.subject).toBe('user-1');
  });

  it('returns JSON-RPC unauthorized responses from express middleware', async () => {
    const middleware = new JwtAuthMiddleware({
      securitySchemes: [{ type: 'http', id: 'bearer', scheme: 'bearer' }],
    });
    const response = {
      statusCode: 200,
      body: undefined as unknown,
      status(code: number) {
        this.statusCode = code;
        return this;
      },
      json(payload: unknown) {
        this.body = payload;
        return this;
      },
    };
    const next = vi.fn();

    await middleware.middleware()({
      header() {
        return undefined;
      },
      body: { id: 'rpc-1' },
      query: {},
    } as never, response as never, next);

    expect(next).not.toHaveBeenCalled();
    expect(response.statusCode).toBe(401);
    expect(response.body).toEqual(
      expect.objectContaining({
        id: 'rpc-1',
        error: expect.objectContaining({ message: 'Unauthorized' }),
      }),
    );
  });

  it('rejects unknown security schemes in security requirements', async () => {
    const middleware = new JwtAuthMiddleware({
      securitySchemes: [{ type: 'apiKey', id: 'api-key', in: 'header', name: 'x-api-key' }],
      security: [{ missing: [] }],
      apiKeys: { 'api-key': 'secret' },
    });

    await expect(
      middleware.authenticateRequest({
        header() {
          return 'secret';
        },
        query: {},
      } as never),
    ).rejects.toThrow('Unknown security scheme: missing');
  });

  it('validates oidc tokens through discovery and jwks', async () => {
    const { publicKey, privateKey } = await generateKeyPair('RS256');
    const jwk = await exportJWK(publicKey);
    jwk.use = 'sig';
    jwk.kid = 'test-key';

    let issuerBaseUrl = '';
    const server = createServer((req, res) => {
      if (req.url === '/.well-known/openid-configuration') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(
          JSON.stringify({
            issuer: issuerBaseUrl,
            jwks_uri: `${issuerBaseUrl}/jwks`,
          }),
        );
        return;
      }

      if (req.url === '/jwks') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ keys: [jwk] }));
        return;
      }

      res.writeHead(404);
      res.end();
    });
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', () => resolve()));
    const address = server.address();
    if (!address || typeof address === 'string') {
      throw new Error('Failed to get OIDC test server address');
    }
    issuerBaseUrl = `http://127.0.0.1:${address.port}`;

    const token = await new SignJWT({})
      .setProtectedHeader({ alg: 'RS256', kid: 'test-key' })
      .setSubject('oidc-user')
      .setIssuer(issuerBaseUrl)
      .setAudience('a2a-mesh')
      .setExpirationTime('2h')
      .sign(privateKey);

    const middleware = new JwtAuthMiddleware({
      securitySchemes: [
        {
          type: 'openIdConnect',
          id: 'oidc',
          openIdConnectUrl: `${issuerBaseUrl}/.well-known/openid-configuration`,
          audience: 'a2a-mesh',
        },
      ],
    });

    try {
      const result = await middleware.authenticateRequest({
        header(name: string) {
          return name === 'authorization' ? `Bearer ${token}` : undefined;
        },
        query: {},
      } as never);

      expect(result.subject).toBe('oidc-user');
    } finally {
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
  });

  it('fails when oidc discovery omits the jwks uri', async () => {
    const server = createServer((req, res) => {
      if (req.url === '/.well-known/openid-configuration') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ issuer: 'http://issuer.example' }));
        return;
      }

      res.writeHead(404);
      res.end();
    });
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', () => resolve()));
    const address = server.address();
    if (!address || typeof address === 'string') {
      throw new Error('Failed to get OIDC test server address');
    }

    const middleware = new JwtAuthMiddleware({
      securitySchemes: [
        {
          type: 'openIdConnect',
          id: 'oidc',
          openIdConnectUrl: `http://127.0.0.1:${address.port}/.well-known/openid-configuration`,
          audience: 'a2a-mesh',
        },
      ],
    });

    try {
      await expect(
        middleware.authenticateRequest({
          header(name: string) {
            return name === 'authorization' ? 'Bearer a.b.c' : undefined;
          },
          query: {},
        } as never),
      ).rejects.toThrow('OIDC configuration is missing jwks_uri');
    } finally {
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
  });
});
