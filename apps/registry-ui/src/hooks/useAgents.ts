import { useCallback, useEffect, useState } from 'react';
import {
  fetchAgents,
  subscribeToAgentUpdates,
  type AgentStreamPayload,
  type RegisteredAgent,
} from '../api/registry';

function applyAgentUpdate(
  currentAgents: RegisteredAgent[],
  payload: AgentStreamPayload,
): RegisteredAgent[] {
  if ('deleted' in payload) {
    return currentAgents.filter((agent) => agent.id !== payload.id);
  }

  const index = currentAgents.findIndex((agent) => agent.id === payload.id);
  if (index === -1) {
    return [payload, ...currentAgents];
  }

  const nextAgents = [...currentAgents];
  nextAgents[index] = payload;
  return nextAgents;
}

export function useAgents(pollIntervalMs = 5_000) {
  const [agents, setAgents] = useState<RegisteredAgent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const nextAgents = await fetchAgents();
      setAgents(nextAgents);
      setError(null);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Failed to load agents');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();

    const interval = window.setInterval(() => {
      void load();
    }, pollIntervalMs);

    const unsubscribe = subscribeToAgentUpdates(
      (payload) => {
        setAgents((currentAgents) => applyAgentUpdate(currentAgents, payload));
      },
      () => {
        setError((currentError) => currentError ?? 'Live registry updates disconnected');
      },
    );

    return () => {
      window.clearInterval(interval);
      unsubscribe();
    };
  }, [load, pollIntervalMs]);

  return {
    agents,
    loading,
    error,
    refresh: load,
  };
}
