/**
 * @file GrpcServer.ts
 * Experimental gRPC server adapter for A2A Protocol.
 */

import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import * as grpc from '@grpc/grpc-js';
import * as protoLoader from '@grpc/proto-loader';
import { logger } from 'a2a-mesh';
import type { A2AServer, AgentCard, Message, Task, TaskManager } from 'a2a-mesh';

const currentDirectory = dirname(fileURLToPath(import.meta.url));
const PROTO_PATH = join(currentDirectory, '../proto/a2a.proto');

type EmptyRequest = Record<string, never>;

interface SendMessageRequest {
  message_text?: string;
}

interface TaskRequest {
  task_id: string;
}

interface AgentCardResponse {
  json_card: string;
}

interface TaskResponse {
  task_json: string;
}

interface ProtoDescriptor {
  a2a: {
    v1: {
      A2AService: {
        service: grpc.ServiceDefinition<grpc.UntypedServiceImplementation>;
      };
    };
  };
}

function toGrpcMessage(text: string): Message {
  return {
    role: 'user',
    parts: [{ type: 'text', text }],
    messageId: `grpc-${Date.now()}`,
    timestamp: new Date().toISOString(),
  };
}

export class GrpcServer {
  private readonly server: grpc.Server;
  private readonly agentCard: AgentCard;
  private readonly adapter: A2AServer;

  constructor(adapter: A2AServer, agentCard: AgentCard) {
    this.server = new grpc.Server();
    this.adapter = adapter;
    this.agentCard = agentCard;

    this.setupServices();
  }

  private setupServices(): void {
    const packageDefinition = protoLoader.loadSync(PROTO_PATH, {
      keepCase: true,
      longs: String,
      enums: String,
      defaults: true,
      oneofs: true,
    });

    const protoDescriptor = grpc.loadPackageDefinition(
      packageDefinition,
    ) as unknown as ProtoDescriptor;
    const service = protoDescriptor.a2a.v1.A2AService.service;

    this.server.addService(service, {
      GetAgentCard: (
        _call: grpc.ServerUnaryCall<EmptyRequest, AgentCardResponse>,
        callback: grpc.sendUnaryData<AgentCardResponse>,
      ) => {
        callback(null, { json_card: JSON.stringify(this.agentCard) });
      },
      SendMessage: async (
        call: grpc.ServerUnaryCall<SendMessageRequest, TaskResponse>,
        callback: grpc.sendUnaryData<TaskResponse>,
      ) => {
        try {
          const task = this.createGrpcTask(call.request.message_text ?? '');
          callback(null, { task_json: JSON.stringify(task) });
        } catch (error) {
          callback({
            code: grpc.status.INTERNAL,
            details: String(error),
            name: 'GrpcSendMessageError',
          });
        }
      },
      StreamMessage: async (call: grpc.ServerWritableStream<SendMessageRequest, TaskResponse>) => {
        try {
          const task = this.createGrpcTask(call.request.message_text ?? '');
          call.write({ task_json: JSON.stringify(task) });
        } finally {
          call.end();
        }
      },
      GetTask: (
        call: grpc.ServerUnaryCall<TaskRequest, TaskResponse>,
        callback: grpc.sendUnaryData<TaskResponse>,
      ) => {
        const task = this.getTaskManager().getTask(call.request.task_id);
        callback(null, { task_json: JSON.stringify(task ?? null) });
      },
      CancelTask: (
        call: grpc.ServerUnaryCall<TaskRequest, TaskResponse>,
        callback: grpc.sendUnaryData<TaskResponse>,
      ) => {
        const task = this.getTaskManager().cancelTask(call.request.task_id);
        callback(null, { task_json: JSON.stringify(task ?? null) });
      },
    });
  }

  public bind(port: number): void {
    this.server.bindAsync(
      `0.0.0.0:${port}`,
      grpc.ServerCredentials.createInsecure(),
      (error, boundPort) => {
        if (error) {
          logger.error('Failed to bind gRPC server', { error: String(error) });
          return;
        }
        this.server.start();
        logger.info('gRPC Server listening', { port: boundPort });
      },
    );
  }

  private createGrpcTask(messageText: string): Task {
    const taskManager = this.getTaskManager();
    const task = taskManager.createTask();
    const message = toGrpcMessage(messageText);
    taskManager.addHistoryMessage(task.id, message);
    taskManager.updateTaskState(task.id, 'working');
    void this.adapter
      .handleTask(task, message)
      .then((artifacts) => {
        for (const artifact of artifacts) {
          taskManager.addArtifact(task.id, {
            ...artifact,
            metadata: {
              ...(artifact as { metadata?: Record<string, unknown> }).metadata,
              transport: 'grpc',
            },
          });
        }
        taskManager.updateTaskState(task.id, 'completed');
      })
      .catch((error) => {
        logger.error('gRPC task processing failed', { taskId: task.id, error });
        taskManager.updateTaskState(task.id, 'failed');
      });

    return taskManager.getTask(task.id) ?? task;
  }

  private getTaskManager(): TaskManager {
    return (this.adapter as A2AServer & { getTaskManager(): TaskManager }).getTaskManager();
  }
}
