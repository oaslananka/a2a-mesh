/**
 * @file rateLimiter.ts
 * Express middleware for per-client request throttling.
 */

import type { NextFunction, Request, Response } from 'express';
import { ErrorCodes } from '../types/jsonrpc.js';

export interface RateLimitConfig {
  windowMs: number;
  maxRequests: number;
  keyGenerator?: (req: Request) => string;
}

export interface RateLimitState {
  count: number;
  resetTime: number;
}

export interface RateLimitStore {
  increment(key: string, windowMs: number): Promise<RateLimitState>;
}

export class InMemoryRateLimitStore implements RateLimitStore {
  private readonly state = new Map<string, RateLimitState>();

  async increment(key: string, windowMs: number): Promise<RateLimitState> {
    const now = Date.now();
    const current = this.state.get(key);
    if (!current || current.resetTime <= now) {
      const nextState = { count: 1, resetTime: now + windowMs };
      this.state.set(key, nextState);
      return nextState;
    }

    const nextState = { ...current, count: current.count + 1 };
    this.state.set(key, nextState);
    return nextState;
  }
}

export interface RedisRateLimitClient {
  get(key: string): Promise<string | null>;
  incr(key: string): Promise<number>;
  pexpire(key: string, ttl: number): Promise<number>;
  pttl(key: string): Promise<number>;
}

export class RedisRateLimitStore implements RateLimitStore {
  constructor(private readonly client: RedisRateLimitClient) {}

  async increment(key: string, windowMs: number): Promise<RateLimitState> {
    const current = await this.client.get(key);
    if (current === null) {
      await this.client.incr(key);
      await this.client.pexpire(key, windowMs);
      return {
        count: 1,
        resetTime: Date.now() + windowMs,
      };
    }

    const count = await this.client.incr(key);
    const ttl = await this.client.pttl(key);
    return {
      count,
      resetTime: Date.now() + Math.max(ttl, 0),
    };
  }
}

function getClientIp(req: Request): string {
  const forwarded = req.headers['x-forwarded-for'];
  if (typeof forwarded === 'string' && forwarded.length > 0) {
    return forwarded.split(',')[0]?.trim() ?? 'unknown';
  }

  return req.ip || req.socket.remoteAddress || 'unknown';
}

/**
 * Create an Express middleware that enforces per-client request limits and emits JSON-RPC errors.
 *
 * @param config Partial limiter configuration.
 * @param store Optional backing store implementation.
 * @returns Express-compatible async middleware.
 * @since 1.0.0
 */
export function createRateLimiter(
  config: Partial<RateLimitConfig> = {},
  store: RateLimitStore = new InMemoryRateLimitStore(),
) {
  const windowMs = config.windowMs ?? 60_000;
  const maxRequests = config.maxRequests ?? 100;
  const keyGenerator = config.keyGenerator ?? getClientIp;

  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const key = keyGenerator(req);
    const state = await store.increment(key, windowMs);
    const remaining = Math.max(maxRequests - state.count, 0);

    res.setHeader('X-RateLimit-Limit', String(maxRequests));
    res.setHeader('X-RateLimit-Remaining', String(remaining));
    res.setHeader('X-RateLimit-Reset', String(Math.floor(state.resetTime / 1000)));

    if (state.count > maxRequests) {
      res.status(429).json({
        jsonrpc: '2.0',
        error: {
          code: ErrorCodes.RateLimitExceeded,
          message: 'Too Many Requests',
          data: { retryAfterMs: Math.max(state.resetTime - Date.now(), 0) },
        },
        id: req.body && typeof req.body === 'object' && 'id' in req.body ? req.body.id : null,
      });
      return;
    }

    next();
  };
}
