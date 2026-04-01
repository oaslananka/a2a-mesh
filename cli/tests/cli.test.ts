import { execFile } from 'node:child_process';
import { mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { promisify } from 'node:util';
import { describe, expect, it } from 'vitest';

const execFileAsync = promisify(execFile);
const tsxPath = resolve(process.cwd(), 'node_modules', '.bin', 'tsx');
const cliEntry = resolve(process.cwd(), 'cli', 'src', 'index.ts');

describe('a2a CLI', () => {
  it('prints help output', async () => {
    const { stdout } = await execFileAsync(tsxPath, [cliEntry, '--help'], {
      cwd: process.cwd(),
    });

    expect(stdout).toContain('A2A Mesh developer CLI');
    expect(stdout).toContain('task');
    expect(stdout).toContain('registry');
  });

  it('validates an agent card and emits JSON', async () => {
    const tempDir = await mkdtemp(join(tmpdir(), 'a2a-cli-validate-'));
    const cardPath = join(tempDir, 'agent-card.json');
    await writeFile(
      cardPath,
      JSON.stringify({
        protocolVersion: '0.3',
        name: 'Legacy Agent',
        description: 'desc',
        url: 'http://localhost:3000',
        version: '1.0.0',
      }),
      'utf8',
    );

    const { stdout } = await execFileAsync(tsxPath, [cliEntry, '--json', 'validate', cardPath], {
      cwd: process.cwd(),
    });

    const payload = JSON.parse(stdout);
    expect(payload.protocolVersion).toBe('1.0');
    expect(payload.name).toBe('Legacy Agent');
  }, 15000);

  it('scaffolds a new agent project', async () => {
    const tempDir = await mkdtemp(join(tmpdir(), 'a2a-cli-scaffold-'));

    const { stdout } = await execFileAsync(tsxPath, [cliEntry, 'scaffold', 'sample-agent'], {
      cwd: tempDir,
    });

    expect(stdout).toContain('Scaffolded agent sample-agent successfully');

    const packageJson = await readFile(join(tempDir, 'sample-agent', 'package.json'), 'utf8');
    const agentFile = await readFile(join(tempDir, 'sample-agent', 'src', 'agent.ts'), 'utf8');
    const indexFile = await readFile(join(tempDir, 'sample-agent', 'src', 'index.ts'), 'utf8');
    expect(packageJson).toContain('"a2a-mesh"');
    expect(agentFile).toContain('BaseAdapter');
    expect(indexFile).toContain("import { createAgent } from './agent.js';");
  }, 15000);
});
