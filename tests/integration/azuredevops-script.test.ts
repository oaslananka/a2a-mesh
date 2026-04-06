import { execFile } from 'node:child_process';
import { resolve } from 'node:path';
import { promisify } from 'node:util';
import { describe, expect, it } from 'vitest';

const execFileAsync = promisify(execFile);
const scriptPath = resolve(process.cwd(), 'scripts', 'azuredevops.py');
const pythonCommand = process.platform === 'win32' ? 'py' : 'python3';
const pythonArgs = process.platform === 'win32' ? ['-3', scriptPath] : [scriptPath];

describe('azuredevops.py', () => {
  it('prints help output', async () => {
    const { stdout } = await execFileAsync(pythonCommand, [...pythonArgs, '--help'], {
      cwd: process.cwd(),
    });

    expect(stdout).toContain('Azure DevOps operations utility.');
    expect(stdout).not.toContain(`github${'-'}release`);
    expect(stdout).not.toContain(`sync${'-'}check`);
  });

  it('fails health checks when required azure credentials are absent', async () => {
    await expect(
      execFileAsync(pythonCommand, [...pythonArgs, '--json', 'health'], {
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
