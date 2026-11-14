import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { loadTypeScript } from './helpers/load-typescript.mjs';

// 불러온 TS 모듈이 require 로 쓰는 것과 같은 react·react-query 인스턴스를 써야 컨텍스트가 이어진다
const require = createRequire(import.meta.url);
const React = require('react');
const { renderToStaticMarkup } = require('react-dom/server');
const { QueryClient, QueryClientProvider } = require('@tanstack/react-query');

// D06 직원 권한 '전체 해제' — 보기 해제와 수정 해제를 연달아 적용해도 둘 다 남는다
test('전체 해제는 보기·수정 해제를 직전 상태에 이어 적용해 모두 0이 된다', () => {
  const { selectAllPermissions } = loadTypeScript('src/components/staff/permission-select-all.ts');
  const { PERMISSION_PAGES } = loadTypeScript('src/lib/types/staff.ts');
  const count = (permissions, action) => PERMISSION_PAGES.filter(page => permissions[page.key]?.[action]).length;
  const all = selectAllPermissions({}, 'edit', true);
  assert.equal(count(all, 'view'), PERMISSION_PAGES.length);
  assert.equal(count(all, 'edit'), PERMISSION_PAGES.length);

  // setPermissions(prev => ...) 두 번이 이어지는 것과 같은 순서
  const cleared = [['view', false], ['edit', false]].reduce((prev, [action, value]) => selectAllPermissions(prev, action, value), all);
  assert.equal(count(cleared, 'view'), 0);
  assert.equal(count(cleared, 'edit'), 0);
});

test('권한 창의 전체 선택·해제는 렌더 시점 값이 아니라 직전 상태에서 계산한다', async () => {
  const { readFileSync } = await import('node:fs');
  const source = readFileSync('src/components/staff/permission-modal.tsx', 'utf8');
  assert.match(source, /setPermissions\(\(prev\) => selectAllPermissions\(prev, action, value\)\)/);
});

// D09 재원생상담 '전체' — 서버 상태별 통계(같은 범위)를 모두 더한다
test('재원생상담 전체 수는 상태별 수의 합이고, 태블릿 표시 수도 같은 식이다', () => {
  const { getEnrolledConsultationTotal } = loadTypeScript('src/features/enrolled-consultations/enrolled-consultations-utils.ts');
  const { getTabletConsultationTotal } = loadTypeScript('src/features/tablet-consultations/tablet-consultations-utils.ts');
  assert.equal(getEnrolledConsultationTotal({ confirmed: 2 }), 2);
  assert.equal(getEnrolledConsultationTotal({ pending: 1, confirmed: 2, completed: 3, cancelled: 1, no_show: 1 }), 8);
  assert.equal(getEnrolledConsultationTotal({}), 0);
  assert.equal(getTabletConsultationTotal({ confirmed: 1 }, 0), 1);
});

// D10 문자 수신자 선택 — 다크 모드에서도 읽히도록 고정 색 대신 토큰
test('문자 수신자 선택 칸은 고정 하늘색 대신 primary 토큰을 쓴다', () => {
  const { RecipientButton } = loadTypeScript('src/features/sms/recipient-button.tsx');
  const { IndividualStudentPicker } = loadTypeScript('src/features/sms/individual-student-picker.tsx');
  const selected = renderToStaticMarkup(React.createElement(RecipientButton, { label: '학생', detail: '010', selected: true, onClick() {} }));
  const picked = renderToStaticMarkup(React.createElement(IndividualStudentPicker, {
    searchQuery: '', searchResults: [], searching: false, selectedStudent: { id: 1, name: '학생' },
    onSearchQueryChange() {}, onSelectStudent() {}, onClearStudent() {},
  }));
  for (const html of [selected, picked]) {
    assert.match(html, /bg-primary-soft/);
    assert.doesNotMatch(html, /sky-\d/);
  }
  assert.match(picked, /text-foreground/);
});

// D16 강사 삭제 — 상세 화면은 삭제 훅을 써서 강사 목록 쿼리를 무효화한다
test('강사 삭제가 끝나면 강사 목록 쿼리가 무효화되어 목록으로 돌아가면 다시 불러온다', async () => {
  const { instructorsAPI } = loadTypeScript('src/lib/api/instructors.ts');
  const { useDeleteInstructor } = loadTypeScript('src/hooks/use-instructors.ts');
  const deleted = [];
  instructorsAPI.deleteInstructor = async (id) => { deleted.push(id); return { message: 'ok' }; };

  const client = new QueryClient();
  client.setQueryData(['instructors', {}], [{ id: 349 }, { id: 350 }]);
  let mutation;
  function Probe() { mutation = useDeleteInstructor(); return null; }
  renderToStaticMarkup(React.createElement(QueryClientProvider, { client }, React.createElement(Probe)));
  await mutation.mutateAsync(349);

  assert.deepEqual(deleted, [349]);
  assert.equal(client.getQueryState(['instructors', {}]).isInvalidated, true);
});

test('강사 상세 화면의 삭제는 useDeleteInstructor 를 거친다', async () => {
  const { readFileSync } = await import('node:fs');
  const source = readFileSync('src/app/instructors/[id]/page.tsx', 'utf8');
  assert.match(source, /useDeleteInstructor\(\)/);
  assert.match(source, /deleteMutation\.mutateAsync\(instructorId\)/);
  assert.doesNotMatch(source, /instructorsAPI\.deleteInstructor/);
});
