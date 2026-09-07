import assert from 'node:assert/strict';
import test from 'node:test';
import { validateReleaseMetadata } from './hotfix-release-metadata.mjs';
import { evaluateHotfixScope } from './hotfix-scope.mjs';

function makeContents(change = () => {}) {
  const before = {
    'package.json': {
      name: 'paca-frontend', version: '4.0.45', lastUpdate: '2026-08-27',
      scripts: { build: 'next build' }, dependencies: { next: '15.5.19' },
    },
    'package-lock.json': {
      name: 'paca-frontend', version: '4.0.45', lockfileVersion: 3,
      packages: {
        '': { name: 'paca-frontend', version: '4.0.45', dependencies: { next: '15.5.19' } },
        'node_modules/next': { version: '15.5.19', integrity: 'frozen-integrity' },
      },
    },
    'src/constants/release.json': { version: '4.0.45', lastUpdate: '2026-08-27' },
  };
  const after = structuredClone(before);
  for (const value of Object.values(after)) value.version = '4.0.46';
  after['package-lock.json'].packages[''].version = '4.0.46';
  after['package.json'].lastUpdate = '2026-09-07';
  after['src/constants/release.json'].lastUpdate = '2026-09-07';
  change(after);
  return Object.fromEntries(Object.keys(before).map((file) => [file, {
    before: JSON.stringify(before[file]), after: JSON.stringify(after[file]),
  }]));
}

test('accepts synchronized patch version and date with a large unchanged dependency lock', () => {
  const contents = makeContents();
  assert.equal(validateReleaseMetadata(contents), true);
  const result = evaluateHotfixScope(
    [...Object.keys(contents), 'backend/routes/consultations/learning.js'],
    { 'package-lock.json': 9000, 'backend/routes/consultations/learning.js': 190 },
    contents,
  );
  assert.equal(result.ready, true);
  assert.equal(result.score, 100);
});

const forbiddenChanges = {
  dependency: (data) => { data['package.json'].dependencies.next = '16.0.0'; },
  script: (data) => { data['package.json'].scripts.build = 'unexpected command'; },
  lockDependency: (data) => { data['package-lock.json'].packages[''].dependencies.next = '16.0.0'; },
  lockIntegrity: (data) => { data['package-lock.json'].packages['node_modules/next'].integrity = 'changed'; },
  unrelatedMetadata: (data) => { data['package.json'].private = false; },
  releaseExtraField: (data) => { data['src/constants/release.json'].apiBase = 'unexpected'; },
  mismatchedVersion: (data) => { data['src/constants/release.json'].version = '4.0.45'; },
  mismatchedLockVersion: (data) => { data['package-lock.json'].packages[''].version = '4.0.45'; },
  mismatchedDate: (data) => { data['src/constants/release.json'].lastUpdate = '2026-09-08'; },
  invalidDate: (data) => { data['package.json'].lastUpdate = '2026-02-30'; },
  backwardsDate: (data) => {
    data['package.json'].lastUpdate = '2026-08-01';
    data['src/constants/release.json'].lastUpdate = '2026-08-01';
  },
  skippedPatch: (data) => {
    for (const value of Object.values(data)) value.version = '4.0.47';
    data['package-lock.json'].packages[''].version = '4.0.47';
  },
};

for (const [name, change] of Object.entries(forbiddenChanges)) {
  test(`rejects ${name} even when application hotfix files are present`, () => {
    const contents = makeContents(change);
    assert.equal(validateReleaseMetadata(contents), false);
    const result = evaluateHotfixScope(
      [...Object.keys(contents), 'backend/routes/consultations/learning.js'], {}, contents,
    );
    assert.equal(result.ready, false);
    assert.equal(result.blockers.includes('sensitive_paths'), true);
  });
}

test('missing or malformed before/after evidence fails closed', () => {
  assert.equal(validateReleaseMetadata({}), false);
  const malformed = makeContents();
  malformed['package.json'].after = '{';
  assert.equal(validateReleaseMetadata(malformed), false);
  assert.equal(evaluateHotfixScope(['package.json'], {}).ready, false);
});

test('release metadata approval does not allow sensitive changes or oversized runtime files', () => {
  const result = evaluateHotfixScope(
    [...Object.keys(makeContents()), 'backend/middleware/auth.js', 'backend/routes/consultations/learning.js'],
    { 'backend/routes/consultations/learning.js': 501 }, makeContents(),
  );
  assert.equal(result.ready, false);
  assert.deepEqual(result.sensitiveFiles, ['backend/middleware/auth.js']);
  assert.deepEqual(result.oversizedFiles, ['backend/routes/consultations/learning.js']);
});
