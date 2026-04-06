import { expect, test } from '@playwright/test';

test('renders offline state without crashing', async ({ page }) => {
  await page.goto('/');

  await expect(page.getByText('a2a-mesh')).toBeVisible();
  await expect(page.getByText('Registry connectivity warning')).toBeVisible();
  await expect(page.getByText('Registry unavailable')).toBeVisible();
});

test('renders mocked online overview, topology, and task stream', async ({ page }) => {
  await page.route('**/api/agents', async (route) => {
    await route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify([
        {
          id: 'agent-1',
          url: 'http://localhost:3001',
          status: 'healthy',
          card: {
            name: 'Researcher Agent',
            description: 'Finds and synthesizes information.',
            version: '1.0.0',
            transport: 'http',
            capabilities: { streaming: true, mcpCompatible: true },
            skills: [
              {
                id: 'research',
                name: 'Research',
                description: 'Researches topics',
                tags: ['web'],
              },
            ],
          },
        },
        {
          id: 'agent-2',
          url: 'http://localhost:3002',
          status: 'unhealthy',
          consecutiveFailures: 2,
          card: {
            name: 'Writer Agent',
            description: 'Polishes output into a report.',
            version: '1.0.0',
            transport: 'http',
            capabilities: { streaming: true },
            skills: [
              {
                id: 'write',
                name: 'Write',
                description: 'Creates polished output',
                tags: ['text'],
              },
            ],
          },
        },
      ]),
    });
  });

  await page.route('**/api/metrics/summary', async (route) => {
    await route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({
        registrations: 12,
        searches: 8,
        heartbeats: 42,
        agentCount: 2,
        healthyAgents: 1,
        unhealthyAgents: 1,
        unknownAgents: 0,
        activeTenants: 1,
        publicAgents: 2,
      }),
    });
  });

  await page.route('**/api/tasks/recent?limit=30', async (route) => {
    await route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify([
        {
          taskId: 'task-1',
          agentId: 'agent-1',
          agentName: 'Researcher Agent',
          agentUrl: 'http://localhost:3001',
          status: 'completed',
          updatedAt: '2026-04-06T10:00:00.000Z',
          summary: 'Collected and summarized research findings.',
          historyCount: 3,
          artifactCount: 1,
          task: {
            id: 'task-1',
            status: { state: 'completed', timestamp: '2026-04-06T10:00:00.000Z' },
          },
        },
      ]),
    });
  });

  await page.addInitScript(() => {
    class MockEventSource {
      url: string;
      onmessage: ((event: MessageEvent<string>) => void) | null = null;
      onerror: ((event: Event) => void) | null = null;

      constructor(url: string) {
        this.url = url;
        window.setTimeout(() => {
          if (this.url.includes('/tasks/stream')) {
            this.onmessage?.(
              new MessageEvent('message', {
                data: JSON.stringify({
                  taskId: 'task-2',
                  agentId: 'agent-2',
                  agentName: 'Writer Agent',
                  agentUrl: 'http://localhost:3002',
                  status: 'working',
                  updatedAt: '2026-04-06T10:00:03.000Z',
                  summary: 'Drafting final report from research output.',
                  historyCount: 4,
                  artifactCount: 0,
                  task: {
                    id: 'task-2',
                    status: { state: 'working', timestamp: '2026-04-06T10:00:03.000Z' },
                  },
                }),
              }),
            );
          } else {
            this.onmessage?.(
              new MessageEvent('message', {
                data: JSON.stringify({
                  id: 'agent-1',
                  url: 'http://localhost:3001',
                  status: 'healthy',
                  card: {
                    name: 'Researcher Agent',
                    description: 'Finds and synthesizes information.',
                    version: '1.0.0',
                    transport: 'http',
                    capabilities: { streaming: true, mcpCompatible: true },
                    skills: [
                      {
                        id: 'research',
                        name: 'Research',
                        description: 'Researches topics',
                        tags: ['web'],
                      },
                    ],
                  },
                }),
              }),
            );
          }
        }, 50);
      }

      close() {}
    }

    window.EventSource = MockEventSource as unknown as typeof EventSource;
  });

  await page.goto('/');

  await expect(page.getByText('Researcher Agent')).toBeVisible();
  await expect(page.getByText('Writer Agent')).toBeVisible();

  await page.getByRole('button', { name: 'Live Topology' }).click();
  await expect(page.getByText('Live agent mesh')).toBeVisible();

  await page.getByRole('button', { name: 'Task Stream' }).click();
  await expect(page.getByText('Live execution feed')).toBeVisible();
  await expect(page.getByText('Drafting final report from research output.')).toBeVisible();
});

test('filters agents by search query', async ({ page }) => {
  await page.route('**/api/agents', async (route) => {
    await route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify([
        {
          id: 'agent-1',
          url: 'http://localhost:3001',
          status: 'healthy',
          card: {
            name: 'Researcher Agent',
            description: 'Finds facts',
            version: '1.0.0',
            transport: 'http',
            capabilities: { streaming: true },
            skills: [{ id: 'research', name: 'Research', description: 'Researches topics' }],
          },
        },
        {
          id: 'agent-2',
          url: 'http://localhost:3002',
          status: 'healthy',
          card: {
            name: 'Writer Agent',
            description: 'Writes reports',
            version: '1.0.0',
            transport: 'http',
            capabilities: { streaming: true },
            skills: [{ id: 'write', name: 'Write', description: 'Writes output' }],
          },
        },
      ]),
    });
  });

  await page.route('**/api/metrics/summary', async (route) => {
    await route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({
        registrations: 2,
        searches: 0,
        heartbeats: 0,
        agentCount: 2,
        healthyAgents: 2,
        unhealthyAgents: 0,
        unknownAgents: 0,
        activeTenants: 1,
        publicAgents: 2,
      }),
    });
  });

  await page.route('**/api/tasks/recent?limit=30', async (route) => {
    await route.fulfill({ contentType: 'application/json', body: '[]' });
  });

  await page.addInitScript(() => {
    class MockEventSource {
      onmessage: ((event: MessageEvent<string>) => void) | null = null;
      onerror: ((event: Event) => void) | null = null;
      constructor() {}
      close() {}
    }

    window.EventSource = MockEventSource as unknown as typeof EventSource;
  });

  await page.goto('/');
  await page.getByPlaceholder('Search by name, skill, tag...').fill('writer');

  await expect(page.getByText('Writer Agent')).toBeVisible();
  await expect(page.getByText('Researcher Agent')).toHaveCount(0);
});
