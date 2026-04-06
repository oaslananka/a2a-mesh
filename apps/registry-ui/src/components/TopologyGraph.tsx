import { useId } from 'react';
import type { RegisteredAgent } from '../api/registry';

interface TopologyGraphProps {
  agents: RegisteredAgent[];
  selectedAgentId: string | null;
  onSelect: (agent: RegisteredAgent) => void;
}

export function TopologyGraph({ agents, selectedAgentId, onSelect }: TopologyGraphProps) {
  const gradientId = useId();
  const centerX = 400;
  const centerY = 280;
  const radius = 180;

  const positionedAgents = agents.map((agent, index) => {
    const angle = (Math.PI * 2 * index) / Math.max(agents.length, 1) - Math.PI / 2;
    return {
      agent,
      x: centerX + Math.cos(angle) * radius,
      y: centerY + Math.sin(angle) * radius,
    };
  });

  return (
    <div className="glass-panel rounded-[34px] border border-white/10 p-6 shadow-[0_30px_80px_rgba(2,8,23,0.35)]">
      <div className="mb-5 flex items-center justify-between gap-4">
        <div>
          <p className="text-[11px] uppercase tracking-[0.32em] text-cyan-100">Topology</p>
          <h2 className="mesh-display mt-2 text-3xl font-bold">Live agent mesh</h2>
        </div>
        <p className="max-w-xs text-right text-sm leading-6 text-slate-300">
          Registry at the center, agents orbiting around it. Select any node to sync the inspector
          and stream view.
        </p>
      </div>

      <svg viewBox="0 0 800 560" className="w-full overflow-visible">
        <defs>
          <linearGradient id={gradientId} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="rgba(34,211,238,0.9)" />
            <stop offset="100%" stopColor="rgba(59,130,246,0.45)" />
          </linearGradient>
        </defs>

        <circle cx={centerX} cy={centerY} r="130" fill="rgba(34,211,238,0.06)" />
        <circle cx={centerX} cy={centerY} r="80" fill="rgba(59,130,246,0.12)" />
        <circle cx={centerX} cy={centerY} r="42" fill="rgba(59,130,246,0.55)" />
        <text
          x={centerX}
          y={centerY - 8}
          textAnchor="middle"
          className="mesh-display fill-white text-[18px] font-bold"
        >
          Registry
        </text>
        <text
          x={centerX}
          y={centerY + 18}
          textAnchor="middle"
          className="fill-cyan-100 text-[12px] uppercase tracking-[0.28em]"
        >
          Control plane
        </text>

        {positionedAgents.map(({ agent, x, y }, index) => {
          const next = positionedAgents[(index + 1) % Math.max(positionedAgents.length, 1)];
          return (
            <g key={`${agent.id}-links`}>
              <line
                x1={centerX}
                y1={centerY}
                x2={x}
                y2={y}
                stroke={`url(#${gradientId})`}
                strokeOpacity="0.45"
                strokeWidth={selectedAgentId === agent.id ? '2.6' : '1.4'}
              />
              {next ? (
                <line
                  x1={x}
                  y1={y}
                  x2={next.x}
                  y2={next.y}
                  stroke="rgba(148,163,184,0.16)"
                  strokeWidth="1"
                />
              ) : null}
            </g>
          );
        })}

        {positionedAgents.map(({ agent, x, y }) => {
          const isSelected = selectedAgentId === agent.id;
          const fill =
            agent.status === 'healthy'
              ? 'rgba(52,211,153,0.95)'
              : agent.status === 'unhealthy'
                ? 'rgba(251,113,133,0.95)'
                : 'rgba(226,232,240,0.75)';
          const ring =
            agent.status === 'healthy'
              ? 'rgba(52,211,153,0.22)'
              : agent.status === 'unhealthy'
                ? 'rgba(251,113,133,0.22)'
                : 'rgba(148,163,184,0.18)';

          return (
            <g
              key={agent.id}
              className="cursor-pointer"
              onClick={() => onSelect(agent)}
              role="button"
              tabIndex={0}
              onKeyDown={(event) => {
                if (event.key === 'Enter' || event.key === ' ') {
                  event.preventDefault();
                  onSelect(agent);
                }
              }}
            >
              <circle cx={x} cy={y} r={isSelected ? 42 : 36} fill={ring} />
              <circle cx={x} cy={y} r={isSelected ? 28 : 24} fill={fill} />
              <text
                x={x}
                y={y - 52}
                textAnchor="middle"
                className="mesh-display fill-white text-[15px] font-semibold"
              >
                {agent.card.name}
              </text>
              <text
                x={x}
                y={y + 56}
                textAnchor="middle"
                className="fill-slate-300 text-[11px] uppercase tracking-[0.24em]"
              >
                {agent.card.transport ?? 'http'}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}
