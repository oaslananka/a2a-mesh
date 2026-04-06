import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { fetchWithPolicy, redactHeaders } from '../src/net/fetchWithPolicy.js';

describe('redactHeaders', () => {
  it('redacts sensitive headers', () => {
    const redacted = redactHeaders({
      Authorization: 'Bearer token',
      'X-API-KEY': 'secret',
      'Content-Type': 'application/json',
    });
    expect(redacted['Authorization']).toBe('[REDACTED]');
    expect(redacted['X-API-KEY']).toBe('[REDACTED]');
    expect(redacted['Content-Type']).toBe('application/json');
  });
});

describe('fetchWithPolicy', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it('succeeds on first try without retries', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('ok', { status: 200 }));
    const res = await fetchWithPolicy('http://test');
    expect(res.status).toBe(200);
    expect(globalThis.fetch).toHaveBeenCalledTimes(1);
  });

  it('throws on non-transient error immediately', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('not found', { status: 404 }));
    const res = await fetchWithPolicy('http://test', {}, { retries: 3 });
    expect(res.status).toBe(404);
    expect(globalThis.fetch).toHaveBeenCalledTimes(1); // Should not retry 404
  });

  it('retries on transient error (500) up to maxRetries', async () => {
    vi.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(new Response('error', { status: 500 }))
      .mockResolvedValueOnce(new Response('error', { status: 502 }))
      .mockResolvedValueOnce(new Response('ok', { status: 200 }));

    const promise = fetchWithPolicy(
      'http://test',
      {},
      { retries: 3, backoffBaseMs: 10, jitter: false },
    );

    // Advance timers for the backoff
    await vi.advanceTimersByTimeAsync(50);

    const res = await promise;
    expect(res.status).toBe(200);
    expect(globalThis.fetch).toHaveBeenCalledTimes(3);
  });

  it('fails after max retries', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('error', { status: 503 }));
    const promise = fetchWithPolicy(
      'http://test',
      {},
      { retries: 2, backoffBaseMs: 10, jitter: false },
    );

    await vi.advanceTimersByTimeAsync(100);

    const res = await promise;
    expect(res.status).toBe(503);
    expect(globalThis.fetch).toHaveBeenCalledTimes(3); // Initial + 2 retries
  });

  it('aborts using provided AbortSignal', async () => {
    const controller = new AbortController();
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (_, init) => {
      if (init?.signal?.aborted) {
        throw new DOMException('AbortError', 'AbortError');
      }
      return new Promise((_, reject) => {
        if (init?.signal) {
          init.signal.addEventListener('abort', () =>
            reject(new DOMException('AbortError', 'AbortError')),
          );
        }
      });
    });

    const promise = fetchWithPolicy('http://test', {}, { signal: controller.signal });
    controller.abort('user cancel');

    await expect(promise).rejects.toThrow(); // The exact error depends on node fetch internals, but it should reject
  });
});
