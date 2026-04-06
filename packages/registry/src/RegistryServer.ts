/**
 * @file RegistryServer.ts
 * REST API for registering and discovering A2A agents.
 */

import { EventEmitter } from 'node:events';
import { randomUUID } from 'node:crypto';
import express, { type Express, type Request, type Response } from 'express';
import cors from 'cors';
import {
  logger,
  normalizeAgentCard,
  validateSafeUrl,
  fetchWithPolicy,
  type AgentCard,
  type Task,
} from 'a2a-mesh';
import { SkillMatcher } from './SkillMatcher.js';
import { InMemoryStorage } from './storage/InMemoryStorage.js';
import type { IAgentStorage, RegisteredAgent } from './storage/IAgentStorage.js';

export interface RegistryServerOptions {
  storage?: IAgentStorage;
  requireAuth?: boolean;
  registrationToken?: string;
  allowLocalhost?: boolean;
  allowPrivateNetworks?: boolean;
  taskPollingIntervalMs?: number;
  maxRecentTasks?: number;
}

/**
 * Registry service for agent registration, discovery, health, metrics, and live updates.
 *
 * @since 1.0.0
 */
interface RequestWithAuth extends Request {
  tenantId?: string;
}

export interface RegistryMetricsSummary {
  registrations: number;
  searches: number;
  heartbeats: number;
  agentCount: number;
  healthyAgents: number;
  unhealthyAgents: number;
  unknownAgents: number;
  activeTenants: number;
  publicAgents: number;
}

export interface RegistryTaskEvent {
  taskId: string;
  agentId: string;
  agentName: string;
  agentUrl: string;
  status: Task['status']['state'];
  updatedAt: string;
  contextId?: string;
  summary?: string;
  historyCount: number;
  artifactCount: number;
  task: Task;
}

export class RegistryServer {
  private readonly app: Express;
  private readonly store: IAgentStorage;
  private readonly events = new EventEmitter();
  private readonly taskEvents = new EventEmitter();
  private pingInterval: NodeJS.Timeout | null = null;
  private taskPollInterval: NodeJS.Timeout | null = null;
  private readonly options: RegistryServerOptions;
  private readonly recentTasks = new Map<string, RegistryTaskEvent>();
  private readonly taskVersions = new Map<string, string>();
  private metrics = {
    registrations: 0,
    searches: 0,
    heartbeats: 0,
  };

  constructor(options: RegistryServerOptions = {}) {
    this.options = options;
    this.app = express();
    this.app.use(cors());
    this.app.use(express.json());
    this.store = options.storage ?? new InMemoryStorage();

    this.setupRoutes();
  }

