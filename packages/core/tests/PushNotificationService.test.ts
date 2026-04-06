import { afterEach, describe, expect, it, vi } from 'vitest';
import { PushNotificationService } from '../src/server/PushNotificationService.js';
import type { Task } from '../src/types/task.js';

describe('PushNotificationService', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('sends notification with default and auth headers', async () => {
    const service = new PushNotificationService();
    const fetchSpy = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(new Response(JSON.stringify({ ok: true }), { status: 200 }));

    await service.sendNotification(
      {
        url: 'https://example.com/webhook',
        token: 'secret',
        authentication: { type: 'http', id: 'bearer', scheme: 'bearer' },
      },
      {
        id: 'task-1',
        status: { state: 'completed', timestamp: new Date().toISOString() },
        history: [],
      } as Task,
    );

    expect(fetchSpy).toHaveBeenCalledWith(
      'https://example.com/webhook',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          'X-A2A-Notification-Token': 'secret',
          Authorization: 'Bearer secret',
        }),
      }),
    );
  });

  it('retries with exponential backoff', async () => {
    const service = new PushNotificationService();
    const fn = vi
      .fn<() => Promise<void>>()
      .mockRejectedValueOnce(new Error('fail-1'))
      .mockRejectedValueOnce(new Error('fail-2'))
      .mockResolvedValueOnce();

    await service.retryWithBackoff(fn, 3);
    expect(fn).toHaveBeenCalledTimes(3);
  });

  it('supports apiKey query delivery', async () => {
    const service = new PushNotificationService();
    const fetchSpy = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(new Response(JSON.stringify({ ok: true }), { status: 200 }));

    await service.sendNotification(
      {
        url: 'https://example.com/webhook',
        token: 'secret',
        authentication: { type: 'apiKey', id: 'key', in: 'query', name: 'api_key' },
      },
      {
        id: 'task-1',
        status: { state: 'completed', timestamp: new Date().toISOString() },
        history: [],
      } as Task,
    );

    expect(fetchSpy).toHaveBeenCalledWith(
      'https://example.com/webhook?api_key=secret',
      expect.any(Object),
    );
  });

  it('supports apiKey header delivery and openIdConnect bearer delivery', async () => {
    const service = new PushNotificationService();
    const fetchSpy = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(new Response(JSON.stringify({ ok: true }), { status: 200 }));

    const task = {
      id: 'task-1',
      status: { state: 'completed', timestamp: new Date().toISOString() },
      history: [],
    } as Task;

    await service.sendNotification(
      {
        url: 'https://example.com/header',
        token: 'header-secret',
        authentication: { type: 'apiKey', id: 'key', in: 'header', name: 'x-api-key' },
      },
      task,
    );
    await service.sendNotification(
      {
        url: 'https://example.com/oidc',
        token: 'oidc-secret',
        authentication: {
          type: 'openIdConnect',
          id: 'oidc',
          openIdConnectUrl: 'https://issuer.example/.well-known/openid-configuration',
        },
      },
      task,
    );

    expect(fetchSpy).toHaveBeenNthCalledWith(
      1,
      'https://example.com/header',
      expect.objectContaining({
        headers: expect.objectContaining({
          'X-A2A-Notification-Token': 'header-secret',
          'x-api-key': 'header-secret',
        }),
      }),
    );
    expect(fetchSpy).toHaveBeenNthCalledWith(
      2,
      'https://example.com/oidc',
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: 'Bearer oidc-secret',
        }),
      }),
    );
  });

  it('throws when webhook delivery fails and when retries are exhausted', async () => {
    const service = new PushNotificationService();
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(null, { status: 500 }));

    await expect(
      service.sendNotification(
        {
          url: 'https://example.com/webhook',
        },
        {
          id: 'task-1',
          status: { state: 'completed', timestamp: new Date().toISOString() },
          history: [],
        } as Task,
      ),
    ).rejects.toThrow('Push notification failed: HTTP 500');

    const failingOperation = vi
      .fn<() => Promise<void>>()
      .mockRejectedValue(new Error('still failing'));
    await expect(service.retryWithBackoff(failingOperation, 2)).rejects.toThrow('still failing');
    expect(failingOperation).toHaveBeenCalledTimes(2);
  });

  it('opens the circuit after repeated failures and skips delivery while open', async () => {
    const service = new PushNotificationService({
      circuitBreaker: {
        failureThreshold: 2,
        recoveryTimeoutMs: 1000,
        successThreshold: 1,
      },
    });
    const fetchSpy = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(new Response(null, { status: 500 }));

    const task = {
      id: 'task-1',
      status: { state: 'completed', timestamp: new Date().toISOString() },
      history: [],
    } as Task;

    await expect(
      service.sendNotification({ url: 'https://example.com/webhook' }, task),
    ).rejects.toThrow();
    await expect(
      service.sendNotification({ url: 'https://example.com/webhook' }, task),
    ).rejects.toThrow();
    await expect(
      service.sendNotification({ url: 'https://example.com/webhook' }, task),
    ).resolves.toBeUndefined();

    expect(fetchSpy).toHaveBeenCalledTimes(2);
  });

  it('recovers after the circuit timeout and allows successful delivery', async () => {
    const service = new PushNotificationService({
      circuitBreaker: {
        failureThreshold: 1,
        recoveryTimeoutMs: 10,
        successThreshold: 1,
      },
    });
    const task = {
      id: 'task-1',
      status: { state: 'completed', timestamp: new Date().toISOString() },
      history: [],
    } as Task;

    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    fetchSpy.mockResolvedValueOnce(new Response(null, { status: 500 }));

    await expect(
      service.sendNotification({ url: 'https://example.com/webhook' }, task),
    ).rejects.toThrow();
    await expect(
      service.sendNotification({ url: 'https://example.com/webhook' }, task),
    ).resolves.toBeUndefined();

    await new Promise((resolve) => setTimeout(resolve, 20));

    fetchSpy.mockResolvedValueOnce(new Response(JSON.stringify({ ok: true }), { status: 200 }));
    await expect(
      service.sendNotification({ url: 'https://example.com/webhook' }, task),
    ).resolves.toBeUndefined();
  });
});
