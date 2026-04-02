import { stat } from 'node:fs/promises';

const BUNDLE_LIMITS = [
  { path: 'packages/core/dist/index.mjs', maxSizeKb: 50 },
  { path: 'packages/client/dist/index.mjs', maxSizeKb: 20 },
  { path: 'packages/adapters/dist/index.mjs', maxSizeKb: 30 },
];

let hasFailure = false;

for (const bundle of BUNDLE_LIMITS) {
  const info = await stat(bundle.path);
  const sizeKb = info.size / 1024;

  if (sizeKb > bundle.maxSizeKb) {
    hasFailure = true;
    console.error(
      `Bundle size check failed for ${bundle.path}: ${sizeKb.toFixed(1)} kB > ${bundle.maxSizeKb} kB`,
    );
  } else {
    console.log(
      `Bundle size OK for ${bundle.path}: ${sizeKb.toFixed(1)} kB <= ${bundle.maxSizeKb} kB`,
    );
  }
}

if (hasFailure) {
  process.exitCode = 1;
}
