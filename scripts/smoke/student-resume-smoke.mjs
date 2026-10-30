import {
  assertNoHorizontalOverflow,
  assertNoRawVisibleText,
  createAuthedContext,
  createDiagnostics,
  jsonRoute,
  launchSmokeBrowser,
  nonServiceWorkerErrors,
  normalizePacaApiPath,
} from './paca-smoke-utils.mjs';

function makePausedStudent() {
  return {
    id: 42,
    academy_id: 1,
    student_number: 'S-2026-042',
    name: '이복귀',
    gender: 'female',
    student_type: 'exam',
    phone: '010-2222-3333',
    parent_phone: '010-4444-5555',
    school: '일산여고',
    grade: '고2',
    admission_type: 'regular',
    class_days: [{ day: 1, timeSlot: 'evening' }, { day: 3, timeSlot: 'evening' }],
    weekly_count: 2,
    monthly_tuition: '520000',
    discount_rate: '10',
    payment_due_day: 5,
    final_monthly_tuition: '468000',
    is_season_registered: false,
    current_season_id: null,
    status: 'paused',
    rest_start_date: '2026-06-01',
    rest_end_date: null,
    rest_reason: '부상 회복',
    enrollment_date: '2026-03-04',
    academy_name: 'PACA 일산',
    created_at: '2026-02-20T09:00:00.000Z',
    updated_at: '2026-06-22T09:00:00.000Z',
  };
}

function makeState(overrides = {}) {
  return {
    hits: [],
    resumeAuthHeaders: [],
    resumeMode: 'technical',
    studentStatus: 'paused',
    resumePayloads: [],
    ...overrides,
  };
}

async function installRoutes(context, state) {
  await context.route('**/*', async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const isApi = url.hostname === 'supermax.kr';

    if (!isApi) return route.continue();

    const method = request.method();
    const path = normalizePacaApiPath(url);
    state.hits.push(`${method} ${path}${url.search}`);

    if (method === 'GET' && path === '/students/42') {
      return jsonRoute(route, {
        message: 'ok',
        payments: [],
        performances: [],
        student: { ...makePausedStudent(), status: state.studentStatus },
      });
    }

    if (method === 'GET' && path === '/students/42/rest-credits') {
      return jsonRoute(route, { credits: [], message: 'ok', pendingTotal: 0 });
    }

    if (method === 'POST' && path === '/students/42/resume') {
      state.resumeAuthHeaders.push(request.headers().authorization);
      state.resumePayloads.push(request.postDataJSON());
      if (state.resumeMode === 'conflict') {
        return jsonRoute(route, {
          error: 'REST_CREDIT_RECALCULATION_CONFLICT',
          message: '이미 사용한 휴식 크레딧이 정상 금액보다 큽니다. 크레딧 사용 내역을 먼저 확인해주세요.',
        }, 409);
      }
      if (state.resumeMode === 'success') {
        state.studentStatus = 'active';
        return jsonRoute(route, {
          message: '2026-06-23 복귀 처리가 완료되었습니다. 휴식 크레딧이 520,000원에서 351,000원으로 재계산되었습니다.',
          student: { ...makePausedStudent(), status: 'active' },
          scheduleAssigned: { assigned: 4, created: 4 },
          paymentCreated: null,
          creditRecalculation: {
            adjusted: true,
            creditId: 12,
            creditType: 'carryover',
            previousAmount: 520000,
            creditAmount: 351000,
            remainingAmount: 351000,
            usedAmount: 0,
            restStartDate: '2026-06-01',
            restEndDate: '2026-06-22',
            restDays: 22,
            status: 'pending',
          },
          resumeDate: '2026-06-23',
        });
      }
      return jsonRoute(route, { message: 'HTTP 500 DB stack trace' }, 500);
    }

    if (method === 'GET' && path === '/settings/academy') {
      return jsonRoute(route, { settings: { academy_name: 'PACA 일산' } });
    }

    return jsonRoute(route, { message: 'mocked' });
  });
}

