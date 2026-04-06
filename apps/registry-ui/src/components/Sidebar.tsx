import { Activity, Bot, RefreshCw, Search, Share2 } from 'lucide-react';

export type ViewMode = 'overview' | 'topology' | 'stream';

interface SidebarProps {
  activeView: ViewMode;
  onChangeView: (view: ViewMode) => void;
  totalAgents: number;
  healthyAgents: number;
  unhealthyAgents: number;
  taskStreamConnected: boolean;
  search: string;
  onSearchChange: (value: string) => void;
  onRefresh: () => void;
}

const navItems: Array<{ id: ViewMode; label: string; icon: typeof Bot }> = [
  { id: 'overview', label: 'Fleet Overview', icon: Bot },
  { id: 'topology', label: 'Live Topology', icon: Share2 },
  { id: 'stream', label: 'Task Stream', icon: Activity },
];

export function Sidebar({
  activeView,
  onChangeView,
  totalAgents,
  healthyAgents,
  unhealthyAgents,
  taskStreamConnected,
  search,
  onSearchChange,
  onRefresh,
}: SidebarProps) {
  return (
    <aside className="glass-panel sticky top-6 rounded-[32px] border border-white/10 p-5 shadow-[0_30px_80px_rgba(2,8,23,0.35)]">
      <div className="rounded-[28px] border border-cyan-300/20 bg-cyan-300/10 p-5">
        <p className="text-[11px] uppercase tracking-[0.34em] text-cyan-100">Control Plane</p>
        <h1 className="mesh-display mt-3 text-3xl font-bold tracking-tight">a2a-mesh</h1>
        <p className="mt-3 text-sm leading-6 text-slate-200/85">
          Live registry intelligence for multi-agent systems. Discovery, health, topology, and
          active task flow in one surface.
        </p>
      </div>

      <label className="mt-5 block">
        <span className="mb-2 block text-[11px] uppercase tracking-[0.28em] text-slate-400">
          Filter agents
        </span>
        <span className="flex items-center gap-3 rounded-2xl border border-white/10 bg-slate-950/45 px-4 py-3">
          <Search size={16} className="text-cyan-200" />
          <input
            value={search}
            onChange={(event) => onSearchChange(event.target.value)}
            placeholder="Search by name, skill, tag..."
            className="w-full bg-transparent text-sm text-slate-100 outline-none placeholder:text-slate-500"
          />
        </span>
      </label>

      <div className="mt-5 space-y-2">
        {navItems.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            type="button"
            onClick={() => onChangeView(id)}
            className={`flex w-full items-center gap-3 rounded-2xl border px-4 py-3 text-left text-sm font-medium transition ${
              activeView === id
                ? 'border-cyan-300/40 bg-cyan-300/14 text-cyan-50'
                : 'border-white/8 bg-white/4 text-slate-300 hover:border-cyan-300/20 hover:text-cyan-50'
            }`}
          >
            <Icon size={18} />
            {label}
          </button>
        ))}
      </div>

      <div className="mt-6 grid gap-3">
        <div className="rounded-[24px] border border-white/10 bg-white/5 px-4 py-4">
          <p className="text-[11px] uppercase tracking-[0.28em] text-slate-400">Fleet</p>
          <p className="mt-2 mesh-display text-3xl font-bold text-slate-50">{totalAgents}</p>
          <p className="mt-2 text-sm text-slate-300">
            {healthyAgents} healthy · {unhealthyAgents} degraded
          </p>
        </div>

        <div className="rounded-[24px] border border-white/10 bg-white/5 px-4 py-4">
          <p className="text-[11px] uppercase tracking-[0.28em] text-slate-400">Task stream</p>
          <p className="mt-2 flex items-center gap-2 text-sm text-slate-200">
            <span
              className={`h-2.5 w-2.5 rounded-full ${
                taskStreamConnected
                  ? 'bg-emerald-400 shadow-[0_0_14px_rgba(74,222,128,0.75)]'
                  : 'bg-amber-300'
              }`}
            />
            {taskStreamConnected ? 'Live updates connected' : 'Polling / reconnecting'}
          </p>
        </div>
      </div>

      <button
        type="button"
        onClick={onRefresh}
        className="mt-6 flex w-full items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/6 px-4 py-3 text-sm font-medium text-slate-100 transition hover:border-cyan-300/30 hover:text-cyan-100"
      >
        <RefreshCw size={16} />
        Refresh control plane
      </button>
    </aside>
  );
}
