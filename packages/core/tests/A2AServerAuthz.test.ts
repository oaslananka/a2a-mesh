import { describe, it, expect } from 'vitest';
import request from 'supertest';
import express from 'express';
import { A2AServer } from '../src/server/A2AServer.js';
import type { AgentCard, TaskManager } from '../src/index.js';
import type { Artifact, Message, Task } from '../src/types/task.js';

const mockCard: AgentCard = {
  protocolVersion: '1.0',
  name: 'Test',
  description: 'Test',
  version: '1.0',
  url: 'http://test',
};

class TestServer extends A2AServer {
  constructor() {
    super(mockCard);
  }

  async handleTask(_task: Task, _message: Message): Promise<Artifact[]> {
    return [];
  }

  getApp() {
    return this.app;
  }
  getTaskManager(): TaskManager {
    return this.taskManager;
  }
}

describe('A2AServer Authorization', () => {
  it("prevents a user from getting another user's task", async () => {
    const server = new TestServer();
    const taskManager = server.getTaskManager();

    const task = taskManager.createTask('sess', 'ctx', 'user-A', 'tenant-1');

    // Express wrapper to inject req.principalId
    const app = express();
    app.use(express.json());
    app.use((req, res, next) => {
      (req as any).principalId = req.headers['x-principal'];
      (req as any).tenantId = req.headers['x-tenant'];
      next();
    });
    app.use(server.getApp());

    const getRes1 = await request(app)
      .post('/')
      .set('x-principal', 'user-B')
      .send({ jsonrpc: '2.0', method: 'tasks/get', params: { taskId: task.id }, id: 1 });

    expect(getRes1.body.error.message).toBe('Unauthorized task access');

    const getRes2 = await request(app)
      .post('/')
      .set('x-principal', 'user-A')
      .send({ jsonrpc: '2.0', method: 'tasks/get', params: { taskId: task.id }, id: 2 });

    expect(getRes2.body.result.id).toBe(task.id);
  });

  it('filters task list by principal and tenant', async () => {
    const server = new TestServer();
    const taskManager = server.getTaskManager();

    taskManager.createTask('sess1', 'ctx', 'user-A', 'tenant-1');
    taskManager.createTask('sess2', 'ctx', 'user-A', 'tenant-2');
    taskManager.createTask('sess3', 'ctx', 'user-B', 'tenant-1');

    const app = express();
    app.use(express.json());
    app.use((req, res, next) => {
      (req as any).principalId = req.headers['x-principal'];
      (req as any).tenantId = req.headers['x-tenant'];
      next();
    });
    app.use(server.getApp());

    const listRes = await request(app)
      .post('/')
      .set('x-principal', 'user-A')
      .set('x-tenant', 'tenant-1')
      .send({ jsonrpc: '2.0', method: 'tasks/list', params: {}, id: 1 });

    expect(listRes.body.result.tasks).toHaveLength(1);
    expect(listRes.body.result.tasks[0].principalId).toBe('user-A');
    expect(listRes.body.result.tasks[0].tenantId).toBe('tenant-1');
  });
});