async function runResumeError(browser) {
  const state = makeState();
  const context = await createAuthedContext(browser, { width: 390, height: 844 });
  await installRoutes(context, state);
  const page = await context.newPage();
  page.setDefaultTimeout(15000);
  const diagnostics = createDiagnostics(page);

  await page.goto('/students/42', { waitUntil: 'domcontentloaded' });
  await page.getByRole('heading', { name: '학생 상세' }).waitFor();
  await page.getByRole('button', { name: '복귀 처리' }).click();
  await page.getByRole('heading', { name: '휴원 복귀 처리' }).waitFor();
  const resumeResponse = page.waitForResponse((response) => response.url().includes('/students/42/resume'));
  await page.getByRole('button', { name: '복귀 처리' }).last().click();
  await resumeResponse;
  await page.waitForTimeout(100);
  await assertNoRawVisibleText(page, 'student resume error');
  await page.getByRole('alert').getByText('복귀 처리를 완료하지 못했습니다. 잠시 후 다시 시도해주세요.').waitFor();
  await assertNoHorizontalOverflow(page, 'student resume error');
  await page.screenshot({ path: '/Users/etlab/paca-student-resume-error-mobile.png', fullPage: true });

  if (!state.resumePayloads.at(-1)?.resume_date) {
    throw new Error(`resume payload missing date: ${JSON.stringify(state.resumePayloads)}`);
  }
  if (state.resumeAuthHeaders.at(-1) !== 'Bearer smoke-token') {
    throw new Error(`resume auth header missing: ${JSON.stringify(state.resumeAuthHeaders)}`);
  }

  await context.close();
  return { diagnostics, state };
}

async function runResumeConflict(browser) {
  const state = makeState({ resumeMode: 'conflict' });
  const context = await createAuthedContext(browser, { width: 390, height: 844 });
  await installRoutes(context, state);
  const page = await context.newPage();
  page.setDefaultTimeout(15000);
  const diagnostics = createDiagnostics(page);

  await page.goto('/students/42', { waitUntil: 'domcontentloaded' });
  await page.getByRole('heading', { name: '학생 상세' }).waitFor();
  await page.getByRole('button', { name: '복귀 처리' }).click();
  await page.getByText('휴식 크레딧은 복귀 전날까지의 실제 휴식일수로 자동 재계산됩니다.').waitFor();
  const resumeResponse = page.waitForResponse((response) => response.url().includes('/students/42/resume'));
  await page.getByRole('button', { name: '복귀 처리' }).last().click();
  await resumeResponse;
  await page.getByRole('alert').getByText(
    '이미 사용한 휴식 크레딧이 정상 금액보다 큽니다. 크레딧 사용 내역을 먼저 확인해주세요.'
  ).waitFor();
  await assertNoRawVisibleText(page, 'student resume credit conflict');
  await assertNoHorizontalOverflow(page, 'student resume credit conflict');
  await context.close();
  return { diagnostics, state };
}

async function runResumeSuccess(browser) {
  const state = makeState({ resumeMode: 'success' });
  const context = await createAuthedContext(browser, { width: 1365, height: 900 });
  await installRoutes(context, state);
  const page = await context.newPage();
  page.setDefaultTimeout(15000);
  const diagnostics = createDiagnostics(page);

  await page.goto('/students/42', { waitUntil: 'domcontentloaded' });
  await page.getByRole('heading', { name: '학생 상세' }).waitFor();
  await page.getByRole('button', { name: '복귀 처리' }).click();
  await page.getByRole('button', { name: '복귀 처리' }).last().click();
  await page.getByText('복귀 처리 완료', { exact: true }).waitFor();
  await page.getByText(/휴식 크레딧이 520,000원에서 351,000원으로 재계산되었습니다/).waitFor();
  await assertNoRawVisibleText(page, 'student resume credit success');
  await assertNoHorizontalOverflow(page, 'student resume credit success');
  await context.close();
  return { diagnostics, state };
}

