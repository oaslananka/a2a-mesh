/**
 * @file auth.ts
 * Authentication and authorization related types.
 */

export interface BaseAuthScheme {
  id: string;
  description?: string;
}

export interface ApiKeyAuthScheme extends BaseAuthScheme {
  type: 'apiKey';
  in: 'header' | 'query';
  name: string;
}

export interface HttpAuthScheme extends BaseAuthScheme {
  type: 'http';
  scheme: 'bearer';
  bearerFormat?: string;
}

export interface OpenIdConnectAuthScheme extends BaseAuthScheme {
  type: 'openIdConnect';
  openIdConnectUrl: string;
  audience?: string | string[];
  issuer?: string;
  jwksUri?: string;
  algorithms?: string[];
}

export type AuthScheme = ApiKeyAuthScheme | HttpAuthScheme | OpenIdConnectAuthScheme;

export interface ApiKeyCredentialSource {
  [schemeId: string]: string | string[];
}

export interface AuthValidationResult {
  schemeId: string;
  subject?: string;
  claims?: Record<string, unknown>;
}
