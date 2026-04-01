import { mkdtemp, mkdir, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { discoverAgent } from '../src/commands/discover.js';
import { scaffoldAgent } from '../src/commands/scaffold.js';

describe('discoverAgent', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('prints agent details when JSON mode is disabled', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(
        JSON.stringify({
          protocolVersion: '1.0',
          name: 'Writer Agent',
          description: 'Writes polished drafts',
          url: 'http://localhost:4000',
          version: '1.0.0',
          skills: [{ id: 'draft', name: 'Drafting', tags: ['writing', 'summary'] }],
        }),
        { status: 200 },
      ),
    );
    const writeSpy = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);

    const card = await discoverAgent('http://localhost:4000');

    expect(card.name).toBe('Writer Agent');
    const output = writeSpy.mock.calls.map(([chunk]) => String(chunk)).join('');
    expect(output).toContain('Discovered Agent Card for: Writer Agent v1.0.0');
    expect(output).toContain('Drafting [writing, summary]');
  });

  it('suppresses terminal output when JSON mode is enabled', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(
        JSON.stringify({
          protocolVersion: '1.0',
          name: 'Quiet Agent',
          description: 'Returns data only',
          url: 'http://localhost:4100',
          version: '1.0.0',
        }),
        { status: 200 },
      ),
    );
    const writeSpy = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);

    await discoverAgent('http://localhost:4100', { json: true });

    expect(writeSpy).not.toHaveBeenCalled();
  });
});

describe('scaffoldAgent', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('renders the custom template with auth, rate limiting and Docker support', async () => {
    const tempDir = await mkdtemp(join(tmpdir(), 'a2a-scaffold-custom-'));
    const previousCwd = process.cwd();
    process.chdir(tempDir);

    try {
      scaffoldAgent('custom-agent', {
        adapter: 'custom',
        auth: true,
        rateLimit: true,
        docker: true,
        packageManager: 'pnpm',
      });
    } finally {
      process.chdir(previousCwd);
    }

    const packageJson = await readFile(join(tempDir, 'custom-agent', 'package.json'), 'utf8');
    const readme = await readFile(join(tempDir, 'custom-agent', 'README.md'), 'utf8');
    const envExample = await readFile(join(tempDir, 'custom-agent', '.env.example'), 'utf8');
    const agentSource = await readFile(join(tempDir, 'custom-agent', 'src', 'agent.ts'), 'utf8');
    const dockerfile = await readFile(join(tempDir, 'custom-agent', 'Dockerfile'), 'utf8');

    expect(packageJson).toContain('"a2a-mesh-adapters"');
    expect(readme).toContain('pnpm install');
    expect(envExample).toContain('A2A_API_KEY=dev-secret');
    expect(agentSource).toContain("name: 'x-api-key'");
    expect(agentSource).toContain('maxRequests: 100');
    expect(dockerfile).toContain('FROM node:20-alpine');
  });

  it('renders provider-specific templates for OpenAI, Anthropic and LangChain', async () => {
    const tempDir = await mkdtemp(join(tmpdir(), 'a2a-scaffold-providers-'));
    const previousCwd = process.cwd();
    process.chdir(tempDir);

    try {
      scaffoldAgent('openai-agent', {
        adapter: 'openai',
        auth: false,
        rateLimit: false,
        docker: false,
        packageManager: 'npm',
      });
      scaffoldAgent('anthropic-agent', {
        adapter: 'anthropic',
        auth: false,
        rateLimit: false,
        docker: false,
        packageManager: 'yarn',
      });
      scaffoldAgent('langchain-agent', {
        adapter: 'langchain',
        auth: false,
        rateLimit: false,
        docker: false,
        packageManager: 'npm',
      });
    } finally {
      process.chdir(previousCwd);
    }

    const openAiPackage = await readFile(join(tempDir, 'openai-agent', 'package.json'), 'utf8');
    const openAiSource = await readFile(join(tempDir, 'openai-agent', 'src', 'agent.ts'), 'utf8');
    const anthropicPackage = await readFile(
      join(tempDir, 'anthropic-agent', 'package.json'),
      'utf8',
    );
    const anthropicSource = await readFile(
      join(tempDir, 'anthropic-agent', 'src', 'agent.ts'),
      'utf8',
    );
    const langchainPackage = await readFile(
      join(tempDir, 'langchain-agent', 'package.json'),
      'utf8',
    );
    const langchainSource = await readFile(
      join(tempDir, 'langchain-agent', 'src', 'agent.ts'),
      'utf8',
    );

    expect(openAiPackage).toContain('"openai"');
    expect(openAiSource).toContain('new OpenAI');
    expect(anthropicPackage).toContain('"@anthropic-ai/sdk"');
    expect(anthropicSource).toContain('new Anthropic');
    expect(langchainPackage).toContain('"langchain"');
    expect(langchainSource).toContain('new LangChainAdapter');
  });

  it('refuses to overwrite an existing directory', async () => {
    const tempDir = await mkdtemp(join(tmpdir(), 'a2a-scaffold-existing-'));
    const previousCwd = process.cwd();
    process.chdir(tempDir);

    try {
      await mkdir(join(tempDir, 'existing-agent'));
      const stderrSpy = vi.spyOn(process.stderr, 'write').mockImplementation(() => true);
      const exitSpy = vi.spyOn(process, 'exit').mockImplementation(((code?: number) => {
        throw new Error(`exit:${code ?? 0}`);
      }) as never);

      expect(() =>
        scaffoldAgent('existing-agent', {
          adapter: 'custom',
          auth: false,
          rateLimit: false,
          docker: false,
          packageManager: 'npm',
        }),
      ).toThrow('exit:1');
      expect(exitSpy).toHaveBeenCalledWith(1);
      expect(stderrSpy).toHaveBeenCalledWith('Directory existing-agent already exists.\n');
    } finally {
      process.chdir(previousCwd);
    }
  });
});
