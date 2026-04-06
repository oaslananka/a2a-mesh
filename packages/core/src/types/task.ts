/**
 * @file task.ts
 * Core task, message and artifact types used by the A2A runtime.
 */

import type { AuthScheme } from './auth.js';
import type { A2AExtension } from './extensions.js';

export interface TextPart {
  type: 'text';
  text: string;
}

export interface FilePart {
  type: 'file';
  file: {
    name?: string;
    mimeType: string;
    bytes?: string;
    uri?: string;
  };
}

export interface DataPart {
  type: 'data';
  data: Record<string, unknown>;
}

export type Part = TextPart | FilePart | DataPart;

export interface Message {
  kind?: 'message';
  role: 'user' | 'agent';
  parts: Part[];
  messageId: string;
  timestamp: string;
  contextId?: string;
}

export interface PushNotificationConfig {
  id?: string;
  url: string;
  token?: string;
  authentication?: AuthScheme;
}

export interface Artifact {
  artifactId: string;
  name?: string;
  description?: string;
  parts: Part[];
  index: number;
  lastChunk?: boolean;
}

export interface ExtensibleArtifact extends Artifact {
  extensions?: string[];
  metadata?: Record<string, unknown>;
  /** The principal (user or service account) that owns this task */
  principalId?: string;
  /** The tenant or namespace this task belongs to */
  tenantId?: string;
}

export interface TaskStatus {
  state:
    | 'submitted'
    | 'queued'
    | 'working'
    | 'input-required'
    | 'waiting_on_external'
    | 'completed'
    | 'failed'
    | 'canceled';
  timestamp: string;
  message?: string;
}

export interface Task {
  kind?: 'task';
  id: string;
  sessionId?: string;
  contextId?: string;
  principalId?: string;
  tenantId?: string;
  status: TaskStatus;
  history: Message[];
  artifacts?: ExtensibleArtifact[];
  metadata?: Record<string, unknown>;
  extensions?: string[];
}

export interface TaskListParams {
  contextId?: string;
  limit?: number;
  offset?: number;
}

export interface TaskListResult {
  tasks: Task[];
  total: number;
}

export interface TaskCounts {
  total: number;
  active: number;
  completed: number;
  failed: number;
  canceled: number;
  submitted: number;
  queued: number;
  inputRequired: number;
  waitingOnExternal: number;
  working: number;
}

export interface MessageRequestConfiguration {
  blocking?: boolean;
  acceptedOutputModes?: string[];
  pushNotificationConfig?: PushNotificationConfig;
  extensions?: A2AExtension[];
}

export interface MessageSendParams {
  message: Message;
  taskId?: string;
  sessionId?: string;
  contextId?: string;
  configuration?: MessageRequestConfiguration;
}

export interface A2AHealthResponse {
  status: 'healthy';
  version: string;
  protocol: 'A2A/1.0';
  uptime: number;
  tasks: Pick<TaskCounts, 'active' | 'completed' | 'failed' | 'total'>;
  memory: {
    heapUsedMb: number;
    heapTotalMb: number;
  };
}
