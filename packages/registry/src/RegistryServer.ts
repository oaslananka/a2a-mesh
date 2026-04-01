/**
 * @file RegistryServer.ts
 * REST API for registering and discovering A2A agents.
 */

import { EventEmitter } from 'node:events';
import { randomUUID } from 'node:crypto';
import express, { type Express, type Request, type Response } from 'express';
import cors from 'cors';
import { logger, normalizeAgentCard, type AgentCard } from 'a2a-mesh';
import { SkillMatcher } from './SkillMatcher.js';
import { InMemoryStorage } from './storage/InMemoryStorage.js';
import type { IAgentStorage, RegisteredAgent } from './storage/IAgentStorage.js';

export interface RegistryServerOptions {
  storage?: IAgentStorage;
}

/**
 * Registry service for agent registration, discovery, health, metrics, and live updates.
 *
 * @since 1.0.0
 */
export class RegistryServer {
  private readonly app: Express;
  private readonly store: IAgentStorage;
  private readonly events = new EventEmitter();
  private pingInterval: NodeJS.Timeout | null = null;
  private metrics = {
    registrations: 0,
    searches: 0,
    heartbeats: 0,
  };

  constructor(options: RegistryServerOptions = {}) {
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
      const agents = await this.store.getAll();
      const healthyAgents = agents.filter((agent) => agent.status === 'healthy').length;
      res.setHeader('Content-Type', 'text/plain; version=0.0.4');
      res.send(
        [
          '# HELP a2a_registry_registrations_total Total agent registrations.',
          '# TYPE a2a_registry_registrations_total counter',
          `a2a_registry_registrations_total ${this.metrics.registrations}`,
          '# HELP a2a_registry_searches_total Total registry searches.',
          '# TYPE a2a_registry_searches_total counter',
          `a2a_registry_searches_total ${this.metrics.searches}`,
          '# HELP a2a_registry_heartbeats_total Total registry heartbeats.',
          '# TYPE a2a_registry_heartbeats_total counter',
          `a2a_registry_heartbeats_total ${this.metrics.heartbeats}`,
          '# HELP a2a_registry_agents Number of known agents.',
          '# TYPE a2a_registry_agents gauge',
          `a2a_registry_agents ${agents.length}`,
          '# HELP a2a_registry_healthy_agents Number of healthy agents.',
          '# TYPE a2a_registry_healthy_agents gauge',
          `a2a_registry_healthy_agents ${healthyAgents}`,
        ].join('\n'),
      );
    });

    this.app.get('/events', (_req: Request, res: Response) => {
      res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
      });

      const listener = (payload: unknown) => {
        res.write(`event: registry_update\ndata: ${JSON.stringify(payload)}\n\n`);
      };
      this.events.on('registry_update', listener);
      res.on('close', () => {
        this.events.off('registry_update', listener);
      });
    });

    this.app.post('/agents/register', async (req, res) => {
      const { agentUrl, agentCard } = req.body as { agentUrl?: string; agentCard?: AgentCard };
      if (!agentUrl || !agentCard) {
        res.status(400).json({ error: 'Missing agentUrl or agentCard' });
        return;
      }

      const registered = await this.store.upsert(
        this.toRegisteredAgent(agentUrl, normalizeAgentCard(agentCard)),
      );
      this.metrics.registrations += 1;
      this.emitRegistryEvent({ type: 'registered', agent: registered });
      logger.info('Agent registered', { id: registered.id, url: registered.url });
      res.status(201).json(registered);
    });

    this.app.get('/agents', async (_req, res) => {
      res.json(await this.store.getAll());
    });

    this.app.get('/agents/search', async (req, res) => {
      const skill = typeof req.query.skill === 'string' ? req.query.skill : '';
      const tag = typeof req.query.tag === 'string' ? req.query.tag : '';
      const name = typeof req.query.name === 'string' ? req.query.name : '';

      if (!skill && !tag && !name) {
        res.status(400).json({ error: 'At least one of skill, tag or name is required' });
        return;
      }

      this.metrics.searches += 1;
      const matches = SkillMatcher.match(await this.store.getAll(), { skill, tag, name });
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
      };
      await this.store.upsert(updated);
      this.metrics.heartbeats += 1;
      this.emitRegistryEvent({ type: 'heartbeat', agent: updated });
      res.json(updated);
    });

    this.app.delete('/agents/:id', async (req, res) => {
      const deleted = await this.store.delete(req.params.id);
      if (!deleted) {
        res.status(404).json({ error: 'Agent not found' });
        return;
      }
      this.emitRegistryEvent({ type: 'deleted', id: req.params.id });
      res.status(204).send();
    });
  }

  private startHealthChecks() {
    this.pingInterval = setInterval(async () => {
      const agents = await this.store.getAll();
      for (const agent of agents) {
        try {
          const res = await fetch(`${agent.url}/health`);
          const status = res.ok ? 'healthy' : 'unhealthy';
          await this.store.updateStatus(agent.id, status);
        } catch (error) {
          await this.store.updateStatus(agent.id, 'unhealthy');
          logger.warn('Agent unreachable', { agentId: agent.id, error: String(error) });
        }
      }
    }, 30_000);
  }

  public start(port: number) {
    this.startHealthChecks();
    return this.app.listen(port, () => {
      logger.info('Registry Server listening', { port });
    });
  }

  public stop() {
    if (this.pingInterval) {
      clearInterval(this.pingInterval);
    }
  }

  private emitRegistryEvent(payload: unknown): void {
    this.events.emit('registry_update', payload);
  }

  private toRegisteredAgent(agentUrl: string, card: AgentCard): RegisteredAgent {
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
    };
  }
}
