import type { IAgentStorage, AgentStatus, RegisteredAgent } from './IAgentStorage.js';

export interface RegistryRedisClient {
  get(key: string): Promise<string | null>;
  set(key: string, value: string): Promise<unknown>;
  del(key: string): Promise<number>;
  keys(pattern: string): Promise<string[]>;
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
    const keys = await this.client.keys(this.key('*'));
    const values = await Promise.all(keys.map((key) => this.client.get(key)));
    return values
      .filter((value): value is string => typeof value === 'string')
      .map((value) => JSON.parse(value) as RegisteredAgent);
  }

  async delete(id: string): Promise<boolean> {
    return (await this.client.del(this.key(id))) > 0;
  }

  async updateStatus(id: string, status: AgentStatus): Promise<void> {
    const current = await this.get(id);
    if (current) {
      await this.upsert({ ...current, status });
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
