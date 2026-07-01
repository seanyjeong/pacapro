import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

const source = readFileSync('src/app/performance/_components/JungsiLinkButton.tsx', 'utf8');
const browserApiFiles = [
  'next.config.js',
  'src/lib/peak-sso.ts',
  'src/lib/api/client.ts',
  'src/lib/api/consultations.ts',
  'src/lib/api/exports.ts',
  'src/app/reset-password/page.tsx',
  'src/app/forgot-password/page.tsx',
  'src/app/consultation/[reservationNumber]/page.tsx',
  'src/app/students/page.tsx',
  'src/components/schedules/attendance-checker.tsx',
];

test('jungsi link popup waits for success message', () => {
  assert.match(source, /window\.addEventListener\('message'/);
  assert.match(source, /paca-jungsi-link/);
  assert.match(source, /getLinkState/);
  assert.match(source, /event\.data\.state !== expectedState/);
  assert.doesNotMatch(source, /noopener|noreferrer/);
});

test('jungsi link UX uses Korean plain-language messages', () => {
  assert.match(source, /정시엔진이 정상적으로 연동되었습니다/);
  assert.match(source, /팝업 차단을 해제/);
  assert.doesNotMatch(source, /CORS|HTTP 500|stack trace/i);
});

test('browser-facing PACA API calls use supermax directly', () => {
  for (const file of browserApiFiles) {
    const fileSource = readFileSync(file, 'utf8');
    assert.doesNotMatch(fileSource, /chejump\.com(?::8320)?\/paca/, file);
  }

  const baseSource = readFileSync('src/lib/api/base-url.ts', 'utf8');
  assert.match(baseSource, /https:\/\/supermax\.kr\/paca/);
  assert.match(baseSource, /LEGACY_PACA_API_URLS/);
});
