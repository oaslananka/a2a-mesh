/**
 * @file A2AServer.ts
 * Express/Fastify adapter serving agent.json + RPC endpoints.
 */

import { randomUUID } from 'node:crypto';
import express, { type Express, type Request, type Response } from 'express';
import { InMemoryTaskStorage } from '../storage/InMemoryTaskStorage.js';
import type { ITaskStorage } from '../storage/ITaskStorage.js';
import type { AgentCard, AnyAgentCard } from '../types/agent-card.js';
import type { A2AExtension } from '../types/extensions.js';
import { TaskManager } from './TaskManager.js';
import { SSEStreamer } from './SSEStreamer.js';
import type { JsonRpcRequest, JsonRpcResponse } from '../types/jsonrpc.js';
import { JsonRpcError, ErrorCodes } from '../types/jsonrpc.js';
import {
  type A2AHealthResponse,
  type Artifact,
  type ExtensibleArtifact,
  type Message,
  type MessageSendParams,
  type Task,
} from '../types/task.js';
import {
  validateMessageSendParams,
  validateTaskListParams,
  validateRequest,
  JsonRpcRequestSchema,
} from '../utils/schema-validator.js';
import { logger } from '../utils/logger.js';
import { PushNotificationService } from './PushNotificationService.js';
import { getDocsUrl } from '../config/docs.js';
import {
  createRateLimiter,
  type RateLimitConfig,
  type RateLimitStore,
} from '../middleware/rateLimiter.js';
import { JwtAuthMiddleware, type JwtAuthMiddlewareOptions } from '../auth/JwtAuthMiddleware.js';
import { a2aMeshTracer, SpanStatusCode } from '../telemetry/tracer.js';
import { validateSafeUrl } from '../security/url.js';

export interface A2AServerOptions {
  rateLimit?: Partial<RateLimitConfig>;
  rateLimitStore?: RateLimitStore;
  auth?: JwtAuthMiddlewareOptions;
  taskStorage?: ITaskStorage;
  allowLocalhost?: boolean;
  allowPrivateNetworks?: boolean;
}

interface RequestContext {
  req: Request;
}

interface RequestWithRequestId extends Request {
  requestId?: string;
}

interface RequestWithAuth extends Request {
  principalId?: string;
  tenantId?: string;
}

export abstract class A2AServer {
  protected app: Express;
  protected agentCard: AgentCard;
  protected taskManager: TaskManager;
  protected streamer: SSEStreamer;
  protected pushNotificationService: PushNotificationService;
  protected authMiddleware: JwtAuthMiddleware | undefined;
  private readonly startedAt = Date.now();

  constructor(
    agentCard: AgentCard,
    private readonly options: A2AServerOptions = {},
  ) {
    this.app = express();
    this.app.use(express.json());
    this.agentCard = agentCard;
    this.taskManager = new TaskManager(options.taskStorage ?? new InMemoryTaskStorage());
    this.streamer = new SSEStreamer();
    this.pushNotificationService = new PushNotificationService();
    this.authMiddleware = options.auth ? new JwtAuthMiddleware(options.auth) : undefined;

    this.setupMiddleware();
    this.setupRoutes();
    this.bindTaskObservers();
  }

  private setupMiddleware() {
    this.app.use((req: RequestWithRequestId, _res, next) => {
      req.requestId = req.header('x-request-id') ?? randomUUID();
      next();
    });

    if (this.options.rateLimit) {
      this.app.use(createRateLimiter(this.options.rateLimit, this.options.rateLimitStore));
    }
  }

