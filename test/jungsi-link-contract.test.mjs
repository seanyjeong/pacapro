import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

const source = readFileSync('src/app/performance/_components/JungsiLinkButton.tsx', 'utf8');

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
