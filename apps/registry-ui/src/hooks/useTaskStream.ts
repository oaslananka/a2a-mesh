import { useCallback, useEffect, useState } from 'react';
import { fetchRecentTasks, subscribeToTaskStream, type RegistryTaskEvent } from '../api/registry';

function mergeTaskEvent(
  currentTasks: RegistryTaskEvent[],
  nextTask: RegistryTaskEvent,
  limit: number,
): RegistryTaskEvent[] {
  const deduplicated = currentTasks.filter(
    (task) => !(task.taskId === nextTask.taskId && task.agentId === nextTask.agentId),
  );

  return [nextTask, ...deduplicated]
    .sort((left, right) => Date.parse(right.updatedAt) - Date.parse(left.updatedAt))
    .slice(0, limit);
}

export function useTaskStream(limit = 30) {
  const [tasks, setTasks] = useState<RegistryTaskEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [connected, setConnected] = useState(false);

  const load = useCallback(async () => {
    try {
      const nextTasks = await fetchRecentTasks(limit);
      setTasks(nextTasks);
      setError(null);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Failed to load task stream');
    } finally {
      setLoading(false);
    }
  }, [limit]);

  useEffect(() => {
    void load();

    const unsubscribe = subscribeToTaskStream(
      (taskEvent) => {
        setConnected(true);
        setTasks((currentTasks) => mergeTaskEvent(currentTasks, taskEvent, limit));
      },
      () => {
        setConnected(false);
        setError((currentError) => currentError ?? 'Live task stream disconnected');
      },
    );

    return () => {
      unsubscribe();
    };
  }, [limit, load]);

  return {
    tasks,
    loading,
    error,
    connected,
    refresh: load,
  };
}
