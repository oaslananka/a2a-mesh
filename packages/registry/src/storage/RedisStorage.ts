import type { IAgentStorage, AgentStatus, RegisteredAgent } from './IAgentStorage.js';

export interface RegistryRedisClient {
  get(key: string): Promise<string | null>;
  set(key: string, value: string): Promise<unknown>;
  del(key: string): Promise<number>;
  scan?(
    cursor: string | number,
    matchOption: 'MATCH',
    pattern: string,
    countOption?: 'COUNT',
    count?: number,
  ): Promise<[string, string[]]>;
  keys?(pattern: string): Promise<string[]>; // fallback for legacy clients
}

export class RedisStorage implements IAgentStorage {
  constructor(
    private readonly client: RegistryRedisClient,
    private readonly prefix = 'a2a:registry',
  ) {}

  async upsert(agent: RegisteredAgent): Promise<RegisteredAgent> {
    await this.client.set(this.key(agent.id), JSON.stringify(agent));
    return agent;
  }

  async get(id: string): Promise<RegisteredAgent | null> {
    const value = await this.client.get(this.key(id));
    return value ? (JSON.parse(value) as RegisteredAgent) : null;
  }

  async getAll(): Promise<RegisteredAgent[]> {
    const keys = await this.getKeys(this.key('*'));

    // Chunk the GET commands to avoid blocking the network loop with massive Promise.all
    const values: (string | null)[] = [];
    const chunkSize = 100;

    for (let i = 0; i < keys.length; i += chunkSize) {
      const chunk = keys.slice(i, i + chunkSize);
      const chunkValues = await Promise.all(chunk.map((key) => this.client.get(key)));
      values.push(...chunkValues);
    }

    return values
      .filter((value): value is string => typeof value === 'string')
      .map((value) => JSON.parse(value) as RegisteredAgent);
  }

  private async getKeys(pattern: string): Promise<string[]> {
    if (typeof this.client.scan === 'function') {
      const keys: string[] = [];
      let cursor = '0';
      do {
        const result = await this.client.scan(cursor, 'MATCH', pattern, 'COUNT', 100);
        // Note: ioredis returns [cursor, keys] as [string, string[]]
        cursor = result[0];
        keys.push(...result[1]);
      } while (cursor !== '0');

      // Deduplicate keys as SCAN can return duplicates
      return Array.from(new Set(keys));
    }

    if (typeof this.client.keys === 'function') {
      return await this.client.keys(pattern);
    }

    throw new Error('Redis client must support either SCAN or KEYS');
  }

  async delete(id: string): Promise<boolean> {
    return (await this.client.del(this.key(id))) > 0;
  }

  async updateStatus(
    id: string,
    status: AgentStatus,
    meta?: { consecutiveFailures?: number; lastSuccessAt?: string },
  ): Promise<void> {
    const current = await this.get(id);
    if (current) {
      await this.upsert({
        ...current,
        status,
        ...(meta?.consecutiveFailures !== undefined
          ? { consecutiveFailures: meta.consecutiveFailures }
          : {}),
        ...(meta?.lastSuccessAt !== undefined ? { lastSuccessAt: meta.lastSuccessAt } : {}),
      });
    }
  }

  async findBySkill(skill: string): Promise<RegisteredAgent[]> {
    const normalized = skill.toLowerCase();
    const agents = await this.getAll();
    return agents.filter((agent) =>
      agent.skills.some((value) => value.toLowerCase().includes(normalized)),
    );
  }

  private key(id: string): string {
    return `${this.prefix}:${id}`;
  }
}
