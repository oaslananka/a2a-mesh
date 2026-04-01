import { execFile } from 'node:child_process';
import { resolve } from 'node:path';
import { promisify } from 'node:util';
import { describe, expect, it } from 'vitest';

const execFileAsync = promisify(execFile);
const scriptPath = resolve(process.cwd(), 'scripts', 'azuredevops.py');

describe('azuredevops.py', () => {
  it('prints help output', async () => {
    const { stdout } = await execFileAsync('python3', [scriptPath, '--help'], {
      cwd: process.cwd(),
    });

    expect(stdout).toContain('Azure DevOps + GitHub integration utility.');
    expect(stdout).toContain('github-release');
    expect(stdout).toContain('sync-check');
  });

  it('returns skipped sync-check output when github credentials are absent', async () => {
    const { stdout } = await execFileAsync('python3', [scriptPath, '--json', 'sync-check'], {
      cwd: process.cwd(),
      env: {
        ...process.env,
        GITHUB_PAT: '',
        GITHUB_REPO: '',
      },
    });

    const jsonMatch = stdout.match(/\{[\s\S]*\}\s*$/);
    expect(jsonMatch?.[0]).toBeDefined();
    expect(JSON.parse(jsonMatch?.[0] as string)).toEqual({ status: 'skipped' });
  });

  it('fails health checks when required azure credentials are absent', async () => {
    await expect(
      execFileAsync('python3', [scriptPath, '--json', 'health'], {
        cwd: process.cwd(),
        env: {
          ...process.env,
          AZURE_DEVOPS_ORG: '',
          AZURE_DEVOPS_PROJECT: '',
          AZURE_DEVOPS_PAT: '',
        },
      }),
    ).rejects.toMatchObject({
      code: 1,
      stdout: '',
      stderr: expect.stringContaining('AZURE_DEVOPS_ORG'),
    });
  });
});
