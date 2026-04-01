/**
 * @file AgentRegistryClient.ts
 * Client for the local registry REST/SSE endpoints.
 */

import EventSource from 'eventsource';
import type { AgentCard } from '../types/agent-card.js';

export interface RegisteredAgent {
  id: string;
  url: string;
  card: AgentCard;
  status: 'healthy' | 'unhealthy' | 'unknown';
  tags: string[];
  skills: string[];
  registeredAt: string;
  lastHeartbeatAt?: string;
}

/**
 * Client for the registry REST and SSE endpoints.
 *
 * @example
 * ```ts
 * const registry = new AgentRegistryClient('http://localhost:3099');
 * const agents = await registry.listAgents();
 * ```
 * @since 1.0.0
 */
export class AgentRegistryClient {
  constructor(private readonly baseUrl: string, private readonly fetchImplementation: typeof fetch = fetch) {}

  async register(agentUrl: string, agentCard: AgentCard): Promise<RegisteredAgent> {
    const response = await this.fetchImplementation(new URL('/agents/register', this.baseUrl), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ agentUrl, agentCard }),
    });
    if (!response.ok) {
      throw new Error(`Failed to register agent (${response.status})`);
    }
    return (await response.json()) as RegisteredAgent;
  }

  async listAgents(): Promise<RegisteredAgent[]> {
    const response = await this.fetchImplementation(new URL('/agents', this.baseUrl));
    if (!response.ok) {
      throw new Error(`Failed to list agents (${response.status})`);
    }
    return (await response.json()) as RegisteredAgent[];
  }

  async getAgent(id: string): Promise<RegisteredAgent> {
    const response = await this.fetchImplementation(new URL(`/agents/${id}`, this.baseUrl));
    if (!response.ok) {
      throw new Error(`Failed to fetch agent (${response.status})`);
    }
    return (await response.json()) as RegisteredAgent;
  }

  async searchAgents(query: string, filters: Record<string, string> = {}): Promise<RegisteredAgent[]> {
    const url = new URL('/agents/search', this.baseUrl);
    url.searchParams.set('skill', query);
    for (const [key, value] of Object.entries(filters)) {
      url.searchParams.set(key, value);
    }
    const response = await this.fetchImplementation(url);
    if (!response.ok) {
      throw new Error(`Failed to search agents (${response.status})`);
    }
    return (await response.json()) as RegisteredAgent[];
  }

  async sendHeartbeat(id: string): Promise<RegisteredAgent> {
    const response = await this.fetchImplementation(new URL(`/agents/${id}/heartbeat`, this.baseUrl), {
      method: 'POST',
    });
    if (!response.ok) {
      throw new Error(`Failed to send heartbeat (${response.status})`);
    }
    return (await response.json()) as RegisteredAgent;
  }

  async health(): Promise<Record<string, unknown>> {
    const response = await this.fetchImplementation(new URL('/health', this.baseUrl));
    if (!response.ok) {
      throw new Error(`Failed to fetch registry health (${response.status})`);
    }
    return (await response.json()) as Record<string, unknown>;
  }

  async *events(): AsyncGenerator<unknown> {
    const source = new EventSource(new URL('/events', this.baseUrl).toString());
    const queue: unknown[] = [];
    let resolveNext: (() => void) | undefined;
    let closed = false;

    source.addEventListener('registry_update', (event) => {
      const data = 'data' in event ? JSON.parse(String(event.data)) : null;
      queue.push(data);
      resolveNext?.();
    });
    source.onerror = () => {
      closed = true;
      source.close();
      resolveNext?.();
    };

    try {
      while (!closed || queue.length > 0) {
        if (queue.length === 0) {
          await new Promise<void>((resolve) => {
            resolveNext = resolve;
          });
          resolveNext = undefined;
        }
        const next = queue.shift();
        if (next !== undefined) {
          yield next;
        }
      }
    } finally {
      source.close();
    }
  }
}
