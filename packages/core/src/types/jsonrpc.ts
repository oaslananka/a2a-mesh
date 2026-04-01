/**
 * @file jsonrpc.ts
 * JSON-RPC 2.0 request/response helpers for A2A endpoints.
 */

export type JsonRpcId = string | number | null;

export interface JsonRpcRequest {
  jsonrpc: '2.0';
  method: string;
  params?: Record<string, unknown> | unknown[];
  id?: JsonRpcId;
}

export interface JsonRpcSuccessResponse<T = unknown> {
  jsonrpc: '2.0';
  result: T;
  id: JsonRpcId;
}

export interface JsonRpcFailureResponse {
  jsonrpc: '2.0';
  error: {
    code: number;
    message: string;
    data?: unknown;
  };
  id: JsonRpcId;
}

export type JsonRpcResponse<T = unknown> =
  | JsonRpcSuccessResponse<T>
  | JsonRpcFailureResponse;

export const ErrorCodes = {
  ParseError: -32700,
  InvalidRequest: -32600,
  MethodNotFound: -32601,
  InvalidParams: -32602,
  InternalError: -32603,
  TaskNotFound: -32004,
  PushNotificationNotSupported: -32010,
  UnsupportedOperation: -32011,
  RateLimitExceeded: -32029,
  Unauthorized: -32040,
  ExtensionRequired: -32041,
} as const;

export class JsonRpcError extends Error {
  readonly code: number;
  readonly data?: unknown;

  constructor(code: number, message: string, data?: unknown) {
    super(message);
    this.code = code;
    this.data = data;
  }
}
