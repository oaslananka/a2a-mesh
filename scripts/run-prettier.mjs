import { spawnSync } from 'node:child_process';
import { relative, resolve, sep } from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const prettierBin = require.resolve('prettier/bin/prettier.cjs');

function normalizePath(filePath) {
  const relativePath = relative(process.cwd(), resolve(filePath));
  return relativePath.split(sep).join('/');
}

function isHelmTemplate(filePath) {
  return /^deployments\/helm\/[^/]+\/templates\/[^/]+\.(yml|yaml)$/.test(filePath);
}

const files = process.argv
  .slice(2)
  .map((filePath) => ({ absolute: resolve(filePath), normalized: normalizePath(filePath) }))
  .filter(({ normalized }) => !isHelmTemplate(normalized))
  .map(({ absolute }) => absolute);

if (files.length === 0) {
  process.exit(0);
}

const result = spawnSync(
  process.execPath,
  [prettierBin, '--write', '--ignore-path', '.prettierignore', '--ignore-unknown', ...files],
  { stdio: 'inherit' },
);

if (result.error) {
  throw result.error;
}

process.exit(result.status ?? 1);
