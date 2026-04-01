import { defineConfig } from 'vitepress';

export default defineConfig({
  base: '/a2a-mesh/',
  title: 'a2a-mesh',
  description: "Production-ready TypeScript runtime for Google's A2A Protocol",
  cleanUrls: true,
  lastUpdated: true,
  head: [
    ['link', { rel: 'icon', type: 'image/svg+xml', href: '/a2a-mesh/logo.svg' }],
    [
      'meta',
      {
        property: 'og:image',
        content: 'https://oaslananka.github.io/a2a-mesh/og-image.png',
      },
    ],
    [
      'meta',
      {
        property: 'og:url',
        content: 'https://oaslananka.github.io/a2a-mesh/',
      },
    ],
  ],
  themeConfig: {
    siteTitle: 'a2a-mesh',
    logo: '/logo.svg',
    nav: [
      { text: 'Guide', link: '/guide/introduction' },
      { text: 'Packages', link: '/packages/core' },
      { text: 'API Reference', link: '/api/core' },
      { text: 'GitHub', link: 'https://github.com/oaslananka/a2a-mesh' },
    ],
    sidebar: {
      '/guide/': [
        {
          text: 'Guide',
          items: [
            { text: 'Introduction', link: '/guide/introduction' },
            { text: 'Installation', link: '/guide/installation' },
            { text: 'Quick Start', link: '/guide/quick-start' },
          ],
        },
      ],
      '/packages/': [
        {
          text: 'Packages',
          items: [
            { text: 'Core', link: '/packages/core' },
            { text: 'Client', link: '/packages/client' },
            { text: 'Codex Bridge', link: '/packages/codex-bridge' },
            { text: 'Adapters', link: '/packages/adapters' },
            { text: 'Registry', link: '/packages/registry' },
            { text: 'Registry UI', link: '/packages/registry-ui' },
            { text: 'gRPC', link: '/packages/grpc' },
            { text: 'WebSocket', link: '/packages/ws' },
            { text: 'CLI', link: '/packages/cli' },
            { text: 'create-a2a-mesh', link: '/packages/create-a2a-agent' },
            { text: 'Testing', link: '/packages/testing' },
          ],
        },
      ],
      '/adapters/': [
        {
          text: 'Adapters',
          items: [
            { text: 'OpenAI', link: '/adapters/openai' },
            { text: 'Anthropic', link: '/adapters/anthropic' },
            { text: 'LangChain', link: '/adapters/langchain' },
            { text: 'Google ADK', link: '/adapters/google-adk' },
            { text: 'CrewAI', link: '/adapters/crewai' },
            { text: 'LlamaIndex', link: '/adapters/llamaindex' },
            { text: 'Custom Adapter', link: '/adapters/custom-adapter' },
          ],
        },
      ],
      '/protocol/': [
        {
          text: 'Protocol',
          items: [
            { text: 'Compliance', link: '/protocol/compliance' },
            { text: 'Agent Card', link: '/protocol/agent-card' },
            { text: 'Task Lifecycle', link: '/protocol/task-lifecycle' },
            { text: 'Extensions', link: '/protocol/extensions' },
            { text: 'Push Notifications', link: '/protocol/push-notifications' },
          ],
        },
      ],
      '/deployment/': [
        {
          text: 'Deployment',
          items: [
            { text: 'Docker', link: '/deployment/docker' },
            { text: 'Cloud Run', link: '/deployment/cloud-run' },
            { text: 'Kubernetes', link: '/deployment/kubernetes' },
            { text: 'Helm Chart', link: '/deployment/helm-chart' },
          ],
        },
      ],
      '/security/': [
        {
          text: 'Security',
          items: [
            { text: 'Authentication', link: '/security/authentication' },
            { text: 'Rate Limiting', link: '/security/rate-limiting' },
            { text: 'OIDC', link: '/security/oidc' },
          ],
        },
      ],
      '/api/': [
        {
          text: 'API Reference',
          items: [
            { text: 'Core', link: '/api/core' },
            { text: 'Client', link: '/api/client' },
          ],
        },
      ],
    },
    socialLinks: [
      { icon: 'github', link: 'https://github.com/oaslananka/a2a-mesh' },
    ],
    search: {
      provider: 'local',
    },
  },
});
