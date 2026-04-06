export type AgentStatus = 'healthy' | 'unhealthy' | 'unknown';

export interface AgentSkill {
  id: string;
  name: string;
  description: string;
  tags?: string[];
}

export interface RegisteredAgent {
  id: string;
  url: string;
  status: AgentStatus;
  tags?: string[];
  skills?: string[];
  registeredAt?: string;
  lastHeartbeatAt?: string;
  consecutiveFailures?: number;
  lastSuccessAt?: string;
  card: {
    name: string;
    description: string;
    version: string;
    transport?: 'http' | 'sse' | 'ws' | 'grpc';
    skills?: AgentSkill[];
    capabilities?: {
      streaming?: boolean;
      pushNotifications?: boolean;
      stateTransitionHistory?: boolean;
      mcpCompatible?: boolean;
      backgroundJobs?: boolean;
    };
  };
}

export interface RegistryMetrics {
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

export type TaskStatus =
  | 'submitted'
  | 'queued'
  | 'working'
  | 'input-required'
  | 'waiting_on_external'
  | 'completed'
  | 'failed'
  | 'canceled';

export interface RegistryTaskEvent {
  taskId: string;
  agentId: string;
  agentName: string;
  agentUrl: string;
  status: TaskStatus;
  updatedAt: string;
  contextId?: string;
  summary?: string;
  historyCount: number;
  artifactCount: number;
  task: {
    id: string;
    contextId?: string;
    status: {
      state: TaskStatus;
      timestamp: string;
    };
  };
}

export type AgentStreamPayload = RegisteredAgent | { id: string; deleted: true };

const BASE = (import.meta.env.VITE_REGISTRY_URL ?? '/api').replace(/\/$/, '');

function endpoint(path: string): string {
  return `${BASE}${path.startsWith('/') ? path : `/${path}`}`;
}

export async function fetchAgents(): Promise<RegisteredAgent[]> {
  const response = await fetch(endpoint('/agents'));
  if (!response.ok) {
    throw new Error(`Registry error: ${response.status}`);
  }

  return (await response.json()) as RegisteredAgent[];
}

export async function fetchMetrics(): Promise<RegistryMetrics> {
  const response = await fetch(endpoint('/metrics/summary'));
  if (!response.ok) {
    return {
      registrations: 0,
      searches: 0,
      heartbeats: 0,
      agentCount: 0,
      healthyAgents: 0,
      unhealthyAgents: 0,
      unknownAgents: 0,
      activeTenants: 0,
      publicAgents: 0,
    };
  }

  return (await response.json()) as RegistryMetrics;
}

export async function fetchRecentTasks(limit = 30): Promise<RegistryTaskEvent[]> {
  const response = await fetch(endpoint(`/tasks/recent?limit=${limit}`));
  if (!response.ok) {
    throw new Error(`Task stream error: ${response.status}`);
  }

  return (await response.json()) as RegistryTaskEvent[];
}

export function subscribeToAgentUpdates(
  onAgent: (payload: AgentStreamPayload) => void,
  onError?: (event: Event) => void,
): () => void {
  const eventSource = new EventSource(endpoint('/agents/stream'));

  eventSource.onmessage = (event) => {
    try {
      onAgent(JSON.parse(event.data) as AgentStreamPayload);
    } catch {
      // ignore malformed events
    }
  };

  if (onError) {
    eventSource.onerror = onError;
  }

  return () => eventSource.close();
}

export function subscribeToTaskStream(
  onTask: (taskEvent: RegistryTaskEvent) => void,
  onError?: (event: Event) => void,
): () => void {
  const eventSource = new EventSource(endpoint('/tasks/stream'));

  eventSource.onmessage = (event) => {
    try {
      onTask(JSON.parse(event.data) as RegistryTaskEvent);
    } catch {
      // ignore malformed events
    }
  };

  if (onError) {
    eventSource.onerror = onError;
  }

  return () => eventSource.close();
}
