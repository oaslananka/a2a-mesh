import type { AgentStatus } from '../api/registry';

const statusStyles: Record<AgentStatus, { label: string; classes: string; dot: string }> = {
  healthy: {
    label: 'Healthy',
    classes: 'border-emerald-400/25 bg-emerald-400/10 text-emerald-200',
    dot: 'bg-emerald-400 shadow-[0_0_14px_rgba(74,222,128,0.75)]',
  },
  unhealthy: {
    label: 'Unhealthy',
    classes: 'border-rose-400/25 bg-rose-400/10 text-rose-200',
    dot: 'bg-rose-400 shadow-[0_0_14px_rgba(251,113,133,0.75)]',
  },
  unknown: {
    label: 'Unknown',
    classes: 'border-slate-400/20 bg-slate-400/10 text-slate-200',
    dot: 'bg-slate-300',
  },
};

export function HealthBadge({ status }: { status: AgentStatus }) {
  const display = statusStyles[status] ?? statusStyles.unknown;

  return (
    <span
      className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.22em] ${display.classes}`}
    >
      <span className={`h-2.5 w-2.5 rounded-full ${display.dot}`} />
      {display.label}
    </span>
  );
}