  private setupRoutes() {
    this.app.get('/health', async (_req, res) => {
      const agents = await this.store.getAll();
      res.json({
        status: 'ok',
        agents: agents.length,
        healthyAgents: agents.filter((agent) => agent.status === 'healthy').length,
      });
    });

    this.app.get('/metrics', async (_req, res) => {
      const summary = await this.getMetricsSummary();
      res.setHeader('Content-Type', 'text/plain; version=0.0.4');

      res.send(
        [
          '# HELP a2a_registry_registrations_total Total agent registrations.',
          '# TYPE a2a_registry_registrations_total counter',
          `a2a_registry_registrations_total ${summary.registrations}`,
          '# HELP a2a_registry_searches_total Total registry searches.',
          '# TYPE a2a_registry_searches_total counter',
          `a2a_registry_searches_total ${summary.searches}`,
          '# HELP a2a_registry_heartbeats_total Total registry heartbeats.',
          '# TYPE a2a_registry_heartbeats_total counter',
          `a2a_registry_heartbeats_total ${summary.heartbeats}`,
          '# HELP a2a_registry_agents Number of known agents.',
          '# TYPE a2a_registry_agents gauge',
          `a2a_registry_agents ${summary.agentCount}`,
          '# HELP a2a_registry_healthy_agents Number of healthy agents.',
          '# TYPE a2a_registry_healthy_agents gauge',
          `a2a_registry_healthy_agents ${summary.healthyAgents}`,
          '# HELP a2a_registry_active_tenants Number of unique tenants with registered agents.',
          '# TYPE a2a_registry_active_tenants gauge',
          `a2a_registry_active_tenants ${summary.activeTenants}`,
          '# HELP a2a_registry_public_agents Number of public agents.',
          '# TYPE a2a_registry_public_agents gauge',
          `a2a_registry_public_agents ${summary.publicAgents}`,
        ].join('\n'),
      );
    });

    this.app.get('/metrics/summary', async (_req, res) => {
      res.json(await this.getMetricsSummary());
    });

    this.app.get('/events', (_req: Request, res: Response) => {
      this.configureSse(res);
      const listener = (payload: unknown) => {
        res.write(`event: registry_update\ndata: ${JSON.stringify(payload)}\n\n`);
      };
      this.events.on('registry_update', listener);
      res.on('close', () => {
        this.events.off('registry_update', listener);
      });
    });

    this.app.get('/agents/stream', (_req: Request, res: Response) => {
      this.configureSse(res);

      const listener = (payload: unknown) => {
        const normalized = this.normalizeAgentStreamPayload(payload);
        if (!normalized) {
          return;
        }
        res.write(`data: ${JSON.stringify(normalized)}\n\n`);
      };

      this.events.on('registry_update', listener);
      res.on('close', () => {
        this.events.off('registry_update', listener);
      });
    });

    this.app.post('/agents/register', async (req, res) => {
      if (this.options.requireAuth && this.options.registrationToken) {
        const authHeader = req.headers.authorization;
        if (authHeader !== `Bearer ${this.options.registrationToken}`) {
          res.status(401).json({ error: 'Unauthorized' });
          return;
        }
      }

      const body = req.body as {
        agentUrl?: string;
        agentCard?: AgentCard;
        tenantId?: string;
        isPublic?: boolean;
      };
      const { agentUrl, agentCard, tenantId, isPublic } = body;
      if (!agentUrl || !agentCard) {
        res.status(400).json({ error: 'Missing agentUrl or agentCard' });
        return;
      }

      try {
        await validateSafeUrl(agentUrl, {
          allowLocalhost: this.options.allowLocalhost ?? false,
          allowPrivateNetworks: this.options.allowPrivateNetworks ?? false,
        });
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        res.status(400).json({ error: `Invalid agentUrl: ${message}` });
        return;
      }

      const authTenantId = (req as RequestWithAuth).tenantId;
      const finalTenantId = authTenantId ?? tenantId;

      const registered = await this.store.upsert(
        this.toRegisteredAgent(agentUrl, normalizeAgentCard(agentCard), finalTenantId, isPublic),
      );
      this.metrics.registrations += 1;
      this.emitRegistryEvent({ type: 'registered', agent: registered });
      logger.audit('register_agent', finalTenantId, `agent:${registered.id}`, 'success', {
        url: registered.url,
      });
      logger.info('Agent registered', {
        id: registered.id,
        url: registered.url,
        ...(finalTenantId ? { tenantId: finalTenantId } : {}),
      });
      res.status(201).json(registered);
    });

    this.app.get('/agents', async (req, res) => {
      const authTenantId = (req as RequestWithAuth).tenantId;
      let all = await this.store.getAll();

      if (authTenantId) {
        all = all.filter((a) => a.isPublic || !a.tenantId || a.tenantId === authTenantId);
      }
      res.json(all);
    });

    this.app.get('/tasks/recent', async (req, res) => {
      if (this.recentTasks.size === 0) {
        await this.refreshTaskSnapshots();
      }

      const limitParam = Number(req.query.limit);
      const limit =
        Number.isFinite(limitParam) && limitParam > 0
          ? limitParam
          : (this.options.maxRecentTasks ?? 50);

      res.json(this.getRecentTasks(limit));
    });

    this.app.get('/tasks/stream', async (_req, res) => {
      this.configureSse(res);

      for (const taskEvent of this.getRecentTasks(10)) {
        res.write(`data: ${JSON.stringify(taskEvent)}\n\n`);
      }

      const listener = (payload: RegistryTaskEvent) => {
        res.write(`data: ${JSON.stringify(payload)}\n\n`);
      };

      this.taskEvents.on('task_updated', listener);
      res.on('close', () => {
        this.taskEvents.off('task_updated', listener);
      });
    });

    this.app.get('/agents/search', async (req, res) => {
      const skill = typeof req.query.skill === 'string' ? req.query.skill : '';
      const tag = typeof req.query.tag === 'string' ? req.query.tag : '';
      const name = typeof req.query.name === 'string' ? req.query.name : '';
      const transport = req.query.transport as 'http' | 'sse' | 'ws' | 'grpc' | undefined;
      const status = req.query.status as 'healthy' | 'unhealthy' | 'unknown' | undefined;
      const mcpCompatible =
        req.query.mcpCompatible === 'true'
          ? true
          : req.query.mcpCompatible === 'false'
            ? false
            : undefined;

      if (!skill && !tag && !name && !transport && !status && mcpCompatible === undefined) {
        res.status(400).json({
          error:
            'At least one filter (skill, tag, name, transport, status, mcpCompatible) is required',
        });
        return;
      }

      this.metrics.searches += 1;

      const authTenantId = (req as RequestWithAuth).tenantId;
      let all = await this.store.getAll();

      if (authTenantId) {
        all = all.filter((a) => a.isPublic || !a.tenantId || a.tenantId === authTenantId);
      }

      const matches = SkillMatcher.match(all, {
        ...(skill ? { skill } : {}),
        ...(tag ? { tag } : {}),
        ...(name ? { name } : {}),
        ...(transport ? { transport } : {}),
        ...(status ? { status } : {}),
        ...(mcpCompatible !== undefined ? { mcpCompatible } : {}),
      });
      res.json(matches);
    });

    this.app.get('/agents/:id', async (req, res) => {
      const agent = await this.store.get(req.params.id);
      if (!agent) {
        res.status(404).json({ error: 'Agent not found' });
        return;
      }
      res.json(agent);
    });

    this.app.post('/agents/:id/heartbeat', async (req, res) => {
      const agent = await this.store.get(req.params.id);
      if (!agent) {
        res.status(404).json({ error: 'Agent not found' });
        return;
      }

      const updated: RegisteredAgent = {
        ...agent,
        status: 'healthy',
        lastHeartbeatAt: new Date().toISOString(),
        consecutiveFailures: 0,
        lastSuccessAt: new Date().toISOString(),
      };
      await this.store.upsert(updated);
      this.metrics.heartbeats += 1;
      this.emitRegistryEvent({ type: 'heartbeat', agent: updated });
      res.json(updated);
    });

    this.app.delete('/agents/:id', async (req, res) => {
      if (this.options.requireAuth && this.options.registrationToken) {
        const authHeader = req.headers.authorization;
        if (authHeader !== `Bearer ${this.options.registrationToken}`) {
          res.status(401).json({ error: 'Unauthorized' });
          return;
        }
      }

      const deleted = await this.store.delete(req.params.id);
      if (!deleted) {
        res.status(404).json({ error: 'Agent not found' });
        return;
      }
      const tenantIdStr = (req as RequestWithAuth).tenantId;
      logger.audit('delete_agent', tenantIdStr, `agent:${req.params.id}`, 'success');
      this.purgeAgentTaskState(req.params.id);
      this.emitRegistryEvent({ type: 'deleted', id: req.params.id });
      res.status(204).send();
    });
  }

