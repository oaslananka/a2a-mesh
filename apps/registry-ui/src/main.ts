import * as React from 'react';
import { createRoot } from 'react-dom/client';

type AgentStatus = 'healthy' | 'unhealthy' | 'unknown';

interface AgentSkill {
  id: string;
  name: string;
  description: string;
  tags?: string[];
}

interface RegisteredAgent {
  id: string;
  url: string;
  status: AgentStatus;
  card: {
    name: string;
    description: string;
    version: string;
    skills?: AgentSkill[];
  };
}

const h = React.createElement;

function App(): React.ReactElement {
  const [registryUrl, setRegistryUrl] = React.useState('http://localhost:3099');
  const [agents, setAgents] = React.useState<RegisteredAgent[]>([]);
  const [query, setQuery] = React.useState('');
  const [selectedAgent, setSelectedAgent] = React.useState<RegisteredAgent | null>(null);
  const [darkMode, setDarkMode] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  const refresh = React.useCallback(async () => {
    try {
      const response = await fetch(`${registryUrl}/agents`);
      if (!response.ok) {
        throw new Error(`Registry request failed (${response.status})`);
      }
      setAgents((await response.json()) as RegisteredAgent[]);
      setError(null);
    } catch (refreshError) {
      setError(refreshError instanceof Error ? refreshError.message : String(refreshError));
    }
  }, [registryUrl]);

  React.useEffect(() => {
    void refresh();
    const eventSource = new EventSource(`${registryUrl}/events`);
    eventSource.addEventListener('registry_update', () => {
      void refresh();
    });
    eventSource.onerror = () => {
      eventSource.close();
      const interval = window.setInterval(() => {
        void refresh();
      }, 5000);
      return () => {
        window.clearInterval(interval);
      };
    };
    return () => {
      eventSource.close();
    };
  }, [refresh, registryUrl]);

  React.useEffect(() => {
    document.documentElement.classList.toggle('dark', darkMode);
  }, [darkMode]);

  const pageClass = darkMode
    ? 'min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-800 text-slate-100'
    : 'min-h-screen bg-gradient-to-br from-slate-100 via-cyan-50 to-white text-slate-900';
  const headerClass = darkMode
    ? 'rounded-3xl border border-slate-700 bg-slate-900/70 shadow-2xl backdrop-blur'
    : 'rounded-3xl border border-slate-200 bg-white/90 shadow-xl backdrop-blur';
  const panelClass = darkMode
    ? 'rounded-3xl border border-slate-700 bg-slate-900/80 shadow-xl'
    : 'rounded-3xl border border-slate-200 bg-white/90 shadow-lg';
  const inputClass = darkMode
    ? 'rounded-2xl border border-slate-600 bg-slate-950 px-4 py-3 text-sm text-slate-100'
    : 'rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900';
  const cardButtonClass = darkMode
    ? 'rounded-3xl border border-slate-700 bg-slate-900/80 p-5 text-left transition hover:-translate-y-1 hover:border-cyan-400 hover:shadow-2xl'
    : 'rounded-3xl border border-slate-200 bg-white p-5 text-left transition hover:-translate-y-1 hover:border-cyan-500 hover:shadow-xl';
  const codePanelClass = darkMode
    ? 'mt-4 overflow-auto rounded-2xl bg-slate-950 p-4 text-xs text-cyan-100'
    : 'mt-4 overflow-auto rounded-2xl bg-slate-100 p-4 text-xs text-slate-800';
  const bodyTextClass = darkMode ? 'text-slate-300' : 'text-slate-600';
  const subtleTextClass = darkMode ? 'text-slate-400' : 'text-slate-500';
  const versionTextClass = darkMode ? 'text-slate-500' : 'text-slate-500';
  const badgeClass = darkMode
    ? 'rounded-full border border-slate-600 px-2 py-1 text-xs text-slate-200'
    : 'rounded-full border border-slate-300 px-2 py-1 text-xs text-slate-700';
  const themeButtonClass = darkMode
    ? 'rounded-full bg-cyan-400 px-4 py-2 text-sm font-semibold text-slate-950 transition hover:bg-cyan-300'
    : 'rounded-full bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-700';

  const filteredAgents = agents.filter((agent) => {
    const haystack = [
      agent.card.name,
      agent.card.description,
      ...(agent.card.skills ?? []).map((skill) => `${skill.name} ${(skill.tags ?? []).join(' ')}`),
    ]
      .join(' ')
      .toLowerCase();
    return haystack.includes(query.toLowerCase());
  });

  return h(
    'div',
    { className: `${pageClass} p-6` },
    h(
      'div',
      { className: 'mx-auto max-w-7xl space-y-6' },
      h(
        'header',
        {
          className: `flex flex-col gap-4 p-6 md:flex-row md:items-center md:justify-between ${headerClass}`,
        },
        h(
          'div',
          null,
          h('p', { className: 'text-sm uppercase tracking-[0.3em] text-cyan-300' }, 'A2A Mesh'),
          h('h1', { className: 'mt-2 text-3xl font-semibold' }, 'Registry Dashboard'),
          h(
            'p',
            { className: `mt-2 ${bodyTextClass}` },
            'Discover agents, inspect agent cards, and monitor registry health in real time.',
          ),
        ),
        h(
          'div',
          { className: 'flex flex-col gap-3 md:items-end' },
          h('input', {
            className: `w-full md:w-80 ${inputClass}`,
            value: registryUrl,
            onChange: (event: Event) => setRegistryUrl((event.target as HTMLInputElement).value),
            placeholder: 'Registry URL',
          }),
          h(
            'button',
            {
              className: themeButtonClass,
              onClick: () => setDarkMode((value) => !value),
            },
            darkMode ? 'Light theme' : 'Dark theme',
          ),
        ),
      ),
      error
        ? h(
            'div',
            {
              className: darkMode
                ? 'rounded-2xl border border-rose-500/40 bg-rose-950/30 px-4 py-3 text-sm text-rose-100'
                : 'rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700',
            },
            `Registry error: ${error}`,
          )
        : null,
      h(
        'section',
        { className: 'grid gap-6 lg:grid-cols-[1.4fr_0.8fr]' },
        h(
          'div',
          { className: 'space-y-4' },
          h('input', {
            className: `w-full ${inputClass}`,
            value: query,
            onChange: (event: Event) => setQuery((event.target as HTMLInputElement).value),
            placeholder: 'Filter by name, skill, or tag',
          }),
          h(
            'div',
            { className: 'grid gap-4 md:grid-cols-2 xl:grid-cols-3' },
            ...(filteredAgents.length === 0
              ? [
                  h(
                    'div',
                    { className: `${panelClass} col-span-full p-6` },
                    h('h2', { className: 'text-lg font-semibold' }, 'No agents found'),
                    h(
                      'p',
                      { className: `mt-2 text-sm ${bodyTextClass}` },
                      'Start the demo services or point this dashboard at a registry that already has registered agents.',
                    ),
                  ),
                ]
              : []),
            ...filteredAgents.map((agent) =>
              h(
                'button',
                {
                  key: agent.id,
                  className: cardButtonClass,
                  onClick: () => setSelectedAgent(agent),
                },
                h(
                  'div',
                  { className: 'flex items-center justify-between' },
                  h('h2', { className: 'text-lg font-semibold' }, agent.card.name),
                  h('span', {
                    className: `inline-flex h-3 w-3 rounded-full ${
                      agent.status === 'healthy'
                        ? 'bg-emerald-400'
                        : agent.status === 'unhealthy'
                          ? 'bg-rose-400'
                          : 'bg-amber-300'
                    }`,
                  }),
                ),
                h('p', { className: `mt-3 text-sm ${bodyTextClass}` }, agent.card.description),
                h(
                  'p',
                  { className: `mt-4 text-xs uppercase tracking-[0.2em] ${versionTextClass}` },
                  `v${agent.card.version}`,
                ),
                h(
                  'div',
                  { className: 'mt-4 flex flex-wrap gap-2' },
                  ...(agent.card.skills ?? []).slice(0, 4).map((skill) =>
                    h(
                      'span',
                      {
                        key: skill.id,
                        className: badgeClass,
                      },
                      skill.name,
                    ),
                  ),
                ),
              ),
            ),
          ),
        ),
        h(
          'aside',
          { className: `${panelClass} p-5` },
          h('h2', { className: 'text-lg font-semibold' }, 'Agent Card JSON'),
          selectedAgent
            ? h('pre', { className: codePanelClass }, JSON.stringify(selectedAgent, null, 2))
            : h(
                'p',
                { className: `mt-4 text-sm ${subtleTextClass}` },
                'Select an agent card to inspect its JSON payload.',
              ),
        ),
      ),
    ),
  );
}

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error('Root element not found');
}

createRoot(rootElement).render(h(App));
