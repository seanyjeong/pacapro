import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

import { evaluateHotfixScope } from './hotfix-scope.mjs';

const CURRENT_HOTFIX_FILES = [
  'backend/__tests__/routes/notifications/test/sens.test.js',
  'backend/__tests__/routes/notifications/test/solapi.test.js',
  'backend/__tests__/routes/notifications/test/unpaid.test.js',
  'backend/__tests__/routes/notifications/test/utils.test.js',
  'backend/routes/notifications/test/_utils.js',
  'backend/routes/notifications/test/sens.js',
  'backend/routes/notifications/test/solapi.js',
  'scripts/release/hotfix-preflight.mjs',
  'scripts/release/hotfix-scope.mjs',
  'scripts/release/hotfix-scope.test.mjs',
  'scripts/smoke/notifications-smoke.mjs',
  'src/app/settings/notifications/_hooks/notification-error-utils.ts',
  'DEPLOYMENT.md',
];

function lineCounts(files, defaultCount = 100) {
  return Object.fromEntries(files.map((file) => [file, defaultCount]));
}

test('allows a scoped PACA notification hotfix with complete checks', () => {
  const result = evaluateHotfixScope(
    CURRENT_HOTFIX_FILES,
    lineCounts(CURRENT_HOTFIX_FILES),
  );

  assert.equal(result.ready, true);
  assert.equal(result.score, 100);
  assert.deepEqual(result.blockers, []);
});

test('rejects production control, auth, scheduler, database, and env paths', () => {
  const sensitiveFiles = [
    '.env.production',
    'backend/config/env.js',
    'backend/middleware/auth.js',
    'backend/routes/auth-me.js',
    'backend/routes/notifications/send/_utils.js',
    'backend/scheduler/notificationScheduler.js',
    'backend/utils/env-validator.js',
    'backend/migrations/20260718_change_students.sql',
    'src/lib/api/base-url.ts',
    'next.config.js',
    'vercel.json',
  ];
  const files = [...CURRENT_HOTFIX_FILES, ...sensitiveFiles];
  const result = evaluateHotfixScope(files, lineCounts(files));

  assert.equal(result.ready, false);
  assert.equal(result.score < 95, true);
  assert.deepEqual(result.sensitiveFiles, sensitiveFiles);
});

test('rejects files outside the reviewed hotfix surface', () => {
  const files = [...CURRENT_HOTFIX_FILES, 'random-operator-script.sh'];
  const result = evaluateHotfixScope(files, lineCounts(files));

  assert.equal(result.ready, false);
  assert.deepEqual(result.disallowedFiles, ['random-operator-script.sh']);
});

test('requires at least one frontend or backend runtime change', () => {
  const files = [
    'backend/__tests__/routes/notifications/test/utils.test.js',
    'scripts/release/hotfix-scope.test.mjs',
    'DEPLOYMENT.md',
  ];
  const result = evaluateHotfixScope(files, lineCounts(files));

  assert.equal(result.ready, false);
  assert.equal(result.blockers.includes('runtime_change'), true);
});

test('rejects changed runtime files over 500 lines', () => {
  const counts = lineCounts(CURRENT_HOTFIX_FILES);
  counts['backend/routes/notifications/test/_utils.js'] = 501;
  const result = evaluateHotfixScope(CURRENT_HOTFIX_FILES, counts);

  assert.equal(result.ready, false);
  assert.deepEqual(result.oversizedFiles, [
    'backend/routes/notifications/test/_utils.js',
  ]);
});

test('deployment runbook keeps scoped hotfix and full cutover gates separate', () => {
  const runbook = readFileSync('DEPLOYMENT.md', 'utf8');

  assert.match(runbook, /## Scoped Hotfix Gate/);
  assert.match(runbook, /node scripts\/release\/hotfix-preflight\.mjs/);
  assert.match(runbook, /## Full Cutover Gate/);
  assert.match(runbook, /ET_ALLOW_PRODUCTION=1/);
});