  private setupRoutes() {
    const serveCard = (_req: Request, res: Response) => {
      res.json(this.agentCard);
    };
    this.app.get('/.well-known/agent-card.json', serveCard);
    this.app.get('/.well-known/agent.json', serveCard);

    this.app.get('/health', (_req, res) => {
      const taskCounts = this.taskManager.getTaskCounts();
      const memoryUsage = process.memoryUsage();
      const payload: A2AHealthResponse = {
        status: 'healthy',
        version: this.agentCard.version,
        protocol: 'A2A/1.0',
        uptime: Math.floor((Date.now() - this.startedAt) / 1000),
        tasks: {
          active: taskCounts.active,
          completed: taskCounts.completed,
          failed: taskCounts.failed,
          total: taskCounts.total,
        },
        memory: {
          heapUsedMb: Number((memoryUsage.heapUsed / 1024 / 1024).toFixed(1)),
          heapTotalMb: Number((memoryUsage.heapTotal / 1024 / 1024).toFixed(1)),
        },
      };
      res.json(payload);
    });

    this.app.get('/tasks', async (req: Request, res: Response) => {
      if (this.authMiddleware) {
        try {
          await this.authMiddleware.authenticateRequest(req);
        } catch {
          res.status(401).send('Unauthorized');
          return;
        }
      }

      const principalId = (req as RequestWithAuth).principalId as string | undefined;
      const tenantId = (req as RequestWithAuth).tenantId as string | undefined;

      let tasks = this.taskManager.getAllTasks();
      if (principalId) {
        tasks = tasks.filter((t) => !t.principalId || t.principalId === principalId);
      }
      if (tenantId) {
        tasks = tasks.filter((t) => !t.tenantId || t.tenantId === tenantId);
      }

      // Sort newest first
      tasks.sort(
        (a, b) => new Date(b.status.timestamp).getTime() - new Date(a.status.timestamp).getTime(),
      );

      const limit = Number(req.query.limit) || 20;
      res.json(tasks.slice(0, limit));
    });

    const handleJsonRpc = async (req: Request, res: Response) => {
      try {
        const rpcReq = validateRequest(JsonRpcRequestSchema, req.body) as JsonRpcRequest;
        const result = await this.handleRpc(rpcReq, { req });
        const response: JsonRpcResponse = {
          jsonrpc: '2.0',
          result,
          id: rpcReq.id || null,
        };
        res.json(response);
      } catch (err: unknown) {
        if (err instanceof JsonRpcError) {
          res.json({
            jsonrpc: '2.0',
            error: { code: err.code, message: err.message, data: err.data },
            id: req.body.id || null,
          });
        } else {
          logger.error('Unhandled internal error', { error: String(err) });
          res.json({
            jsonrpc: '2.0',
            error: { code: ErrorCodes.InternalError, message: 'Internal Error' },
            id: req.body.id || null,
          });
        }
      }
    };
    this.app.post('/', handleJsonRpc);
    this.app.post('/rpc', handleJsonRpc);
    this.app.post('/a2a/jsonrpc', handleJsonRpc);

    const handleStreamRequest = async (req: Request, res: Response) => {
      if (this.authMiddleware) {
        try {
          await this.authMiddleware.authenticateRequest(req);
        } catch {
          res.status(401).send('Unauthorized');
          return;
        }
      }

      const taskId = req.query.taskId as string;
      if (!taskId) {
        res.status(400).send('Missing taskId query parameter');
        return;
      }

      const task = this.taskManager.getTask(taskId);
      if (!task) {
        res.status(404).send('Task not found');
        return;
      }

      const principalId = (req as RequestWithAuth).principalId as string | undefined;
      const tenantId = (req as RequestWithAuth).tenantId as string | undefined;

      if (task.principalId && principalId && task.principalId !== principalId) {
        res.status(403).send('Forbidden');
        return;
      }
      if (task.tenantId && tenantId && task.tenantId !== tenantId) {
        res.status(403).send('Forbidden');
        return;
      }

      this.streamer.addClient(taskId, res);
      this.streamer.sendTaskUpdate(taskId, task);
    };
    this.app.get('/stream', handleStreamRequest);
    this.app.get('/a2a/stream', handleStreamRequest);
  }

