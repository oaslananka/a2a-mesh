import { ArrowUpRight, Bot, Layers3 } from 'lucide-react';
import type { RegisteredAgent } from '../api/registry';
import { HealthBadge } from './HealthBadge';

interface AgentCardProps {
  agent: RegisteredAgent;
  selected?: boolean;
  onSelect: (agent: RegisteredAgent) => void;
}

export function AgentCard({ agent, selected = false, onSelect }: AgentCardProps) {
  const visibleSkills = agent.card.skills?.slice(0, 4) ?? [];
  const transport = agent.card.transport ?? 'http';

  return (
    <button
      type="button"
      onClick={() => onSelect(agent)}
      className={`glass-panel group rounded-[30px] border p-5 text-left transition duration-200 ${
        selected
          ? 'border-cyan-300/60 shadow-[0_30px_90px_rgba(34,211,238,0.18)]'
          : 'border-white/10 hover:-translate-y-1 hover:border-cyan-300/35'
      }`}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex items-center gap-2 text-cyan-200">
            <Bot size={18} />
            <h3 className="mesh-display truncate text-lg font-semibold">{agent.card.name}</h3>
          </div>
          <p className="mt-1 truncate text-xs uppercase tracking-[0.28em] text-slate-400">
            {transport} transport
          </p>
        </div>
        <HealthBadge status={agent.status} />
      </div>

      <p className="mt-4 min-h-[3.5rem] text-sm leading-6 text-slate-200/85">
        {agent.card.description}
      </p>

      <div className="mt-4 flex flex-wrap gap-2">
        {visibleSkills.map((skill) => (
          <span
            key={skill.id}
            className="rounded-full border border-cyan-300/20 bg-cyan-300/10 px-3 py-1 text-xs font-medium text-cyan-100"
          >
            {skill.name}
          </span>
        ))}
        {(agent.card.skills?.length ?? 0) > visibleSkills.length ? (
          <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-medium text-slate-300">
            +{(agent.card.skills?.length ?? 0) - visibleSkills.length}
          </span>
        ) : null}
      </div>

      <div className="mt-5 flex items-center gap-3 border-t border-white/10 pt-4 text-xs text-slate-300">
        <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 uppercase tracking-[0.24em]">
          <Layers3 size={14} />v{agent.card.version}
        </span>
        {agent.card.capabilities?.mcpCompatible ? (
          <span className="rounded-full border border-violet-300/20 bg-violet-300/10 px-3 py-1 uppercase tracking-[0.24em] text-violet-100">
            MCP
          </span>
        ) : null}
        <span className="ml-auto inline-flex items-center gap-1 text-cyan-100">
          Inspect
          <ArrowUpRight
            size={14}
            className="transition group-hover:translate-x-0.5 group-hover:-translate-y-0.5"
          />
        </span>
      </div>
    </button>
  );
}
