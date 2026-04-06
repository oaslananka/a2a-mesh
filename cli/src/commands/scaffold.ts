import { mkdirSync, existsSync, writeFileSync } from 'node:fs';
import { resolve, join } from 'node:path';

export type ScaffoldAdapter =
  | 'custom'
  | 'openai'
  | 'anthropic'
  | 'langchain'
  | 'pack-research-team'
  | 'pack-support-triage';
export type ScaffoldPackageManager = 'npm' | 'pnpm' | 'yarn';

export interface ScaffoldOptions {
  adapter: ScaffoldAdapter;
  auth: boolean;
  rateLimit: boolean;
  docker: boolean;
  packageManager: ScaffoldPackageManager;
}

function renderPackageJson(name: string, adapter: ScaffoldAdapter): string {
  const dependencies: Record<string, string> = {
    'a2a-mesh-adapters': '^1.0.0',
    'a2a-mesh': '^1.0.0',
  };

  if (
    adapter === 'openai' ||
    adapter === 'pack-research-team' ||
    adapter === 'pack-support-triage'
  ) {
    dependencies.openai = '^4.104.0';
  } else if (adapter === 'anthropic') {
    dependencies['@anthropic-ai/sdk'] = '^0.39.0';
  } else if (adapter === 'langchain') {
    dependencies.langchain = '^1.2.39';
  }
  if (adapter.startsWith('pack-')) {
    dependencies['a2a-mesh-registry'] = '^1.0.0';
  }

  return JSON.stringify(
    {
      name,
      version: '0.1.0',
      private: true,
      type: 'module',
      scripts: {
        dev: 'tsx src/index.ts',
        build: 'tsc -p tsconfig.json',
        start: 'node dist/index.js',
      },
      dependencies,
      devDependencies: {
        tsx: '^4.21.0',
        typescript: '^5.9.3',
      },
    },
    null,
    2,
  );
}

function renderTsconfig(): string {
  return JSON.stringify(
    {
      compilerOptions: {
        target: 'ES2022',
        module: 'NodeNext',
        moduleResolution: 'NodeNext',
        outDir: 'dist',
        rootDir: 'src',
        strict: true,
        esModuleInterop: true,
        skipLibCheck: true,
      },
      include: ['src/**/*'],
    },
    null,
    2,
  );
}

function renderRuntimeOptions(options: Pick<ScaffoldOptions, 'auth' | 'rateLimit'>): string {
  const lines: string[] = [];
  if (options.auth) {
    lines.push(`      auth: {
        securitySchemes: [{ type: 'apiKey', id: 'api-key', in: 'header', name: 'x-api-key' }],
        apiKeys: { 'api-key': process.env.A2A_API_KEY },
      },`);
  }
  if (options.rateLimit) {
    lines.push(`      rateLimit: {
        windowMs: 60_000,
        maxRequests: 100,
      },`);
  }

  if (lines.length === 0) {
    return '{}';
  }

  return `{
${lines.join('\n')}
    }`;
}

function renderCard(name: string): string {
  return `{
      protocolVersion: '1.0',
      name: '${name}',
      description: 'A2A agent scaffolded with a2a-mesh',
      url: 'http://localhost:3000',
      version: '1.0.0',
      capabilities: {
        streaming: true,
        pushNotifications: true,
        stateTransitionHistory: true,
      },
      defaultInputModes: ['text'],
      defaultOutputModes: ['text'],
      securitySchemes: [],
    }`;
}

