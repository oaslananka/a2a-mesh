/**
 * @file PushNotificationService.ts
 * Delivery of A2A task updates to client webhooks.
 */

import type { PushNotificationConfig, Task } from '../types/task.js';
import { logger } from '../utils/logger.js';
import { CircuitBreaker, CircuitOpenError, type CircuitBreakerOptions } from './CircuitBreaker.js';

export interface PushNotificationServiceOptions {
  circuitBreaker?: CircuitBreakerOptions;
}

export class PushNotificationService {
  private readonly breakers = new Map<string, CircuitBreaker>();

  constructor(private readonly options: PushNotificationServiceOptions = {}) {}

  private getBreakerFor(url: string): CircuitBreaker {
    const existing = this.breakers.get(url);
    if (existing) {
      return existing;
    }

    const breaker = new CircuitBreaker(`push:${url}`, this.options.circuitBreaker);
    this.breakers.set(url, breaker);
    return breaker;
  }

  /**
   * Sends a task snapshot to the configured webhook endpoint.
   *
   * @param config Webhook delivery configuration.
   * @param task Current task snapshot to deliver.
   * @returns Resolves when delivery succeeds.
   * @throws When the endpoint responds with a non-2xx status.
   */
  async sendNotification(config: PushNotificationConfig, task: Task): Promise<void> {
    const breaker = this.getBreakerFor(config.url);

    try {
      await breaker.execute(async () => {
        const headers: Record<string, string> = {
          'Content-Type': 'application/json',
        };

        let url = config.url;
        if (config.token) {
          headers['X-A2A-Notification-Token'] = config.token;
        }

        if (config.authentication && config.token) {
          if (config.authentication.type === 'apiKey') {
            if (config.authentication.in === 'header') {
              headers[config.authentication.name] = config.token;
            } else {
              const nextUrl = new URL(url);
              nextUrl.searchParams.set(config.authentication.name, config.token);
              url = nextUrl.toString();
            }
          }

          if (config.authentication.type === 'http') {
            headers.Authorization = `Bearer ${config.token}`;
          }

          if (config.authentication.type === 'openIdConnect') {
            headers.Authorization = `Bearer ${config.token}`;
          }
        }

        const response = await fetch(url, {
          method: 'POST',
          headers,
          body: JSON.stringify(task),
        });

        if (!response.ok) {
          throw new Error(`Push notification failed: HTTP ${response.status}`);
        }
      });
    } catch (error) {
      if (error instanceof CircuitOpenError) {
        logger.warn('Push notification skipped - circuit open', {
          taskId: task.id,
          url: config.url,
        });
        return;
      }

      throw error;
    }
  }

  /**
   * Executes an async action with exponential backoff.
   *
   * @param fn Async operation to retry.
   * @param maxRetries Maximum number of retry attempts.
   * @returns Resolves when the operation succeeds.
   * @throws Re-throws the last failure when retries are exhausted.
   */
  async retryWithBackoff(fn: () => Promise<void>, maxRetries = 3): Promise<void> {
    let attempt = 0;
    let lastError: unknown;

    while (attempt < maxRetries) {
      try {
        await fn();
        return;
      } catch (error) {
        if (error instanceof CircuitOpenError) {
          return;
        }
        lastError = error;
        attempt += 1;
        if (attempt >= maxRetries) {
          break;
        }

        const delayMs = 250 * 2 ** (attempt - 1);
        await new Promise((resolve) => setTimeout(resolve, delayMs));
      }
    }

    throw lastError instanceof Error ? lastError : new Error(String(lastError));
  }
}
