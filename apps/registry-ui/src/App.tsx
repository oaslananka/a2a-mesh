import { startTransition, useDeferredValue, useEffect, useState } from 'react';
import { AlertTriangle, ArrowUpRight, Cpu, RefreshCw, SignalHigh } from 'lucide-react';
import { fetchMetrics, type RegisteredAgent, type RegistryMetrics } from './api/registry';
import { AgentGrid } from './components/AgentGrid';
import { HealthBadge } from './components/HealthBadge';
import { MetricBar } from './components/MetricBar';
import { Sidebar, type ViewMode } from './components/Sidebar';
import { TaskStream } from './components/TaskStream';
import { TopologyGraph } from './components/TopologyGraph';
import { useAgents } from './hooks/useAgents';
import { useTaskStream } from './hooks/useTaskStream';

const emptyMetrics: RegistryMetrics = {
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

function matchesQuery(agent: RegisteredAgent, query: string): boolean {
  const haystack = [
    agent.card.name,
    agent.card.description,
    ...(agent.card.skills ?? []).map((skill) => `${skill.name} ${(skill.tags ?? []).join(' ')}`),
    ...(agent.tags ?? []),
  ]
    .join(' ')
    .toLowerCase();

  return haystack.includes(query.trim().toLowerCase());
}

export default function App() {
  const { agents, loading, error, refresh } = useAgents();
  const {
    tasks,
    loading: tasksLoading,
    error: tasksError,
    connected: taskStreamConnected,
    refresh: refreshTasks,
  } = useTaskStream();
  const [metrics, setMetrics] = useState<RegistryMetrics>(emptyMetrics);
  const [view, setView] = useState<ViewMode>('overview');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'healthy' | 'unhealthy'>('all');
  const [selectedAgent, setSelectedAgent] = useState<RegisteredAgent | null>(null);
  const deferredSearch = useDeferredValue(search);

  useEffect(() => {
    async function loadMetrics() {
      const nextMetrics = await fetchMetrics();
      startTransition(() => {
        setMetrics(nextMetrics);
      });
    }

    void loadMetrics();
    const interval = window.setInterval(() => {
      void loadMetrics();
    }, 5_000);

    return () => window.clearInterval(interval);
  }, []);

  useEffect(() => {
    if (!selectedAgent && agents.length > 0) {
      setSelectedAgent(agents[0] ?? null);
      return;
    }

    if (selectedAgent) {
      const refreshedSelectedAgent = agents.find((agent) => agent.id === selectedAgent.id) ?? null;
      setSelectedAgent(refreshedSelectedAgent);
    }
  }, [agents, selectedAgent]);

  const filteredAgents = agents.filter((agent) => {
    const matchesStatus = statusFilter === 'all' ? true : agent.status === statusFilter;
    return matchesStatus && matchesQuery(agent, deferredSearch);
  });

  const healthyAgents =
    metrics.healthyAgents || agents.filter((agent) => agent.status === 'healthy').length;
  const unhealthyAgents =
    metrics.unhealthyAgents || agents.filter((agent) => agent.status === 'unhealthy').length;
  const selectedAgentTasks = selectedAgent
    ? tasks.filter((task) => task.agentId === selectedAgent.id)
    : tasks;

  const handleRefresh = () => {
    void refresh();
    void refreshTasks();
  };

  return (
    <div className="min-h-screen px-4 py-6 lg:px-6">
      <div className="mx-auto grid max-w-[1500px] gap-6 lg:grid-cols-[280px_minmax(0,1fr)]">
        <Sidebar
          activeView={view}
          onChangeView={setView}
          totalAgents={metrics.agentCount || agents.length}
          healthyAgents={healthyAgents}
          unhealthyAgents={unhealthyAgents}
          taskStreamConnected={taskStreamConnected}
          search={search}
          onSearchChange={setSearch}
          onRefresh={handleRefresh}
        />

        <main className="space-y-6">
          <section className="glass-panel relative overflow-hidden rounded-[36px] border border-white/10 p-6 shadow-[0_30px_90px_rgba(2,8,23,0.35)]">
            <div className="absolute inset-y-0 right-0 w-80 bg-[radial-gradient(circle_at_top_right,rgba(34,211,238,0.18),transparent_62%)]" />
            <div className="relative flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
              <div>
                <p className="text-[11px] uppercase tracking-[0.34em] text-cyan-100">
                  Production runtime
                </p>
                <h2 className="mesh-display mt-3 max-w-3xl text-4xl font-bold leading-tight text-white sm:text-5xl">
                  The control plane your A2A network deserved from day one.
                </h2>
                <p className="mt-4 max-w-3xl text-base leading-7 text-slate-200/85">
                  Watch discovery, health, and task execution in one place. This UI is backed by
                  live registry events and aggregated task updates instead of static mock data.
                </p>
              </div>

              <div className="grid gap-3 sm:grid-cols-2 xl:w-[420px]">
                <div className="rounded-[28px] border border-white/10 bg-white/6 px-5 py-5">
                  <p className="text-[11px] uppercase tracking-[0.28em] text-slate-400">
                    Registry status
                  </p>
                  <p className="mt-2 flex items-center gap-2 text-sm text-slate-100">
                    <SignalHigh size={16} className="text-cyan-200" />
                    {taskStreamConnected ? 'Live signal' : 'Degraded signal'}
                  </p>
                  <p className="mt-2 text-xs text-slate-400">
                    JSON metrics + SSE + task polling summary enabled
                  </p>
                </div>
                <div className="rounded-[28px] border border-white/10 bg-white/6 px-5 py-5">
                  <p className="text-[11px] uppercase tracking-[0.28em] text-slate-400">
                    Fast actions
                  </p>
                  <button
                    type="button"
                    onClick={handleRefresh}
                    className="mt-3 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/6 px-4 py-2 text-sm text-slate-100 transition hover:border-cyan-300/30 hover:text-cyan-100"
                  >
                    <RefreshCw size={16} />
                    Refresh now
                  </button>
                </div>
              </div>
            </div>
          </section>

          <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <MetricBar
              label="Total agents"
              value={metrics.agentCount || agents.length}
              accent="cyan"
              detail="Discovered in the registry catalog"
            />
            <MetricBar
              label="Healthy"
              value={healthyAgents}
              accent="emerald"
              detail="Passing health checks"
            />
            <MetricBar
              label="Unhealthy"
              value={unhealthyAgents}
              accent="rose"
              detail="Need operator attention"
            />
            <MetricBar
              label="Searches"
              value={metrics.searches}
              accent="blue"
              detail={`${metrics.heartbeats} heartbeats tracked`}
            />
          </section>

          <section className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
            <div className="space-y-6">
              <div className="glass-panel rounded-[34px] border border-white/10 p-5">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                  <div>
                    <p className="text-[11px] uppercase tracking-[0.3em] text-slate-400">
                      Fleet filter
                    </p>
                    <h3 className="mesh-display mt-2 text-2xl font-bold text-white">
                      Slice the mesh by health
                    </h3>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    {(['all', 'healthy', 'unhealthy'] as const).map((filter) => (
                      <button
                        key={filter}
                        type="button"
                        onClick={() => setStatusFilter(filter)}
                        className={`rounded-full border px-4 py-2 text-sm font-medium transition ${
                          statusFilter === filter
                            ? 'border-cyan-300/40 bg-cyan-300/14 text-cyan-50'
                            : 'border-white/10 bg-white/5 text-slate-200 hover:border-cyan-300/20 hover:text-cyan-100'
                        }`}
                      >
                        {filter[0].toUpperCase() + filter.slice(1)}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {view === 'overview' ? (
                <AgentGrid
                  agents={filteredAgents}
                  loading={loading}
                  error={error}
                  selectedAgentId={selectedAgent?.id ?? null}
                  onSelect={setSelectedAgent}
                />
              ) : null}

              {view === 'topology' ? (
                <TopologyGraph
                  agents={filteredAgents}
                  selectedAgentId={selectedAgent?.id ?? null}
                  onSelect={setSelectedAgent}
                />
              ) : null}

              {view === 'stream' ? (
                <TaskStream
                  tasks={tasks}
                  loading={tasksLoading}
                  error={tasksError}
                  connected={taskStreamConnected}
                  selectedAgentId={selectedAgent?.id ?? null}
                />
              ) : null}
            </div>

            <div className="space-y-6">
              <section className="glass-panel rounded-[34px] border border-white/10 p-6 shadow-[0_30px_80px_rgba(2,8,23,0.35)]">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-[11px] uppercase tracking-[0.32em] text-cyan-100">
                      Inspector
                    </p>
                    <h3 className="mesh-display mt-2 text-3xl font-bold text-white">
                      {selectedAgent?.card.name ?? 'Select an agent'}
                    </h3>
                  </div>
                  {selectedAgent ? <HealthBadge status={selectedAgent.status} /> : null}
                </div>

                {selectedAgent ? (
                  <>
                    <p className="mt-4 text-sm leading-7 text-slate-200/85">
                      {selectedAgent.card.description}
                    </p>

                    <div className="mt-5 grid gap-3 sm:grid-cols-2">
                      <div className="rounded-[24px] border border-white/10 bg-white/5 px-4 py-4">
                        <p className="text-[11px] uppercase tracking-[0.28em] text-slate-400">
                          URL
                        </p>
                        <p className="mt-2 break-all text-sm text-slate-100">{selectedAgent.url}</p>
                      </div>
                      <div className="rounded-[24px] border border-white/10 bg-white/5 px-4 py-4">
                        <p className="text-[11px] uppercase tracking-[0.28em] text-slate-400">
                          Capabilities
                        </p>
                        <div className="mt-2 flex flex-wrap gap-2">
                          {selectedAgent.card.capabilities?.streaming ? (
                            <span className="rounded-full border border-cyan-300/20 bg-cyan-300/10 px-3 py-1 text-xs text-cyan-100">
                              streaming
                            </span>
                          ) : null}
                          {selectedAgent.card.capabilities?.pushNotifications ? (
                            <span className="rounded-full border border-blue-300/20 bg-blue-300/10 px-3 py-1 text-xs text-blue-100">
                              push
                            </span>
                          ) : null}
                          {selectedAgent.card.capabilities?.mcpCompatible ? (
                            <span className="rounded-full border border-violet-300/20 bg-violet-300/10 px-3 py-1 text-xs text-violet-100">
                              MCP
                            </span>
                          ) : null}
                        </div>
                      </div>
                    </div>

                    <div className="mt-5 rounded-[26px] border border-white/10 bg-white/5 px-4 py-4">
                      <div className="flex items-center justify-between gap-4">
                        <div>
                          <p className="text-[11px] uppercase tracking-[0.28em] text-slate-400">
                            Recent task activity
                          </p>
                          <p className="mt-2 text-sm text-slate-100">
                            {selectedAgentTasks.length} events in the recent control-plane window
                          </p>
                        </div>
                        <Cpu size={18} className="text-cyan-200" />
                      </div>
                    </div>

                    <div className="mt-5 flex flex-wrap gap-2">
                      {(selectedAgent.card.skills ?? []).map((skill) => (
                        <span
                          key={skill.id}
                          className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-slate-100"
                        >
                          {skill.name}
                        </span>
                      ))}
                    </div>
                  </>
                ) : (
                  <div className="mt-6 rounded-[28px] border border-dashed border-white/15 px-5 py-12 text-center text-slate-300">
                    Pick an agent from the grid or topology graph to inspect it here.
                  </div>
                )}
              </section>

              {view !== 'stream' ? (
                <TaskStream
                  tasks={tasks}
                  loading={tasksLoading}
                  error={tasksError}
                  connected={taskStreamConnected}
                  selectedAgentId={selectedAgent?.id ?? null}
                />
              ) : null}

              {error ? (
                <section className="glass-panel rounded-[30px] border border-rose-300/25 p-5 text-rose-100">
                  <div className="flex items-center gap-3">
                    <AlertTriangle size={18} />
                    Registry connectivity warning
                  </div>
                  <p className="mt-3 text-sm leading-6 text-rose-100/85">{error}</p>
                </section>
              ) : null}

              <section className="glass-panel rounded-[30px] border border-white/10 p-5">
                <p className="text-[11px] uppercase tracking-[0.28em] text-slate-400">
                  Registry summary
                </p>
                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-4">
                    <p className="text-sm text-slate-300">Registrations</p>
                    <p className="mt-2 mesh-display text-3xl font-bold text-white">
                      {metrics.registrations}
                    </p>
                  </div>
                  <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-4">
                    <p className="text-sm text-slate-300">Active tenants</p>
                    <p className="mt-2 mesh-display text-3xl font-bold text-white">
                      {metrics.activeTenants}
                    </p>
                  </div>
                </div>
                <a
                  href="http://localhost:3099/agents"
                  target="_blank"
                  rel="noreferrer"
                  className="mt-4 inline-flex items-center gap-2 text-sm text-cyan-100 hover:text-cyan-50"
                >
                  Open raw registry API
                  <ArrowUpRight size={16} />
                </a>
              </section>
            </div>
          </section>
        </main>
      </div>
    </div>
  );
}
