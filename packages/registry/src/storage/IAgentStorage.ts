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
  /** Number of consecutive health check failures */
  consecutiveFailures?: number;
  /** Last time the agent passed a health check */
  lastSuccessAt?: string;
  /** The tenant or namespace this agent belongs to */
  tenantId?: string;
  /** If true, the agent can be discovered by other tenants */
  isPublic?: boolean;
}

export interface IAgentStorage {
  upsert(agent: RegisteredAgent): Promise<RegisteredAgent>;
  get(id: string): Promise<RegisteredAgent | null>;
  getAll(): Promise<RegisteredAgent[]>;
  delete(id: string): Promise<boolean>;
  updateStatus(
    id: string,
    status: AgentStatus,
    meta?: { consecutiveFailures?: number; lastSuccessAt?: string },
  ): Promise<void>;
  findBySkill(skill: string): Promise<RegisteredAgent[]>;
}
