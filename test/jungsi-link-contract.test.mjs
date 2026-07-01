import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

const source = readFileSync('src/features/performance/performance-jungsi-link-button.tsx', 'utf8');
const backendConfig = readFileSync('backend/routes/jungsi/_config.js', 'utf8');

test('refactor frontend waits for Jungsi popup success message', () => {
  assert.match(source, /window\.addEventListener\('message'/);
  assert.match(source, /paca-jungsi-link/);
  assert.match(source, /getLinkState/);
  assert.match(source, /event\.data\.state !== expectedState/);
  assert.doesNotMatch(source, /popup\.opener\s*=\s*null/);
  assert.doesNotMatch(source, /noopener|noreferrer/);
});

test('Jungsi link UX uses Korean plain-language messages', () => {
  assert.match(source, /정시엔진이 정상적으로 연동되었습니다/);
  assert.match(source, /팝업 차단을 해제/);
  assert.doesNotMatch(source, /CORS|HTTP 500|stack trace/i);
});

test('refactor backend uses supermax Jungsi login by default', () => {
  assert.match(backendConfig, /https:\/\/supermax\.kr\/jungsi/);
  assert.match(backendConfig, /LEGACY_JUNGSI_FRONTEND_BASE/);
});
