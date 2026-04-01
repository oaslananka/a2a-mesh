import type { IAgentStorage, AgentStatus, RegisteredAgent } from './IAgentStorage.js';

export class InMemoryStorage implements IAgentStorage {
  private readonly agents = new Map<string, RegisteredAgent>();

  async upsert(agent: RegisteredAgent): Promise<RegisteredAgent> {
    this.agents.set(agent.id, agent);
    return agent;
  }

  async get(id: string): Promise<RegisteredAgent | null> {
    return this.agents.get(id) ?? null;
  }

  async getAll(): Promise<RegisteredAgent[]> {
    return Array.from(this.agents.values());
  }

  async delete(id: string): Promise<boolean> {
    return this.agents.delete(id);
  }

  async updateStatus(id: string, status: AgentStatus): Promise<void> {
    const current = this.agents.get(id);
    if (current) {
      this.agents.set(id, { ...current, status });
    }
  }

  async findBySkill(skill: string): Promise<RegisteredAgent[]> {
    const normalized = skill.toLowerCase();
    return Array.from(this.agents.values()).filter((agent) =>
      agent.skills.some((value) => value.toLowerCase().includes(normalized)),
    );
  }
}