  private bindTaskObservers(): void {
    this.taskManager.on('taskUpdated', async ({ task, reason }) => {
      if (reason !== 'push-config') {
        this.streamer.sendTaskUpdate(task.id, task);
      }

      if (reason === 'state') {
        const pushConfig = this.taskManager.getPushNotification(task.id);
        if (pushConfig) {
          try {
            await this.pushNotificationService.retryWithBackoff(() =>
              this.pushNotificationService.sendNotification(pushConfig, task),
            );
          } catch (error: unknown) {
            logger.error('Push notification delivery failed', {
              taskId: task.id,
              contextId: task.contextId,
              error,
            });
          }
        }
      }
    });
  }

  protected async handleRpc(req: JsonRpcRequest, context: RequestContext): Promise<unknown> {
    const span = a2aMeshTracer.startSpan('a2a.handleRpc', {
      attributes: {
        'rpc.method': req.method,
        'a2a.agent_name': this.agentCard.name,
      },
    });
    const requestId = (context.req as RequestWithRequestId).requestId;
    const startedAt = Date.now();
    let failed = false;

    try {
      const params = (req.params ?? {}) as Record<string, unknown>;
      switch (req.method) {
        case 'message/send':
        case 'message/stream':
          return await this.handleMessageRequest(
            validateMessageSendParams(params),
            req.method,
            context.req,
          );

        case 'tasks/get': {
          if (typeof params.taskId !== 'string') {
            throw new JsonRpcError(ErrorCodes.InvalidParams, 'Missing taskId');
          }
          const task = this.taskManager.getTask(params.taskId);
          if (!task) {
            throw new JsonRpcError(ErrorCodes.TaskNotFound, 'Task not found');
          }
          // Authorization check
          const principalId = (context.req as RequestWithAuth).principalId as string | undefined;
          const tenantId = (context.req as RequestWithAuth).tenantId as string | undefined;
          if (task.principalId && principalId && task.principalId !== principalId) {
            throw new JsonRpcError(ErrorCodes.Unauthorized, 'Unauthorized task access');
          }
          if (task.tenantId && tenantId && task.tenantId !== tenantId) {
            throw new JsonRpcError(ErrorCodes.Unauthorized, 'Unauthorized task access');
          }
          return task;
        }

        case 'tasks/cancel': {
          if (typeof params.taskId !== 'string') {
            throw new JsonRpcError(ErrorCodes.InvalidParams, 'Missing taskId');
          }
          const task = this.taskManager.cancelTask(params.taskId);
          if (!task) {
            throw new JsonRpcError(ErrorCodes.TaskNotFound, 'Task not found');
          }
          return task;
        }

        case 'tasks/pushNotification/set': {
          if (
            typeof params.taskId !== 'string' ||
            typeof params.pushNotificationConfig !== 'object'
          ) {
            throw new JsonRpcError(
              ErrorCodes.InvalidParams,
              'Missing taskId or pushNotificationConfig',
            );
          }
          const pushNotificationConfig = await this.normalizePushNotificationConfig(
            params.pushNotificationConfig as NonNullable<
              NonNullable<MessageSendParams['configuration']>['pushNotificationConfig']
            >,
          );
          const config = this.taskManager.setPushNotification(
            params.taskId,
            pushNotificationConfig,
          );
          if (!config) {
            throw new JsonRpcError(ErrorCodes.TaskNotFound, 'Task not found');
          }
          return config;
        }

        case 'tasks/pushNotification/get': {
          if (typeof params.taskId !== 'string') {
            throw new JsonRpcError(ErrorCodes.InvalidParams, 'Missing taskId');
          }
          return this.taskManager.getPushNotification(params.taskId) ?? null;
        }

        case 'tasks/list': {
          const { contextId, limit = 50, offset = 0 } = validateTaskListParams(params);
          let tasks = contextId
            ? this.taskManager.getTasksByContext(contextId)
            : this.taskManager.getAllTasks();

          const principalId = (context.req as RequestWithAuth).principalId as string | undefined;
          const tenantId = (context.req as RequestWithAuth).tenantId as string | undefined;
          if (principalId) {
            tasks = tasks.filter((t) => !t.principalId || t.principalId === principalId);
          }
          if (tenantId) {
            tasks = tasks.filter((t) => !t.tenantId || t.tenantId === tenantId);
          }

          return {
            tasks: tasks.slice(offset, offset + limit),
            total: tasks.length,
          };
        }

        case 'agent/authenticatedExtendedCard': {
          if (!this.agentCard.capabilities?.extendedAgentCard) {
            throw new JsonRpcError(ErrorCodes.UnsupportedOperation, 'Extended card not supported');
          }
          if (this.authMiddleware) {
            try {
              await this.authMiddleware.authenticateRequest(context.req);
            } catch (error: unknown) {
              throw new JsonRpcError(ErrorCodes.Unauthorized, 'Unauthorized', {
                reason: String(error),
              });
            }
          }
          return this.agentCard;
        }

        default:
          throw new JsonRpcError(ErrorCodes.MethodNotFound, `Method ${req.method} not found`);
      }
    } catch (error: unknown) {
      failed = true;
      span.setStatus({ code: SpanStatusCode.ERROR, message: String(error) });
      throw error;
    } finally {
      if (!failed) {
        span.setStatus({ code: SpanStatusCode.OK });
      }
      span.end();
      logger.info('Handled RPC request', {
        ...(requestId ? { requestId } : {}),
        method: req.method,
        agentName: this.agentCard.name,
        durationMs: Date.now() - startedAt,
      });
    }
  }

