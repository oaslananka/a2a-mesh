interface MetricBarProps {
  label: string;
  value: number;
  accent?: 'cyan' | 'emerald' | 'rose' | 'blue';
  detail?: string;
}

const accentMap: Record<NonNullable<MetricBarProps['accent']>, string> = {
  cyan: 'from-cyan-400/20 via-cyan-300/10 to-transparent text-cyan-100',
  emerald: 'from-emerald-400/20 via-emerald-300/10 to-transparent text-emerald-100',
  rose: 'from-rose-400/20 via-rose-300/10 to-transparent text-rose-100',
  blue: 'from-blue-400/20 via-blue-300/10 to-transparent text-blue-100',
};

export function MetricBar({ label, value, accent = 'cyan', detail }: MetricBarProps) {
  return (
    <div
      className={`glass-panel rounded-[28px] border border-white/10 bg-gradient-to-br ${accentMap[accent]} px-5 py-5 shadow-[0_24px_60px_rgba(2,8,23,0.35)]`}
    >
      <p className="text-[11px] uppercase tracking-[0.3em] text-slate-300">{label}</p>
      <p className="mesh-display mt-3 text-4xl font-bold tracking-tight">{value}</p>
      {detail ? <p className="mt-2 text-sm text-slate-300/80">{detail}</p> : null}
    </div>
  );
}
