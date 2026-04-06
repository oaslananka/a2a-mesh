/**
 * @file interceptors.ts
 * Transport-agnostic request interception helpers for client calls.
 */

export interface ClientCallOptions {
  headers?: Record<string, string>;
  serviceParameters?: Record<string, string>;
  signal?: AbortSignal;
}

export interface BeforeArgs {
  method: string;
  body?: unknown;
  options: ClientCallOptions;
}

export interface AfterArgs<T = unknown> {
  method: string;
  response: T;
}

export interface CallInterceptor {
  before(args: BeforeArgs): Promise<void> | void;
  after?(args: AfterArgs): Promise<void> | void;
}

export interface AuthenticationHandler {
  headers(): Promise<Record<string, string>>;
  shouldRetryWithHeaders?(
    requestInit: RequestInit,
    response: Response,
  ): Promise<Record<string, string> | undefined>;
}

export function createAuthenticatingFetchWithRetry(
  baseFetch: typeof fetch,
  handler: AuthenticationHandler,
): typeof fetch {
  return async (
    input: Parameters<typeof fetch>[0],
    init?: Parameters<typeof fetch>[1],
  ): Promise<Response> => {
    const nextInit: RequestInit = {
      ...(init ?? {}),
      headers: {
        ...((init?.headers as Record<string, string> | undefined) ?? {}),
        ...(await handler.headers()),
      },
    };

    const firstResponse = await baseFetch(input, nextInit);
    const retryHeaders = handler.shouldRetryWithHeaders
      ? await handler.shouldRetryWithHeaders(nextInit, firstResponse)
      : undefined;

    if (!retryHeaders) {
      return firstResponse;
    }

    return baseFetch(input, {
      ...nextInit,
      headers: {
        ...((nextInit.headers as Record<string, string> | undefined) ?? {}),
        ...retryHeaders,
      },
    });
  };
}
