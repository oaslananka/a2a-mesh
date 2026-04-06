/**
 * @file JwtAuthMiddleware.ts
 * Authentication middleware backed by OIDC discovery, JWKS and API keys.
 */

import type { NextFunction, Request, Response } from 'express';
import { createRemoteJWKSet, jwtVerify, type JWTPayload } from 'jose';
import type {
  ApiKeyCredentialSource,
  AuthScheme,
  AuthValidationResult,
  OpenIdConnectAuthScheme,
} from '../types/auth.js';

export interface JwtAuthMiddlewareOptions {
  securitySchemes: AuthScheme[];
  security?: Record<string, string[]>[];
  apiKeys?: ApiKeyCredentialSource;
}

/**
 * Authentication middleware that evaluates A2A security schemes against incoming requests.
 *
 * Supports API keys, HTTP bearer tokens, and OIDC discovery with JWKS validation.
 *
 * @since 1.0.0
 */
export class JwtAuthMiddleware {
  private readonly remoteSets = new Map<string, ReturnType<typeof createRemoteJWKSet>>();

  constructor(private readonly options: JwtAuthMiddlewareOptions) {}

  async authenticateRequest(req: Request): Promise<AuthValidationResult> {
    const securityRequirements =
      this.options.security && this.options.security.length > 0
        ? this.options.security
        : [Object.fromEntries(this.options.securitySchemes.map((scheme) => [scheme.id, []]))];

    let lastError: Error | undefined;
    for (const requirement of securityRequirements) {
      try {
        for (const schemeId of Object.keys(requirement)) {
          const scheme = this.options.securitySchemes.find((item) => item.id === schemeId);
          if (!scheme) {
            throw new Error(`Unknown security scheme: ${schemeId}`);
          }

          if (scheme.type === 'apiKey') {
            return this.validateApiKey(req, scheme);
          }

          if (scheme.type === 'http') {
            return this.validateBearerToken(req);
          }

          if (scheme.type === 'openIdConnect') {
            return this.validateOidcToken(req, scheme);
          }
        }
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
      }
    }

    throw lastError ?? new Error('Authentication failed');
  }

  middleware() {
    return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
      try {
        const authResult = await this.authenticateRequest(req);
        Object.assign(req, { auth: authResult });
        next();
      } catch (error) {
        res.status(401).json({
          jsonrpc: '2.0',
          error: {
            code: -32040,
            message: 'Unauthorized',
            data: { reason: String(error) },
          },
          id: req.body && typeof req.body === 'object' && 'id' in req.body ? req.body.id : null,
        });
      }
    };
  }

  private validateApiKey(
    req: Request,
    scheme: Extract<AuthScheme, { type: 'apiKey' }>,
  ): AuthValidationResult {
    const expected = this.options.apiKeys?.[scheme.id];
    const validValues = Array.isArray(expected) ? expected : expected ? [expected] : [];
    if (validValues.length === 0) {
      throw new Error(`No API key configured for scheme ${scheme.id}`);
    }

    const incoming =
      scheme.in === 'header'
        ? req.header(scheme.name)
        : typeof req.query[scheme.name] === 'string'
          ? req.query[scheme.name]
          : undefined;

    if (typeof incoming !== 'string' || !validValues.includes(incoming)) {
      throw new Error('Invalid API key');
    }

    return { schemeId: scheme.id };
  }

  private async validateOidcToken(
    req: Request,
    scheme: OpenIdConnectAuthScheme,
  ): Promise<AuthValidationResult> {
    const token = this.readBearerToken(req);
    const discoveryResponse = await fetch(scheme.openIdConnectUrl);
    if (!discoveryResponse.ok) {
      throw new Error(`Failed to fetch OIDC configuration: ${discoveryResponse.status}`);
    }

    const discovery = (await discoveryResponse.json()) as {
      issuer?: string;
      jwks_uri?: string;
    };
    const jwksUri = scheme.jwksUri ?? discovery.jwks_uri;
    if (!jwksUri) {
      throw new Error('OIDC configuration is missing jwks_uri');
    }

    let remoteSet = this.remoteSets.get(jwksUri);
    if (!remoteSet) {
      remoteSet = createRemoteJWKSet(new URL(jwksUri));
      this.remoteSets.set(jwksUri, remoteSet);
    }

    const verifyOptions = {
      ...(scheme.audience ? { audience: scheme.audience } : {}),
      ...((scheme.issuer ?? discovery.issuer) ? { issuer: scheme.issuer ?? discovery.issuer } : {}),
      algorithms: scheme.algorithms ?? ['RS256', 'ES256'],
    };

    const { payload } = await jwtVerify(token, remoteSet, verifyOptions);

    return {
      schemeId: scheme.id,
      ...(payload.sub ? { subject: payload.sub } : {}),
      claims: payload as unknown as Record<string, unknown>,
    };
  }

  private async validateBearerToken(req: Request): Promise<AuthValidationResult> {
    const token = this.readBearerToken(req);
    const payload = this.decodeJwtWithoutValidation(token);
    return {
      schemeId: 'bearer',
      ...(payload.sub ? { subject: payload.sub } : {}),
      claims: payload as unknown as Record<string, unknown>,
    };
  }

  private readBearerToken(req: Request): string {
    const header = req.header('authorization');
    if (!header || !header.toLowerCase().startsWith('bearer ')) {
      throw new Error('Missing bearer token');
    }

    return header.slice('bearer '.length).trim();
  }

  private decodeJwtWithoutValidation(token: string): JWTPayload {
    const parts = token.split('.');
    if (parts.length < 2) {
      throw new Error('Invalid JWT');
    }

    const payloadJson = Buffer.from(parts[1] ?? '', 'base64url').toString('utf8');
    return JSON.parse(payloadJson) as JWTPayload;
  }
}
