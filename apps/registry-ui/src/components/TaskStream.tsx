import { Activity, Clock3, Sparkles } from 'lucide-react';
import type { RegistryTaskEvent } from '../api/registry';

interface TaskStreamProps {
  tasks: RegistryTaskEvent[];
  loading: boolean;
  error: string | null;
  connected: boolean;
  selectedAgentId?: string | null;
}

const statusClasses: Record<RegistryTaskEvent['status'], string> = {
  submitted: 'border-slate-300/20 bg-slate-300/8 text-slate-100',
  queued: 'border-blue-300/20 bg-blue-300/10 text-blue-100',
  working: 'border-cyan-300/20 bg-cyan-300/10 text-cyan-100',
  'input-required': 'border-amber-300/20 bg-amber-300/10 text-amber-100',
  waiting_on_external: 'border-violet-300/20 bg-violet-300/10 text-violet-100',
  completed: 'border-emerald-300/20 bg-emerald-300/10 text-emerald-100',
  failed: 'border-rose-300/20 bg-rose-300/10 text-rose-100',
  canceled: 'border-slate-400/20 bg-slate-400/10 text-slate-200',
};

export function TaskStream({ tasks, loading, error, connected, selectedAgentId }: TaskStreamProps) {
  const visibleTasks = selectedAgentId
    ? tasks.filter((task) => task.agentId === selectedAgentId)
    : tasks;

  return (
    <section className="glass-panel rounded-[34px] border border-white/10 p-6 shadow-[0_30px_80px_rgba(2,8,23,0.35)]">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-[11px] uppercase tracking-[0.32em] text-cyan-100">Task stream</p>
          <h2 className="mesh-display mt-2 text-3xl font-bold">Live execution feed</h2>
        </div>
        <div className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-xs uppercase tracking-[0.24em] text-slate-200">
          <span
            className={`mr-2 inline-block h-2.5 w-2.5 rounded-full ${
              connected ? 'bg-emerald-400 shadow-[0_0_14px_rgba(74,222,128,0.75)]' : 'bg-amber-300'
            }`}
          />
          {connected ? 'Live' : 'Retrying'}
        </div>
      </div>

      {loading ? <p className="mt-6 text-sm text-slate-300">Loading task activity...</p> : null}
      {error ? <p className="mt-6 text-sm text-rose-200/90">{error}</p> : null}

      {!loading && visibleTasks.length === 0 ? (
        <div className="mt-8 rounded-[26px] border border-white/10 bg-white/5 px-5 py-10 text-center text-slate-300">
          <Sparkles className="mx-auto mb-3 text-cyan-200" size={24} />
          No recent task events yet.
        </div>
      ) : null}

      <div className="mt-6 space-y-3">
        {visibleTasks.map((task) => (
          <article
            key={`${task.agentId}-${task.taskId}`}
            className="rounded-[26px] border border-white/10 bg-slate-950/35 px-4 py-4"
          >
            <div className="flex flex-wrap items-center gap-3">
              <span className="inline-flex items-center gap-2 text-sm font-semibold text-slate-50">
                <Activity size={16} className="text-cyan-200" />
                {task.agentName}
              </span>
              <span
                className={`rounded-full border px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.24em] ${statusClasses[task.status]}`}
              >
                {task.status}
              </span>
              <span className="ml-auto inline-flex items-center gap-1 text-xs text-slate-400">
                <Clock3 size={14} />
                {new Date(task.updatedAt).toLocaleTimeString()}
              </span>
            </div>

            <p className="mt-3 text-sm leading-6 text-slate-200/85">
              {task.summary ?? 'Task event captured. Expand the agent inspector for more detail.'}
            </p>

            <div className="mt-4 flex flex-wrap gap-2 text-xs text-slate-300">
              <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1">
                Task {task.taskId.slice(0, 8)}
              </span>
              {task.contextId ? (
                <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1">
                  Context {task.contextId.slice(0, 8)}
                </span>
              ) : null}
              <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1">
                {task.historyCount} messages
              </span>
              <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1">
                {task.artifactCount} artifacts
              </span>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
