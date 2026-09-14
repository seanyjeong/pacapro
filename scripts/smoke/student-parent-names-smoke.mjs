import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { assertNoHorizontalOverflow, assertNoRawVisibleText, createAuthedContext,
  createDiagnostics, launchSmokeBrowser, nonServiceWorkerErrors } from './paca-smoke-utils.mjs';
import { installParentNameRoutes } from './student-parent-names-fixture.mjs';

const artifacts = '/tmp/paca-parent-names-review';
await mkdir(artifacts, { recursive: true });
const browser = await launchSmokeBrowser();
let completed = 0;

async function scenario(width, run) {
  const context = await createAuthedContext(browser, { width, height: 900 });
  const state = {};
  await installParentNameRoutes(context, state);
  const page = await context.newPage();
  page.setDefaultTimeout(15000);
  const diagnostics = createDiagnostics(page);
  try {
    await run(page, state);
    await assertNoRawVisibleText(page, 'parent names');
    await assertNoHorizontalOverflow(page, 'parent names');
    assert.deepEqual(nonServiceWorkerErrors(diagnostics.pageErrors), []);
    completed += 1;
  } finally { await context.close(); }
}

try {
  for (const width of [390, 1280]) await scenario(width, async (page, state) => {
    state.students[0].father_name = null;
    state.students[0].mother_name = null;
    await page.goto('/students', { waitUntil: 'networkidle' });
    if (width >= 768) {
      await page.locator('tbody tr').filter({ hasText: '김첫째' }).first().click();
    } else {
      await page.getByRole('button', { name: '김첫째 상세 보기' }).click();
    }
    await page.waitForURL('**/students/77');
    const details = page.getByTestId('student-parent-details');
    await details.getByText('아버지 성함', { exact: true }).waitFor();
    await details.getByText('어머니 성함', { exact: true }).waitFor();
    assert.equal(await details.getByText('미입력', { exact: true }).count(), 2);
    await details.getByRole('link', { name: '보호자 정보 입력' }).click();
    await page.waitForURL('**/students/77/edit#parent-info');
    const father = page.getByLabel('아버지 성함');
    const mother = page.getByLabel('어머니 성함');
    await father.waitFor();
    assert.equal(await father.inputValue(), '');
    assert.equal(await mother.inputValue(), '');
    await page.waitForFunction(() => {
      const field = document.getElementById('field-father_name');
      if (!field) return false;
      const box = field.getBoundingClientRect();
      return box.top >= 64 && box.bottom <= window.innerHeight;
    });
    assert.equal(state.writes.length, 0);
    await page.screenshot({ path: `${artifacts}/parent-entry-${width}.png` });
  });

  for (const width of [390, 1280]) await scenario(width, async (page, state) => {
    await page.goto('/students/77/edit', { waitUntil: 'networkidle' });
    const father = page.getByLabel('아버지 성함');
    const mother = page.getByLabel('어머니 성함');
    assert.equal(await father.inputValue(), '김아버지');
    assert.equal(await mother.inputValue(), '박어머니');
    const f = await father.boundingBox(); const m = await mother.boundingBox();
    assert.ok(f.height >= 44 && m.height >= 44);
    if (width < 768) assert.ok(m.y >= f.y + f.height + 20);
    else assert.ok(Math.abs(m.y - f.y) < 1 && m.x >= f.x + f.width + 20);
    await father.locator('../..').locator('..').screenshot({ path: `${artifacts}/form-${width}.png` });
    await father.fill('김수정');
    state.failSave = true;
    await page.locator('button[type="submit"]').click();
    await page.getByTestId('student-form-submit-error').waitFor();
    assert.equal(await father.inputValue(), '김수정');
    assert.equal(await mother.inputValue(), '박어머니');
    state.failSave = false;
    await mother.fill('');
    await page.locator('button[type="submit"]').click();
    await page.waitForURL('**/students/77');
    assert.equal(state.writes.at(-1).body.father_name, '김수정');
    assert.equal(state.writes.at(-1).body.mother_name, '');
    await page.getByTestId('student-parent-details').getByText('김수정', { exact: true }).waitFor();
  });

  await scenario(390, async (page, state) => {
    await page.goto('/students/new', { waitUntil: 'networkidle' });
    await page.locator('#field-name').fill('신규학생');
    await page.locator('#field-phone').fill('010-1234-5678');
    await page.locator('#field-grade').selectOption('고2');
    await page.getByLabel('아버지 성함').fill('김아버지');
    await page.locator('button[type="submit"]').click();
    await page.waitForURL('**/students');
    assert.equal(state.writes[0].body.father_name, '김아버지');
    assert.equal(state.writes[0].body.mother_name, '');
  });

  for (const [url, width] of [['/students', 1280], ['/students', 390]]) {
    await scenario(width, async (page) => {
      await page.goto(url, { waitUntil: 'networkidle' });
      await page.getByPlaceholder('학생·부모님 이름, 학번, 연락처').fill('김아버지');
      await page.getByText('아버지 김아버지', { exact: true }).filter({ visible: true }).first().waitFor();
      await page.waitForFunction(() => !document.body.innerText.includes('이학생'));
      assert.ok((await page.locator('body').innerText()).includes('김첫째'));
      assert.ok((await page.locator('body').innerText()).includes('김둘째'));
    });
  }

  for (const [url, width] of [['/payments', 1280]]) {
    await scenario(width, async (page, state) => {
      await page.goto(url, { waitUntil: 'networkidle' });
      await page.getByLabel('학생·부모님 이름 검색').fill(' 김 아버지 ');
      const rows = page.locator(width >= 1024 ? 'tbody tr:visible' : 'article:visible');
      await rows.filter({ hasText: '김첫째' }).first().waitFor();
      assert.equal(await rows.count(), 2);
      await page.screenshot({ path: `${artifacts}/payments-${width}.png`, fullPage: true });
      await rows.filter({ hasText: '김둘째' }).getByRole('button', { name: '계좌', exact: true }).click();
      const dialog = page.getByRole('alertdialog');
      await dialog.getByText('아버지 김아버지', { exact: true }).waitFor();
      assert.ok((await dialog.innerText()).includes('김둘째'));
      assert.equal(state.writes.length, 0);
      await dialog.getByRole('button', { name: '납부 처리', exact: true }).click();
      await page.waitForFunction(() => !document.querySelector('[role="alertdialog"]'));
      assert.equal(state.writes.at(-1).path, '/payments/502/pay');
      assert.equal(state.writes.at(-1).body.paid_amount, 250000);
      assert.equal(state.payments[0].paid_amount, 100000);
    });
  }

  for (const width of [390, 1280]) await scenario(width, async (page, state) => {
    await page.goto('/tablet/payments', { waitUntil: 'networkidle' });
    const rows = page.locator(width >= 1024 ? 'tbody tr:visible' : 'article:visible');
    await rows.filter({ hasText: '김첫째' }).waitFor();
    assert.equal(await page.getByText('아버지 김아버지', { exact: true }).count(), 0);
    const search = page.getByLabel('학생 이름 검색');
    await search.fill('김아버지');
    await page.getByText('학원비 내역이 없습니다', { exact: true }).waitFor();
    await search.fill('김둘째');
    await rows.getByRole('button', { name: '계좌', exact: true }).click();
    const dialog = page.getByRole('alertdialog');
    assert.equal(await dialog.getByText('아버지 김아버지', { exact: true }).count(), 0);
    await dialog.getByRole('button', { name: '납부 처리', exact: true }).click();
    await page.waitForFunction(() => !document.querySelector('[role="alertdialog"]'));
    assert.equal(state.writes.at(-1).path, '/payments/502/pay');
    assert.equal(state.writes.at(-1).body.paid_amount, 250000);
  });

  await scenario(390, async (page) => {
    await page.goto('/tablet/students', { waitUntil: 'networkidle' });
    await page.getByRole('heading', { name: '김첫째', exact: true }).waitFor();
    assert.equal(await page.getByText('아버지 김아버지', { exact: true }).count(), 0);
    await page.goto('/tablet/students/77', { waitUntil: 'networkidle' });
    await page.getByRole('heading', { name: '김첫째', exact: true }).waitFor();
    assert.equal(await page.getByText('아버지 김아버지', { exact: true }).count(), 0);
  });

  await scenario(320, async (page, state) => {
    await page.goto('/m/unpaid', { waitUntil: 'networkidle' });
    const cards = page.getByTestId('mobile-unpaid-card');
    await cards.first().waitFor();
    assert.equal(await page.getByText('아버지 김아버지', { exact: true }).count(), 0);
    await page.getByLabel('미납 학생 검색').fill('김아버지');
    await page.waitForFunction(() => !document.querySelector('[data-testid="mobile-unpaid-card"]'));
    await page.getByLabel('미납 학생 검색').fill('김둘째');
    await cards.getByRole('button', { name: '완납 처리' }).click();
    const sheet = page.getByTestId('mobile-unpaid-pay-sheet');
    assert.equal(await sheet.getByText('아버지 김아버지', { exact: true }).count(), 0);
    await page.getByRole('button', { name: '완납 저장' }).click();
    await page.waitForFunction(() => !document.body.innerText.includes('완납 저장'));
    assert.equal(state.writes.at(-1).path, '/payments/502/pay');
    assert.equal(state.writes.at(-1).body.paid_amount, 250000);
  });
  console.log(JSON.stringify({ completed, artifacts, productionWrites: 0 }));
} finally { await browser.close(); }
