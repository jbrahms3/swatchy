#!/usr/bin/env node
/**
 * Cross-platform launcher for the production static server. Exists only so
 * reading PORT doesn't depend on shell syntax (`${PORT:-3000}` is POSIX-only
 * and breaks under Windows' cmd.exe, which is what `npm run` uses there).
 */
const { spawnSync } = require('node:child_process');

const port = process.env.PORT || '3000';

const result = spawnSync('npx', ['serve', 'dist', '-l', port], {
  stdio: 'inherit',
  shell: true,
});

process.exit(result.status ?? 1);