function renderAgentSource(name: string, options: ScaffoldOptions): string {
  if (options.adapter === 'pack-research-team') {
    return `import OpenAI from 'openai';
import { OpenAIAdapter } from 'a2a-mesh-adapters';
import type { AgentCard } from 'a2a-mesh';

export function createResearcher(): OpenAIAdapter {
  return new OpenAIAdapter(
    { protocolVersion: '1.0', name: 'Researcher', description: 'Gathers data', url: 'http://localhost:3001', version: '1.0.0' },
    new OpenAI({ apiKey: process.env.OPENAI_API_KEY }),
    'gpt-5-mini'
  );
}

export function createAnalyst(): OpenAIAdapter {
  return new OpenAIAdapter(
    { protocolVersion: '1.0', name: 'Analyst', description: 'Analyzes data', url: 'http://localhost:3002', version: '1.0.0' },
    new OpenAI({ apiKey: process.env.OPENAI_API_KEY }),
    'gpt-5-mini'
  );
}

export function createWriter(): OpenAIAdapter {
  return new OpenAIAdapter(
    { protocolVersion: '1.0', name: 'Writer', description: 'Writes the report', url: 'http://localhost:3003', version: '1.0.0' },
    new OpenAI({ apiKey: process.env.OPENAI_API_KEY }),
    'gpt-5-mini'
  );
}`;
  }

  if (options.adapter === 'pack-support-triage') {
    return `import OpenAI from 'openai';
import { OpenAIAdapter } from 'a2a-mesh-adapters';
import type { AgentCard } from 'a2a-mesh';

export function createSupportAgent(): OpenAIAdapter {
  return new OpenAIAdapter(
    { protocolVersion: '1.0', name: 'Support', description: 'Customer support router', url: 'http://localhost:3001', version: '1.0.0' },
    new OpenAI({ apiKey: process.env.OPENAI_API_KEY }),
    'gpt-5-mini'
  );
}

export function createTechnicalSpecialist(): OpenAIAdapter {
  return new OpenAIAdapter(
    { protocolVersion: '1.0', name: 'Tech Specialist', description: 'Technical debugging', url: 'http://localhost:3002', version: '1.0.0' },
    new OpenAI({ apiKey: process.env.OPENAI_API_KEY }),
    'gpt-5-mini'
  );
}`;
  }
  if (options.adapter === 'openai') {
    return `import OpenAI from 'openai';
import { OpenAIAdapter } from 'a2a-mesh-adapters';
import type { AgentCard } from 'a2a-mesh';

const card: AgentCard = ${renderCard(name)};

export function createAgent(): OpenAIAdapter {
  return new OpenAIAdapter(
    card,
    new OpenAI({ apiKey: process.env.OPENAI_API_KEY }),
    'gpt-5-mini',
  );
}
`;
  }

  if (options.adapter === 'anthropic') {
    return `import Anthropic from '@anthropic-ai/sdk';
import { AnthropicAdapter } from 'a2a-mesh-adapters';
import type { AgentCard } from 'a2a-mesh';

const card: AgentCard = ${renderCard(name)};

export function createAgent(): AnthropicAdapter {
  return new AnthropicAdapter(
    card,
    new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY }),
    'claude-sonnet-4-20250514',
  );
}
`;
  }

  if (options.adapter === 'langchain') {
    return `import { LangChainAdapter } from 'a2a-mesh-adapters';
import type { AgentCard } from 'a2a-mesh';

const card: AgentCard = ${renderCard(name)};

const runnable = {
  async invoke(input: unknown) {
    return JSON.stringify(input, null, 2);
  },
};

export function createAgent(): LangChainAdapter {
  return new LangChainAdapter(card, runnable);
}
`;
  }

  return `import { BaseAdapter } from 'a2a-mesh-adapters';
import { logger, type Artifact, type Message, type Task } from 'a2a-mesh';

export class ${toPascalCase(name)}Agent extends BaseAdapter {
  constructor() {
    super(${renderCard(name)}, ${renderRuntimeOptions(options)});
  }

  async handleTask(task: Task, message: Message): Promise<Artifact[]> {
    logger.info('Handling scaffolded task', { taskId: task.id });
    const textPart = message.parts.find((part) => part.type === 'text');
    const replyText = textPart?.type === 'text'
      ? \`Hello from ${name}: \${textPart.text}\`
      : 'Hello from ${name}';

    return [
      {
        artifactId: \`artifact-\${Date.now()}\`,
        name: 'Reply',
        description: 'Scaffolded agent reply',
        parts: [{ type: 'text', text: replyText }],
        index: 0,
        lastChunk: true,
      },
    ];
  }
}

export function createAgent(): ${toPascalCase(name)}Agent {
  return new ${toPascalCase(name)}Agent();
}
`;
}

function renderIndexSource(name: string, options: ScaffoldOptions): string {
  if (options.adapter === 'pack-research-team') {
    return `import { RegistryServer } from 'a2a-mesh-registry';
import { AgentRegistryClient } from 'a2a-mesh';
import { createResearcher, createAnalyst, createWriter } from './agent.js';

const registry = new RegistryServer();
registry.start(3099);
console.log('Registry listening on 3099');

const researcher = createResearcher();
const analyst = createAnalyst();
const writer = createWriter();

researcher.start(3001);
analyst.start(3002);
writer.start(3003);

const client = new AgentRegistryClient('http://localhost:3099');
await client.register('http://localhost:3001', researcher.getAgentCard());
await client.register('http://localhost:3002', analyst.getAgentCard());
await client.register('http://localhost:3003', writer.getAgentCard());

console.log('🚀 Research Team is running and registered! View them in the A2A Registry Control Plane.');`;
  }

  if (options.adapter === 'pack-support-triage') {
    return `import { RegistryServer } from 'a2a-mesh-registry';
import { AgentRegistryClient } from 'a2a-mesh';
import { createSupportAgent, createTechnicalSpecialist } from './agent.js';

const registry = new RegistryServer();
registry.start(3099);
console.log('Registry listening on 3099');

const support = createSupportAgent();
const tech = createTechnicalSpecialist();

support.start(3001);
tech.start(3002);

const client = new AgentRegistryClient('http://localhost:3099');
await client.register('http://localhost:3001', support.getAgentCard());
await client.register('http://localhost:3002', tech.getAgentCard());

console.log('🚀 Support Triage Team is running and registered! View them in the A2A Registry Control Plane.');`;
  }

  return `import { createAgent } from './agent.js';

const agent = createAgent();
agent.start(3000);

process.stdout.write('Agent ${name} listening on port 3000\\n');
`;
}

