import type { AgentCard } from 'a2a-mesh';

export type AgentStatus = 'healthy' | 'unhealthy' | 'unknown';

export interface RegisteredAgent {
  id: string;
  url: string;
  card: AgentCard;
  status: AgentStatus;
  tags: string[];
  skills: string[];
  registeredAt: string;
  lastHeartbeatAt?: string;
}

export interface IAgentStorage {
  upsert(agent: RegisteredAgent): Promise<RegisteredAgent>;
  get(id: string): Promise<RegisteredAgent | null>;
  getAll(): Promise<RegisteredAgent[]>;
  delete(id: string): Promise<boolean>;
  updateStatus(id: string, status: AgentStatus): Promise<void>;
  findBySkill(skill: string): Promise<RegisteredAgent[]>;
}
