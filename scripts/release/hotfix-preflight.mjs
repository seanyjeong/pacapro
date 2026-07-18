import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

import { evaluateHotfixScope } from './hotfix-scope.mjs';

const IGNORED_PREFIXES = ['.next/', 'graphify-out/'];

function gitLines(args) {
  const output = execFileSync('git', args, { encoding: 'utf8' });
  return output.split(/\r?\n/).filter(Boolean);
}

function parseBase(argv) {
  const index = argv.indexOf('--base');
  if (index === -1) return 'HEAD';
  if (!argv[index + 1]) throw new Error('--base requires a git ref');
  return argv[index + 1];
}

function changedFiles(base) {
  const tracked = gitLines([
    'diff',
    '--name-only',
    '--diff-filter=ACMR',
    base,
  ]);
  const untracked = gitLines(['ls-files', '--others', '--exclude-standard']);
  return [...new Set([...tracked, ...untracked])]
    .filter((file) => !IGNORED_PREFIXES.some((prefix) => file.startsWith(prefix)));
}

function countLines(file) {
  const text = readFileSync(file, 'utf8');
  if (!text) return 0;
  const lines = text.split(/\r?\n/);
  return text.endsWith('\n') ? lines.length - 1 : lines.length;
}

try {
  const base = parseBase(process.argv.slice(2));
  const files = changedFiles(base);
  const counts = Object.fromEntries(files.map((file) => [file, countLines(file)]));
  const result = evaluateHotfixScope(files, counts);
  console.log(JSON.stringify({ base, ...result }, null, 2));
  process.exitCode = result.ready ? 0 : 1;
} catch (error) {
  console.error(JSON.stringify({ ready: false, error: error.message }, null, 2));
  process.exitCode = 2;
}