function renderEnvExample(options: ScaffoldOptions): string {
  const lines: string[] = [];
  if (options.adapter === 'openai' || options.adapter.startsWith('pack-')) {
    lines.push('OPENAI_API_KEY=your_openai_api_key_here');
  }
  if (options.adapter === 'anthropic') {
    lines.push('ANTHROPIC_API_KEY=');
  }
  if (options.auth) {
    lines.push('A2A_API_KEY=your-secure-api-key-here');
  }

  return `${lines.join('\n')}\n`;
}

function renderDockerfile(): string {
  return `FROM node:20-alpine
WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .
RUN npm run build

EXPOSE 3000
CMD ["npm", "run", "start"]
`;
}

function renderReadme(name: string, options: ScaffoldOptions): string {
  const installCommand =
    options.packageManager === 'pnpm'
      ? 'pnpm install'
      : options.packageManager === 'yarn'
        ? 'yarn'
        : 'npm install';

  return `# ${name}

Scaffolded with \`a2a scaffold\`.

## Getting started

1. Install dependencies with \`${installCommand}\`
2. Copy \`.env.example\` to \`.env\`
3. Run \`${options.packageManager === 'npm' ? 'npm run dev' : `${options.packageManager} dev`}\`

## Selected options

- Adapter: \`${options.adapter}\`
- Authentication: \`${options.auth ? 'enabled' : 'disabled'}\`
- Rate limiting: \`${options.rateLimit ? 'enabled' : 'disabled'}\`
- Docker support: \`${options.docker ? 'included' : 'not included'}\`
`;
}

function toPascalCase(value: string): string {
  return value
    .split(/[^a-zA-Z0-9]/)
    .filter(Boolean)
    .map((part) => part[0]?.toUpperCase() + part.slice(1))
    .join('');
}

export function scaffoldAgent(name: string, options: ScaffoldOptions): void {
  const dir = resolve(process.cwd(), name);
  if (existsSync(dir)) {
    process.stderr.write(`Directory ${name} already exists.\n`);
    process.exit(1);
  }

  mkdirSync(dir, { recursive: true });
  mkdirSync(join(dir, 'src'), { recursive: true });

  writeFileSync(join(dir, 'package.json'), renderPackageJson(name, options.adapter));
  writeFileSync(join(dir, 'tsconfig.json'), renderTsconfig());
  writeFileSync(join(dir, '.env.example'), renderEnvExample(options));
  writeFileSync(join(dir, 'README.md'), renderReadme(name, options));
  writeFileSync(join(dir, 'src', 'agent.ts'), renderAgentSource(name, options));
  writeFileSync(join(dir, 'src', 'index.ts'), renderIndexSource(name, options));

  if (options.docker) {
    writeFileSync(join(dir, 'Dockerfile'), renderDockerfile());
  }

  const isPack = options.adapter.startsWith('pack-');
  const runCmd =
    options.packageManager === 'npm'
      ? 'npm install && npm run dev'
      : `${options.packageManager} install && ${options.packageManager} dev`;

  const output = [
    '\x1b[32m✨ Scaffold complete!\x1b[0m',
    '',
    `You just created: \x1b[36m${name}\x1b[0m using the \x1b[33m${options.adapter}\x1b[0m template.`,
    '',
    isPack
      ? 'This starter pack includes a local registry and multiple interconnected agents.'
      : 'Your single agent is ready to be developed.',
    '',
    '\x1b[1mNext steps:\x1b[0m',
    `  1. cd ${name}`,
    `  2. copy .env.example to .env and add any required API keys`,
    `  3. ${runCmd}`,
    '',
    isPack ? 'Open the Control Plane UI to watch them communicate in real-time!' : '',
    'Happy building! 🚀',
    '',
  ]
    .filter((line) => line !== null)
    .join('\n');

  process.stdout.write(output);
}