async function runEditResume(browser, width) {
  const state = makeState({ resumeMode: 'conflict' });
  const context = await createAuthedContext(browser, { width, height: 900 });
  await installRoutes(context, state);
  const page = await context.newPage();
  const diagnostics = createDiagnostics(page);
  await page.goto('/students/42/edit', { waitUntil: 'domcontentloaded' });
  const button = page.getByRole('button', { name: '휴원 복귀', exact: true });
  await button.waitFor();
  const activeOption = page.locator('select option[value="active"]');
  if (!await activeOption.isDisabled()) throw new Error('paused → active dropdown must be disabled');
  await button.click();
  await page.getByText('이복귀 학생은 며칠에 복귀하시겠습니까?').waitFor();
  if (await page.locator('form form').count()) throw new Error('nested resume form can submit the profile');
  await page.getByRole('dialog').getByRole('button', { name: '취소', exact: true }).click();
  if (state.resumePayloads.length) throw new Error('cancel must not resume');
  await button.click();
  await page.getByLabel('복귀 날짜', { exact: true }).fill('2026-06-01');
  await page.getByRole('dialog').getByText('468,000원', { exact: true }).waitFor();
  await page.getByLabel('복귀 날짜', { exact: true }).fill('2026-06-23');
  await assertNoHorizontalOverflow(page, `edit resume ${width}`);
  await page.getByRole('dialog').getByRole('button', { name: '복귀 처리', exact: true }).click();
  await page.getByRole('alert').getByText(/이미 사용한 휴식 크레딧/).waitFor();
  if (state.resumePayloads.at(-1)?.resume_date !== '2026-06-23') throw new Error('selected date was not submitted');
  if (state.hits.some(hit => hit.startsWith('PUT '))) throw new Error('resume submitted profile form');
  state.resumeMode = 'success';
  await page.getByRole('dialog').getByRole('button', { name: '복귀 처리', exact: true }).click();
  await page.getByText('복귀 처리 완료', { exact: true }).waitFor();
  await button.waitFor({ state: 'hidden' });
  if (await page.locator('select').filter({ has: page.locator('option[value="active"]') }).inputValue() !== 'active') {
    throw new Error('form did not refresh active state');
  }
  if (state.resumePayloads.length !== 2) throw new Error('unexpected duplicate resume request');
  await assertNoHorizontalOverflow(page, `edit resume complete ${width}`);
  await context.close();
  return { diagnostics, state };
}

function assertDiagnostics(result) {
  const pageErrors = nonServiceWorkerErrors(result.diagnostics.pageErrors);
  if (pageErrors.length > 0) throw new Error(`unexpected page errors: ${pageErrors.join(' | ')}`);
}

async function main() {
  const browser = await launchSmokeBrowser();
  try {
    for (const width of [390, 768, 1365]) {
      assertDiagnostics(await runEditResume(browser, width));
    }
    const resumeError = await runResumeError(browser);
    const resumeConflict = await runResumeConflict(browser);
    const resumeSuccess = await runResumeSuccess(browser);
    assertDiagnostics(resumeError);
    assertDiagnostics(resumeConflict);
    assertDiagnostics(resumeSuccess);
    console.log(JSON.stringify({
      hits: resumeError.state.hits,
      resumePayload: resumeError.state.resumePayloads.at(-1),
      resumeAuthHeaderVerified: resumeError.state.resumeAuthHeaders.at(-1) === 'Bearer smoke-token',
      consoleErrors: resumeError.diagnostics.consoleErrors,
      conflictMessageVerified: true,
      successMessageVerified: true,
      editResumeVerifiedWidths: [390, 768, 1365],
    }, null, 2));
  } finally {
    await browser.close();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
