import type { RegisteredAgent } from '../api/registry';
import { AgentCard } from './AgentCard';

interface AgentGridProps {
  agents: RegisteredAgent[];
  loading: boolean;
  error: string | null;
  selectedAgentId: string | null;
  onSelect: (agent: RegisteredAgent) => void;
}

export function AgentGrid({ agents, loading, error, selectedAgentId, onSelect }: AgentGridProps) {
  if (loading) {
    return (
      <div className="glass-panel rounded-[32px] border border-white/10 px-6 py-16 text-center text-slate-300">
        Loading live registry state...
      </div>
    );
  }

  if (error && agents.length === 0) {
    return (
      <div className="glass-panel rounded-[32px] border border-rose-300/25 px-6 py-16 text-center">
        <p className="mesh-display text-2xl font-semibold text-rose-100">Registry unavailable</p>
        <p className="mt-3 text-sm leading-6 text-rose-100/80">{error}</p>
      </div>
    );
  }

  if (agents.length === 0) {
    return (
      <div className="glass-panel rounded-[32px] border border-white/10 px-6 py-16 text-center text-slate-300">
        No agents have registered yet. Start the demo or run a scaffolded project to watch the mesh
        come alive.
      </div>
    );
  }

  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
      {agents.map((agent) => (
        <AgentCard
          key={agent.id}
          agent={agent}
          selected={selectedAgentId === agent.id}
          onSelect={onSelect}
        />
      ))}
    </div>
  );
}
