import { describe, expect, it, vi } from 'vitest';
import {
  createRateLimiter,
  InMemoryRateLimitStore,
  RedisRateLimitStore,
} from '../src/middleware/rateLimiter.js';

describe('createRateLimiter', () => {
  it('returns 429 JSON-RPC response after limit is exceeded', async () => {
    const limiter = createRateLimiter(
      { windowMs: 60_000, maxRequests: 1 },
      new InMemoryRateLimitStore(),
    );

    const request = {
      ip: '127.0.0.1',
      socket: { remoteAddress: '127.0.0.1' },
      headers: {},
      header: vi.fn(),
      body: { id: '1' },
    };
    const response = {
      headers: new Map<string, string>(),
      setHeader(key: string, value: string) {
        this.headers.set(key, value);
      },
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

    await limiter(request as never, response as never, next);
    await limiter(request as never, response as never, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(response.statusCode).toBe(429);
    expect(response.body).toEqual(
      expect.objectContaining({
        error: expect.objectContaining({
          message: 'Too Many Requests',
        }),
      }),
    );
  });

  it('uses the forwarded ip header when available', async () => {
    const limiter = createRateLimiter(
      { windowMs: 60_000, maxRequests: 1 },
      new InMemoryRateLimitStore(),
    );

    const firstRequest = {
      ip: '127.0.0.1',
      socket: { remoteAddress: '127.0.0.1' },
      headers: { 'x-forwarded-for': '203.0.113.10, 127.0.0.1' },
      header: vi.fn(),
      body: {},
    };
    const secondRequest = {
      ...firstRequest,
      headers: { 'x-forwarded-for': '203.0.113.10' },
    };
    const response = {
      headers: new Map<string, string>(),
      setHeader(key: string, value: string) {
        this.headers.set(key, value);
      },
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

    await limiter(firstRequest as never, response as never, next);
    await limiter(secondRequest as never, response as never, next);

    expect(response.headers.get('X-RateLimit-Remaining')).toBe('0');
    expect(response.statusCode).toBe(429);
  });
});

describe('RedisRateLimitStore', () => {
  it('initializes ttl for a new redis key and reuses existing ttl afterwards', async () => {
    const values = new Map<string, number>();
    const expirations = new Map<string, number>();
    const client = {
      async get(key: string) {
        return values.has(key) ? String(values.get(key)) : null;
      },
      async incr(key: string) {
        const nextValue = (values.get(key) ?? 0) + 1;
        values.set(key, nextValue);
        return nextValue;
      },
      async pexpire(key: string, ttl: number) {
        expirations.set(key, ttl);
        return 1;
      },
      async pttl(key: string) {
        return expirations.get(key) ?? -1;
      },
    };

    const store = new RedisRateLimitStore(client);
    const first = await store.increment('client-1', 1_000);
    const second = await store.increment('client-1', 1_000);

    expect(first.count).toBe(1);
    expect(second.count).toBe(2);
    expect(expirations.get('client-1')).toBe(1_000);
  });
});
