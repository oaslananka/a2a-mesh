#!/usr/bin/env node

import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);

function writeError(message: string): void {
  process.stderr.write(`${message}\n`);
}

function run(): number {
  const cliEntry = require.resolve('a2a-mesh-cli');
  const args = process.argv.slice(2);

  const result = spawnSync(process.execPath, [cliEntry, 'scaffold', ...args], {
    stdio: 'inherit',
    env: process.env,
  });

  if (typeof result.status === 'number') {
    return result.status;
  }

  if (result.error) {
    writeError(result.error.message);
  }

  return 1;
}

process.exitCode = run();