  private async executeHealthChecks(agents: RegisteredAgent[]) {
    // Concurrency limit logic: process agents in chunks to avoid thundering herd and network socket exhaustion
    const CONCURRENCY_LIMIT = 5;
    for (let i = 0; i < agents.length; i += CONCURRENCY_LIMIT) {
      const chunk = agents.slice(i, i + CONCURRENCY_LIMIT);

      await Promise.all(
        chunk.map(async (agent) => {
          // Adding Jitter so that multiple agents don't get pinged exactly at the same millisecond
          const jitterMs = Math.random() * 500;
          await new Promise((resolve) => setTimeout(resolve, jitterMs));

          try {
            let validatedUrl: URL;
            try {
              validatedUrl = await validateSafeUrl(this.buildAgentUrl(agent.url, '/health'), {
                allowLocalhost: this.options.allowLocalhost ?? false,
                allowPrivateNetworks: this.options.allowPrivateNetworks ?? false,
              });
            } catch (e: unknown) {
              throw new Error('Unsafe URL during health check', { cause: e });
            }

            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 5000);

            const res = await fetchWithPolicy(
              validatedUrl.toString(),
              { signal: controller.signal },
              { timeoutMs: 5000, retries: 0 },
            );
            clearTimeout(timeoutId);

            const status = res.ok ? 'healthy' : 'unhealthy';
            const consecutiveFailures = res.ok ? 0 : (agent.consecutiveFailures ?? 0) + 1;
            const lastSuccessAt = res.ok ? new Date().toISOString() : agent.lastSuccessAt;

            await this.store.updateStatus(agent.id, status, {
              consecutiveFailures,
              ...(lastSuccessAt ? { lastSuccessAt } : {}),
            });
          } catch (error) {
            const consecutiveFailures = (agent.consecutiveFailures ?? 0) + 1;
            await this.store.updateStatus(agent.id, 'unhealthy', { consecutiveFailures });
            logger.warn('Agent unreachable', {
              agentId: agent.id,
              error: String(error),
              consecutiveFailures,
            });
          }
        }),
      );
    }
  }

  private startHealthChecks() {
    this.pingInterval = setInterval(async () => {
      try {
        const agents = await this.store.getAll();
        await this.executeHealthChecks(agents);
      } catch (err) {
        logger.error('Failed to run health checks', { error: String(err) });
      }
    }, 30_000);
  }

  private async refreshTaskSnapshots(): Promise<void> {
    const agents = await this.store.getAll();
    if (agents.length === 0) {
      return;
    }

    await this.executeTaskPolling(agents);
  }

  private async executeTaskPolling(agents: RegisteredAgent[]) {
    const concurrencyLimit = 5;

    for (let index = 0; index < agents.length; index += concurrencyLimit) {
      const chunk = agents.slice(index, index + concurrencyLimit);
      await Promise.all(chunk.map(async (agent) => this.pollAgentTasks(agent)));
    }
  }

  private async pollAgentTasks(agent: RegisteredAgent): Promise<void> {
    try {
      const validatedUrl = await validateSafeUrl(this.buildAgentUrl(agent.url, '/tasks?limit=20'), {
        allowLocalhost: this.options.allowLocalhost ?? false,
        allowPrivateNetworks: this.options.allowPrivateNetworks ?? false,
      });
      const response = await fetchWithPolicy(validatedUrl.toString(), undefined, {
        timeoutMs: 5_000,
        retries: 0,
      });

      if (!response.ok) {
        return;
      }

      const tasks = (await response.json()) as Task[];
      for (const task of tasks) {
        const taskEvent = this.toTaskEvent(agent, task);
        const version = this.buildTaskVersion(taskEvent);
        const key = `${agent.id}:${task.id}`;

        if (this.taskVersions.get(key) === version) {
          continue;
        }

        this.taskVersions.set(key, version);
        this.recentTasks.set(key, taskEvent);
        this.trimRecentTasks();
        this.taskEvents.emit('task_updated', taskEvent);
      }
    } catch (error) {
      logger.debug('Skipping task poll for agent', {
        agentId: agent.id,
        error: String(error),
      });
    }
  }

  private startTaskPolling(): void {
    const intervalMs = this.options.taskPollingIntervalMs ?? 5_000;
    this.taskPollInterval = setInterval(() => {
      void this.refreshTaskSnapshots().catch((error: unknown) => {
        logger.warn('Failed to refresh registry task snapshots', {
          error: String(error),
        });
      });
    }, intervalMs);
  }

  public start(port: number) {
    this.startHealthChecks();
    this.startTaskPolling();
    void this.refreshTaskSnapshots();
    return this.app.listen(port, () => {
      logger.info('Registry Server listening', { port });
    });
  }

  public stop() {
    if (this.pingInterval) {
      clearInterval(this.pingInterval);
    }
    if (this.taskPollInterval) {
      clearInterval(this.taskPollInterval);
    }
  }

  private emitRegistryEvent(payload: unknown): void {
    this.events.emit('registry_update', payload);
  }

  private configureSse(res: Response): void {
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    });
  }

  private normalizeAgentStreamPayload(
    payload: unknown,
  ): RegisteredAgent | { id: string; deleted: true } | null {
    if (
      payload &&
      typeof payload === 'object' &&
      'type' in payload &&
      typeof payload.type === 'string'
    ) {
      if ((payload.type === 'registered' || payload.type === 'heartbeat') && 'agent' in payload) {
        return payload.agent as RegisteredAgent;
      }

      if (payload.type === 'deleted' && 'id' in payload && typeof payload.id === 'string') {
        return { id: payload.id, deleted: true };
      }
    }

    return null;
  }

  private getRecentTasks(limit: number): RegistryTaskEvent[] {
    return [...this.recentTasks.values()]
      .sort((left, right) => Date.parse(right.updatedAt) - Date.parse(left.updatedAt))
      .slice(0, limit);
  }

  private trimRecentTasks(): void {
    const maxRecentTasks = this.options.maxRecentTasks ?? 50;
    const recentEntries = [...this.recentTasks.entries()].sort(
      (left, right) => Date.parse(right[1].updatedAt) - Date.parse(left[1].updatedAt),
    );

    for (const [key] of recentEntries.slice(maxRecentTasks)) {
      this.recentTasks.delete(key);
      this.taskVersions.delete(key);
    }
  }

  private buildTaskVersion(taskEvent: RegistryTaskEvent): string {
    return JSON.stringify({
      status: taskEvent.status,
      updatedAt: taskEvent.updatedAt,
      historyCount: taskEvent.historyCount,
      artifactCount: taskEvent.artifactCount,
      summary: taskEvent.summary,
    });
  }

  private toTaskEvent(agent: RegisteredAgent, task: Task): RegistryTaskEvent {
    const summary = this.extractTaskSummary(task);

    return {
      taskId: task.id,
      agentId: agent.id,
      agentName: agent.card.name,
      agentUrl: agent.url,
      status: task.status.state,
      updatedAt: task.status.timestamp,
      ...(task.contextId ? { contextId: task.contextId } : {}),
      ...(summary ? { summary } : {}),
      historyCount: task.history.length,
      artifactCount: task.artifacts?.length ?? 0,
      task,
    };
  }

  private extractTaskSummary(task: Task): string | undefined {
    const artifactText = task.artifacts
      ?.flatMap((artifact) => artifact.parts)
      .find((part) => part.type === 'text');

    if (artifactText?.type === 'text') {
      return artifactText.text.slice(0, 180);
    }

    const latestHistory = [...task.history]
      .reverse()
      .find((message) => message.parts.some((part) => part.type === 'text'));
    const latestText = latestHistory?.parts.find((part) => part.type === 'text');

    return latestText?.type === 'text' ? latestText.text.slice(0, 180) : undefined;
  }

  private purgeAgentTaskState(agentId: string): void {
    for (const key of [...this.recentTasks.keys()]) {
      if (key.startsWith(`${agentId}:`)) {
        this.recentTasks.delete(key);
        this.taskVersions.delete(key);
      }
    }
  }

  private async getMetricsSummary(): Promise<RegistryMetricsSummary> {
    const agents = await this.store.getAll();

    return {
      registrations: this.metrics.registrations,
      searches: this.metrics.searches,
      heartbeats: this.metrics.heartbeats,
      agentCount: agents.length,
      healthyAgents: agents.filter((agent) => agent.status === 'healthy').length,
      unhealthyAgents: agents.filter((agent) => agent.status === 'unhealthy').length,
      unknownAgents: agents.filter((agent) => agent.status === 'unknown').length,
      activeTenants: new Set(agents.map((agent) => agent.tenantId).filter(Boolean)).size,
      publicAgents: agents.filter((agent) => agent.isPublic).length,
    };
  }

  private toRegisteredAgent(
    agentUrl: string,
    card: AgentCard,
    tenantId?: string,
    isPublic?: boolean,
  ): RegisteredAgent {
    const tags = (card.skills ?? []).flatMap((skill) => skill.tags ?? []);
    const skills = (card.skills ?? []).map((skill) => skill.name);
    return {
      id: randomUUID(),
      url: agentUrl,
      card,
      status: 'unknown',
      tags,
      skills,
      registeredAt: new Date().toISOString(),
      ...(tenantId ? { tenantId } : {}),
      ...(typeof isPublic === 'boolean' ? { isPublic } : {}),
    };
  }

  private buildAgentUrl(baseUrl: string, path: string): string {
    return new URL(path, baseUrl).toString();
  }
}
