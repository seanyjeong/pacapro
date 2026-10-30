import assert from 'node:assert/strict';
import { createAuthedContext, createDiagnostics, launchSmokeBrowser, nonServiceWorkerErrors } from './paca-smoke-utils.mjs';
import { installParentNameRoutes } from './student-parent-names-fixture.mjs';

// 미등록관리·체험생의 "정식 등록"이 저장된 학부모 정보·메모를 빈칸으로 덮어쓰지 않는지 확인한다.
const SAVED = {
  school: '가람고', gender: 'female', memo: '상담 메모', address: '고양시',
  father_name: '김아버지', mother_name: '박어머니', father_phone: '010-1111-2222', mother_phone: '010-3333-4444',
  parent_phone: '010-3333-4444', class_days: [{ day: 1, timeSlot: 'evening' }], weekly_count: 1, monthly_tuition: '300000',
};
const browser = await launchSmokeBrowser();
let completed = 0;

async function scenario(query, overrides) {
  const context = await createAuthedContext(browser, { width: 1365, height: 1000 });
  const state = {};
  await installParentNameRoutes(context, state);
  Object.assign(state.students[0], SAVED, overrides);
  const page = await context.newPage();
  page.setDefaultTimeout(15000);
  const diagnostics = createDiagnostics(page);
  try {
    await page.goto(`/students/new?${query}`, { waitUntil: 'networkidle' });
    assert.equal(await page.getByLabel('아버지 전화번호').inputValue(), SAVED.father_phone);
    assert.equal(await page.getByLabel('어머니 성함').inputValue(), SAVED.mother_name);
    assert.equal(await page.getByLabel('대표 학부모 전화번호').inputValue(), SAVED.parent_phone);
    assert.equal(await page.getByRole('button', { name: '일정 추가' }).count(), 0, 'registration form must not open in trial mode');
    await page.locator('button[type="submit"]').click();
    await page.waitForURL('**/students');
    const write = state.writes.find(w => w.method === 'PUT' && w.path === '/students/77');
    assert.ok(write, 'registration must update the existing student');
    for (const field of ['school', 'gender', 'memo', 'address', 'father_name', 'mother_name', 'father_phone', 'mother_phone', 'parent_phone']) {
      assert.equal(write.body[field], SAVED[field], `${field} must be preserved`);
    }
    assert.equal(write.body.status, 'active');
    assert.equal(write.body.is_trial, false);
    assert.deepEqual(nonServiceWorkerErrors(diagnostics.pageErrors), []);
    completed += 1;
  } finally { await context.close(); }
}

try {
  await scenario('from_pending=77', { status: 'pending', enrollment_date: '2026-07-20' });
  await scenario('from_trial=77', { status: 'trial', is_trial: true,
    trial_dates: [{ date: '2026-10-01', attended: true, time_slot: 'evening' }] });
  console.log(JSON.stringify({ completed, productionWrites: 0 }));
} finally { await browser.close(); }