  private async handleMessageRequest(
    params: MessageSendParams,
    method: string,
    req?: Request,
  ): Promise<Task> {
    const principalId = (req as RequestWithAuth)?.principalId as string | undefined;
    const tenantId = (req as RequestWithAuth)?.tenantId as string | undefined;
    const pushNotificationConfig = params.configuration?.pushNotificationConfig
      ? await this.normalizePushNotificationConfig(params.configuration.pushNotificationConfig)
      : undefined;

    let task: Task | null = null;

    if (params.taskId) {
      task = this.taskManager.getTask(params.taskId) ?? null;
      if (!task) {
        throw new JsonRpcError(ErrorCodes.TaskNotFound, 'Task not found');
      }
      if (task.principalId && principalId && task.principalId !== principalId) {
        throw new JsonRpcError(ErrorCodes.Unauthorized, 'Unauthorized task access');
      }
      if (task.tenantId && tenantId && task.tenantId !== tenantId) {
        throw new JsonRpcError(ErrorCodes.Unauthorized, 'Unauthorized task access');
      }
    } else {
      task = this.taskManager.createTask(
        params.sessionId,
        params.contextId ?? params.message.contextId,
        principalId,
        tenantId,
      );
      logger.audit(
        'task_created',
        principalId,
        `task:${task.id}`,
        'success',
        tenantId ? { tenantId } : {},
      );
    }

    if (!task) {
      throw new JsonRpcError(ErrorCodes.TaskNotFound, 'Task not found');
    }

    const appliedExtensions = this.negotiateExtensions(params.configuration?.extensions ?? []);
    this.taskManager.setTaskExtensions(task.id, appliedExtensions);
    if (pushNotificationConfig) {
      this.taskManager.setPushNotification(task.id, pushNotificationConfig);
    }

    const message: Message = {
      ...params.message,
      kind: params.message.kind ?? 'message',
      ...((params.message.contextId ?? task.contextId)
        ? { contextId: params.message.contextId ?? task.contextId }
        : {}),
    };
    this.taskManager.addHistoryMessage(task.id, message);
    this.taskManager.updateTaskState(task.id, 'working');

    this.processTaskInternal(task, message).catch((error) => {
      logger.error('Task processing failed', {
        taskId: task.id,
        ...(task.contextId ? { contextId: task.contextId } : {}),
        error,
      });
    });

    if (method === 'message/stream') {
      return this.taskManager.getTask(task.id) ?? task;
    }

    return this.taskManager.getTask(task.id) ?? task;
  }

