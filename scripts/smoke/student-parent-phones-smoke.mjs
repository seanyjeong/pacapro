import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { assertNoHorizontalOverflow, assertNoRawVisibleText, createAuthedContext,
  createDiagnostics, launchSmokeBrowser, nonServiceWorkerErrors } from './paca-smoke-utils.mjs';
import { installParentNameRoutes } from './student-parent-names-fixture.mjs';

const artifacts = '/tmp/paca-parent-phones-review';
await mkdir(artifacts, { recursive: true });
const browser = await launchSmokeBrowser();
let completed = 0;

async function scenario(width, run) {
  const context = await createAuthedContext(browser, { width, height: 1000 });
  const state = {};
  await installParentNameRoutes(context, state);
  const page = await context.newPage();
  page.setDefaultTimeout(15000);
  const diagnostics = createDiagnostics(page);
  try {
    await run(page, state);
    await assertNoRawVisibleText(page, 'parent phones');
    await assertNoHorizontalOverflow(page, 'parent phones');
    assert.deepEqual(nonServiceWorkerErrors(diagnostics.pageErrors), []);
    completed += 1;
  } finally { await context.close(); }
}

try {
  for (const width of [390, 1280]) await scenario(width, async (page, state) => {
    Object.assign(state.students[0], {
      father_phone: '010-1111-2222', mother_phone: '010-3333-4444', parent_phone: '010-7777-8888',
    });
    await page.goto('/students/77/edit#parent-info', { waitUntil: 'networkidle' });
    const father = page.getByLabel('아버지 전화번호');
    const mother = page.getByLabel('어머니 전화번호');
    const primary = page.getByLabel('대표 학부모 전화번호');
    assert.equal(await father.inputValue(), '010-1111-2222');
    assert.equal(await mother.inputValue(), '010-3333-4444');
    assert.equal(await primary.inputValue(), '010-7777-8888');
    for (const field of [father, mother]) assert.ok((await field.boundingBox()).height >= 44);
    await page.locator('#parent-info').screenshot({ path: `${artifacts}/form-${width}.png` });
    await father.fill('01099990000');
    assert.equal(await father.inputValue(), '010-9999-0000');
    state.failSave = true;
    await page.locator('button[type="submit"]').click();
    await page.getByTestId('student-form-submit-error').waitFor();
    assert.equal(await father.inputValue(), '010-9999-0000');
    assert.equal(await mother.inputValue(), '010-3333-4444');
    state.failSave = false;
    await mother.locator('..').getByRole('button', { name: '대표 번호로 사용', exact: true }).click();
    assert.equal(await primary.inputValue(), '010-3333-4444');
    await page.locator('button[type="submit"]').click();
    await page.waitForURL('**/students/77');
    assert.equal(state.writes.at(-1).body.father_phone, '010-9999-0000');
    assert.equal(state.writes.at(-1).body.mother_phone, '010-3333-4444');
    assert.equal(state.writes.at(-1).body.parent_phone, '010-3333-4444');
    const details = page.getByTestId('student-parent-details');
    await details.getByRole('link', { name: '010-9999-0000', exact: true }).waitFor();
    await details.getByRole('link', { name: '010-3333-4444', exact: true }).waitFor();
    await details.screenshot({ path: `${artifacts}/detail-${width}.png` });
    await details.getByRole('link', { name: '보호자 정보 수정' }).click();
    await page.waitForURL('**/students/77/edit#parent-info');
    assert.equal(await father.inputValue(), '010-9999-0000');
    assert.equal(await mother.inputValue(), '010-3333-4444');
    await father.fill('');
    await page.locator('button[type="submit"]').click();
    await page.waitForURL('**/students/77');
    assert.equal(state.writes.at(-1).body.father_phone, '');
    assert.equal(state.writes.at(-1).body.mother_phone, '010-3333-4444');
    assert.equal(state.writes.at(-1).body.parent_phone, '010-3333-4444');
    await details.getByText('미입력', { exact: true }).waitFor();
    await details.getByRole('link', { name: '010-3333-4444', exact: true }).waitFor();
  });

  await scenario(390, async (page, state) => {
    state.students[0].parent_phone = '010-7777-8888';
    await page.goto('/students/77/edit#parent-info', { waitUntil: 'networkidle' });
    assert.equal(await page.getByLabel('아버지 전화번호').inputValue(), '');
    assert.equal(await page.getByLabel('어머니 전화번호').inputValue(), '');
    assert.equal(await page.getByLabel('대표 학부모 전화번호').inputValue(), '010-7777-8888');
    await page.locator('button[type="submit"]').click();
    await page.waitForURL('**/students/77');
    assert.equal(state.writes[0].body.parent_phone, '010-7777-8888');
  });

  await scenario(1280, async (page, state) => {
    await page.goto('/students/77/edit#parent-info', { waitUntil: 'networkidle' });
    await page.getByLabel('어머니 전화번호').fill('01012');
    await page.locator('button[type="submit"]').click();
    await page.locator('#mother_phone-error').waitFor();
    assert.equal(state.writes.length, 0);
    assert.equal(await page.getByLabel('어머니 전화번호').getAttribute('aria-invalid'), 'true');
  });

  for (const width of [390, 1280]) await scenario(width, async (page, state) => {
    await page.goto('/students/new', { waitUntil: 'networkidle' });
    await page.locator('#field-name').fill('신규학생');
    await page.locator('#field-phone').fill('010-2222-5555');
    await page.locator('#field-grade').selectOption('고2');
    await page.getByLabel('아버지 성함').fill('김아버지');
    await page.getByLabel('어머니 성함').fill('박어머니');
    await page.getByLabel('아버지 전화번호').fill('01011112222');
    await page.getByLabel('어머니 전화번호').fill('01033334444');
    await page.locator('button[type="submit"]').click();
    await page.waitForURL('**/students');
    assert.equal(state.writes[0].body.father_phone, '010-1111-2222');
    assert.equal(state.writes[0].body.mother_phone, '010-3333-4444');
  });

  for (const width of [390, 1280]) await scenario(width, async (page, state) => {
    Object.assign(state.students[0], { father_phone: '010-1111-2222', mother_phone: '010-3333-4444' });
    await page.goto('/tablet/students/77', { waitUntil: 'networkidle' });
    await page.getByText('010-1111-2222', { exact: true }).waitFor();
    await page.getByText('010-3333-4444', { exact: true }).waitFor();
    assert.equal(state.writes.length, 0);
  });
  console.log(JSON.stringify({ completed, artifacts, productionWrites: 0 }));
} finally { await browser.close(); }
