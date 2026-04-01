import { describe, expect, it } from 'vitest';
import { CircuitBreaker, CircuitOpenError } from '../src/server/CircuitBreaker.js';

describe('CircuitBreaker', () => {
  it('starts in the CLOSED state', () => {
    const breaker = new CircuitBreaker('test');
    expect(breaker.getState()).toBe('CLOSED');
  });

  it('opens after reaching the failure threshold', async () => {
    const breaker = new CircuitBreaker('test', { failureThreshold: 3 });
    const fail = () => Promise.reject(new Error('fail'));

    for (let attempt = 0; attempt < 3; attempt += 1) {
      await expect(breaker.execute(fail)).rejects.toThrow('fail');
    }

    expect(breaker.getState()).toBe('OPEN');
  });

  it('throws CircuitOpenError while open', async () => {
    const breaker = new CircuitBreaker('test', { failureThreshold: 1 });
    await expect(breaker.execute(() => Promise.reject(new Error('x')))).rejects.toThrow();
    expect(breaker.getState()).toBe('OPEN');

    await expect(breaker.execute(() => Promise.resolve('ok'))).rejects.toBeInstanceOf(
      CircuitOpenError,
    );
  });

  it('moves through HALF_OPEN and closes after recovery', async () => {
    const breaker = new CircuitBreaker('test', {
      failureThreshold: 1,
      recoveryTimeoutMs: 10,
      successThreshold: 1,
    });

    await expect(breaker.execute(() => Promise.reject(new Error('x')))).rejects.toThrow();
    expect(breaker.getState()).toBe('OPEN');

    await new Promise((resolve) => setTimeout(resolve, 20));

    await expect(breaker.execute(() => Promise.resolve('ok'))).resolves.toBe('ok');
    expect(breaker.getState()).toBe('CLOSED');
  });

  it('resets failure counting after a successful execution', async () => {
    const breaker = new CircuitBreaker('test', { failureThreshold: 3 });
    const fail = () => Promise.reject(new Error('fail'));
    const ok = () => Promise.resolve('ok');

    await expect(breaker.execute(fail)).rejects.toThrow();
    await expect(breaker.execute(fail)).rejects.toThrow();
    expect(breaker.getState()).toBe('CLOSED');

    await breaker.execute(ok);

    await expect(breaker.execute(fail)).rejects.toThrow();
    await expect(breaker.execute(fail)).rejects.toThrow();
    expect(breaker.getState()).toBe('CLOSED');
  });
});
