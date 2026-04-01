/**
 * @file SSEStreamer.ts
 * Server-Sent Events handler for task progress streaming.
 */

import type { Response } from 'express';
import type { Task } from '../types/task.js';
import { a2aMeshTracer, SpanStatusCode } from '../telemetry/tracer.js';

export class SSEStreamer {
  private clients: Map<string, Set<Response>> = new Map();

  /**
   * Add a client to the stream map (allows multiple subscribers per task).
   * @param taskId The task ID associated with the stream.
   * @param res The Express Response object.
   */
  addClient(taskId: string, res: Response) {
    if (!this.clients.has(taskId)) {
      this.clients.set(taskId, new Set());
    }
    const taskClients = this.clients.get(taskId);
    if (!taskClients) {
      return;
    }
    taskClients.add(res);

    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
      'Access-Control-Allow-Origin': '*',
    });

    res.on('close', () => {
      this.removeClient(taskId, res);
    });
  }

  /**
   * Broadcast an event to all subscribers of a specific task.
   * @param taskId The task ID.
   * @param event The SSE event type (e.g. 'task_updated').
   * @param data The JSON data payload.
   */
  sendEvent(taskId: string, event: string, data: unknown) {
    const taskClients = this.clients.get(taskId);
    if (taskClients) {
      const span = a2aMeshTracer.startSpan('sse.sendEvent', {
        attributes: {
          'a2a.task_id': taskId,
          'a2a.event': event,
          'a2a.client_count': taskClients.size,
        },
      });
      try {
        const payload = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
        taskClients.forEach((res) => {
          try {
            res.write(payload);
          } catch {
            this.removeClient(taskId, res);
          }
        });
      } finally {
        span.setStatus({ code: SpanStatusCode.OK });
        span.end();
      }
    }
  }

  /**
   * Send a task update and complete the streams if terminal state reached.
   * @param taskId The task ID.
   * @param task The updated task object.
   */
  sendTaskUpdate(taskId: string, task: Task) {
    this.sendEvent(taskId, 'task_updated', task);
    if (['completed', 'failed', 'canceled'].includes(task.status.state)) {
      this.closeStream(taskId);
    }
  }

  /**
   * Close all streams for a specific task.
   * @param taskId The task ID.
   */
  closeStream(taskId: string) {
    const taskClients = this.clients.get(taskId);
    if (taskClients) {
      taskClients.forEach((res) => {
        try {
          res.end();
        } catch {
          /* ignore */
        }
      });
      this.clients.delete(taskId);
    }
  }

  /**
   * Remove a specific client from the map.
   * @param taskId The task ID.
   * @param res The specific Response object.
   */
  removeClient(taskId: string, res: Response) {
    const taskClients = this.clients.get(taskId);
    if (taskClients) {
      taskClients.delete(res);
      if (taskClients.size === 0) {
        this.clients.delete(taskId);
      }
    }
  }
}
