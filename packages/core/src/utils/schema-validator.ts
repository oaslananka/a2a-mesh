/**
 * @file schema-validator.ts
 * Zod-based validation for A2A messages and configurations.
 */

import { z } from 'zod';
import { JsonRpcError, ErrorCodes } from '../types/jsonrpc.js';
import type { MessageSendParams, TaskListParams } from '../types/task.js';

const AuthSchemeSchema = z.union([
  z.object({
    type: z.literal('apiKey'),
    id: z.string(),
    in: z.enum(['header', 'query']),
    name: z.string(),
    description: z.string().optional(),
  }),
  z.object({
    type: z.literal('http'),
    id: z.string(),
    scheme: z.literal('bearer'),
    bearerFormat: z.string().optional(),
    description: z.string().optional(),
  }),
  z.object({
    type: z.literal('openIdConnect'),
    id: z.string(),
    openIdConnectUrl: z.string().url(),
    audience: z.union([z.string(), z.array(z.string())]).optional(),
    issuer: z.string().optional(),
    jwksUri: z.string().url().optional(),
    algorithms: z.array(z.string()).optional(),
    description: z.string().optional(),
  }),
]);

const A2AExtensionSchema = z.object({
  uri: z.string().url(),
  version: z.string().optional(),
  required: z.boolean().optional(),
});

export const JsonRpcRequestSchema = z.object({
  jsonrpc: z.literal('2.0'),
  method: z.string(),
  params: z.union([z.record(z.unknown()), z.array(z.unknown())]).optional(),
  id: z.union([z.string(), z.number(), z.null()]).optional(),
});

export const PartSchema = z.union([
  z.object({ type: z.literal('text'), text: z.string() }),
  z.object({
    type: z.literal('file'),
    file: z.object({
      name: z.string().optional(),
      mimeType: z.string(),
      bytes: z.string().optional(),
      uri: z.string().optional(),
    }),
  }),
  z.object({ type: z.literal('data'), data: z.record(z.unknown()) }),
]);

export const MessageSchema = z.object({
  kind: z.literal('message').optional(),
  role: z.enum(['user', 'agent']),
  parts: z.array(PartSchema),
  messageId: z.string(),
  timestamp: z.string(), // ISO8601
  contextId: z.string().optional(),
});

export const PushNotificationConfigSchema = z.object({
  id: z.string().optional(),
  url: z.string().url(),
  token: z.string().optional(),
  authentication: AuthSchemeSchema.optional(),
});

export const MessageRequestConfigurationSchema = z.object({
  blocking: z.boolean().optional(),
  acceptedOutputModes: z.array(z.string()).optional(),
  pushNotificationConfig: PushNotificationConfigSchema.optional(),
  extensions: z.array(A2AExtensionSchema).optional(),
});

export const MessageSendParamsSchema = z.object({
  message: MessageSchema,
  taskId: z.string().optional(),
  sessionId: z.string().optional(),
  contextId: z.string().optional(),
  configuration: MessageRequestConfigurationSchema.optional(),
});

export const TaskListParamsSchema = z.object({
  contextId: z.string().optional(),
  limit: z.number().int().positive().max(500).optional(),
  offset: z.number().int().min(0).optional(),
});

/**
 * Validates a payload against a zod schema.
 * Throws a JsonRpcError if validation fails.
 * @param schema The zod schema to validate against.
 * @param data The payload to validate.
 * @returns The validated data.
 */
export function validateRequest<T>(schema: z.ZodType<T>, data: unknown): T {
  const result = schema.safeParse(data);
  if (!result.success) {
    throw new JsonRpcError(ErrorCodes.InvalidParams, 'Invalid parameters', result.error.errors);
  }
  return result.data;
}

export function validateMessageSendParams(data: unknown): MessageSendParams {
  return validateRequest(MessageSendParamsSchema, data) as MessageSendParams;
}

export function validateTaskListParams(data: unknown): TaskListParams {
  return validateRequest(TaskListParamsSchema, data) as TaskListParams;
}