  private negotiateExtensions(requestedExtensions: A2AExtension[]): string[] {
    if (requestedExtensions.length === 0) {
      return [];
    }

    const supported = new Set((this.agentCard.extensions ?? []).map((extension) => extension.uri));
    const applied: string[] = [];
    for (const extension of requestedExtensions) {
      if (supported.has(extension.uri)) {
        applied.push(extension.uri);
        continue;
      }

      if (extension.required) {
        throw new JsonRpcError(
          ErrorCodes.ExtensionRequired,
          `Required extension not supported: ${extension.uri}. See: ${getDocsUrl('protocol/extensions')}`,
        );
      }
    }

    return applied;
  }

  private async normalizePushNotificationConfig(
    config: NonNullable<NonNullable<MessageSendParams['configuration']>['pushNotificationConfig']>,
  ): Promise<
    NonNullable<NonNullable<MessageSendParams['configuration']>['pushNotificationConfig']>
  > {
    try {
      await validateSafeUrl(config.url, {
        allowLocalhost: this.options.allowLocalhost ?? true,
        allowPrivateNetworks: this.options.allowPrivateNetworks ?? false,
      });

      return { ...config };
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      throw new JsonRpcError(ErrorCodes.InvalidParams, `Invalid push notification URL: ${message}`);
    }
  }

  protected normalizeArtifacts(task: Task, artifacts: Artifact[]): ExtensibleArtifact[] {
    return artifacts.map((artifact) => ({
      ...artifact,
      ...(((artifact as ExtensibleArtifact).extensions ?? task.extensions)
        ? { extensions: (artifact as ExtensibleArtifact).extensions ?? task.extensions }
        : {}),
      metadata: {
        ...((artifact as ExtensibleArtifact).metadata ?? {}),
        taskId: task.id,
        ...(task.contextId ? { contextId: task.contextId } : {}),
        appliedExtensions: task.extensions ?? [],
      },
    }));
  }

  public getExpressApp(): Express {
    return this.app;
  }

  public getAgentCard(): AgentCard {
    return this.agentCard;
  }

  public getTaskManager(): TaskManager {
    return this.taskManager;
  }

  public static fromCard(card: AnyAgentCard): AgentCard {
    return card.protocolVersion === '1.0'
      ? card
      : ({ ...card, protocolVersion: '1.0' } as AgentCard);
  }

  protected async processTaskInternal(task: Task, message: Message): Promise<void> {
    const span = a2aMeshTracer.startSpan('a2a.processTask', {
      attributes: {
        'a2a.task_id': task.id,
        'a2a.context_id': task.contextId ?? '',
      },
    });
    try {
      const artifacts = await this.handleTask(task, message);
      this.normalizeArtifacts(task, artifacts).forEach((artifact) => {
        this.taskManager.addArtifact(task.id, artifact);
      });
      this.taskManager.updateTaskState(task.id, 'completed');
      span.setStatus({ code: SpanStatusCode.OK });
    } catch (error: unknown) {
      this.taskManager.updateTaskState(task.id, 'failed');
      span.setStatus({ code: SpanStatusCode.ERROR, message: String(error) });
      throw error;
    } finally {
      span.end();
    }
  }

  /**
   * Adapter implementation entry point. Must be implemented by specific adapters.
   */
  abstract handleTask(task: Task, message: Message): Promise<Artifact[]>;

  public start(port: number) {
    return this.app.listen(port, () => {
      logger.info(`A2A Server listening on port ${port}`);
    });
  }

  public stop() {
    this.streamer.stop();
  }
}
