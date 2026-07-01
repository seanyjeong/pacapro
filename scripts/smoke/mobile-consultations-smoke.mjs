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

const BASE_URL = process.env.PACA_SMOKE_BASE_URL || 'http://localhost:3109';

function toLocalDateStr(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function makeConsultation(id, overrides = {}) {
  const today = toLocalDateStr(new Date());
  return {
    id,
    academy_id: 1,
    consultation_type: 'new_registration',
    parent_name: '보호자',
    parent_phone: '010-1111-2222',
    student_name: '김민서',
    student_phone: '010-3333-4444',
    student_grade: '고3',
    student_school: '일산고',
    preferred_date: today,
    preferred_time: '14:00:00',
    status: 'confirmed',
    inquiry_content: '정시 상담을 받고 싶습니다.',
    created_at: '2026-06-01T00:00:00Z',
    updated_at: '2026-06-01T00:00:00Z',
    ...overrides,
  };
}

const consultations = [
  makeConsultation(501),
  makeConsultation(502, {
    student_name: '박서윤',
    student_grade: '고2',
    student_school: '백마고',
    preferred_time: '16:30:00',
    status: 'pending',
  }),
  makeConsultation(503, {
    student_name: '이도현',
    preferred_time: '11:00:00',
    status: 'completed',
  }),
];

function makeListResponse(items = consultations) {
  return {
    consultations: items,
    pagination: { total: items.length, page: 1, limit: 50, totalPages: 1 },
    stats: { pending: 1, confirmed: 1, completed: 1, cancelled: 0, no_show: 0 },
  };
}

function makeState(overrides = {}) {
  return {
    createdPayloads: [],
    externalContinues: [],
    hits: [],
    statusPayloads: [],
    ...overrides,
  };
}

async function installRoutes(context, state) {
  await context.route('**/*', async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const isLocal = url.origin === BASE_URL;
    const isApi = url.hostname === 'supermax.kr';

    if (!isApi) {
      if (!isLocal) state.externalContinues.push(request.url());
      return route.continue();
    }

    const method = request.method();
    const path = normalizePacaApiPath(url);
    const pathWithSearch = `${path}${url.search}`;
    state.hits.push(`${method} ${pathWithSearch}`);

    if (state.failLoad && method === 'GET' && path === '/consultations') {
      return jsonRoute(route, { message: 'HTTP 500 DB stack trace' }, 500);
    }
    if (method === 'GET' && path === '/consultations') {
      return jsonRoute(route, makeListResponse());
    }
    if (method === 'GET' && path === '/consultations/booked-times') {
      return jsonRoute(route, { date: url.searchParams.get('date'), bookedTimes: ['10:00'] });
    }
    if (state.failCreate && method === 'POST' && path === '/consultations/direct') {
      return jsonRoute(route, { message: 'HTTP 500 DB stack trace' }, 500);
    }
    if (method === 'POST' && path === '/consultations/direct') {
      state.createdPayloads.push(request.postDataJSON());
      return jsonRoute(route, { message: 'created', id: 777 }, 201);
    }
    if (state.failStatus && method === 'PUT' && path === '/consultations/501') {
      return jsonRoute(route, { message: 'HTTP 500 DB stack trace' }, 500);
    }
    if (method === 'PUT' && path === '/consultations/501') {
      state.statusPayloads.push(request.postDataJSON());
      return jsonRoute(route, { message: 'updated' });
    }

    return jsonRoute(route, { message: 'mocked' });
  });
}

async function createMobilePage(browser, state) {
  const context = await createAuthedContext(browser, { width: 390, height: 844 });
  await installRoutes(context, state);
  const page = await context.newPage();
  const diagnostics = createDiagnostics(page);
  return { context, page, diagnostics };
}

async function gotoWorkspace(page) {
  for (let attempt = 1; attempt <= 2; attempt += 1) {
    await page.goto('/m/consultations', { waitUntil: 'domcontentloaded' });
    try {
      await page.getByTestId('mobile-consultations-workspace').waitFor({ timeout: 20000 });
      await page.waitForLoadState('networkidle', { timeout: 10000 }).catch(() => {});
      return;
    } catch (error) {
      if (attempt === 2) {
        const body = await page.locator('body').innerText().catch(() => '');
        throw new Error(`mobile consultations workspace did not render at ${page.url()}: ${body.slice(0, 500)}\n${error.message}`);
      }
      await page.waitForTimeout(500);
    }
  }
}

async function openCreateSheet(page) {
  await page.getByLabel('신규 상담 등록').last().click();
  await page.getByRole('heading', { name: '신규 상담 등록' }).waitFor();
  await page.getByLabel('학생명 *').fill('최지훈');
  await page.getByLabel('연락처 *').fill('010-9999-8888');
  await page.getByRole('button', { name: '고3', exact: true }).click();
  await page.getByRole('button', { name: '10:30', exact: true }).click();
}

async function runNormal(browser) {
  const state = makeState();
  const { context, page, diagnostics } = await createMobilePage(browser, state);

  await gotoWorkspace(page);
  await page.getByRole('heading', { name: '오늘 상담' }).waitFor();
  await page.getByRole('button', { name: /오늘 상담/ }).click();
  await page.getByTestId('mobile-consultations-calendar').waitFor();
  await page.getByRole('button', { name: '오늘로 이동' }).click();
  await page.getByTestId('mobile-consultations-calendar').waitFor({ state: 'detached' });
  await page.screenshot({ path: '/Users/etlab/paca-mobile-consultations-list.png', fullPage: true });

  await page.locator('[data-testid="mobile-consultation-card"]:has-text("김민서")').first().click();
  await page.getByTestId('mobile-consultation-detail-sheet').waitFor();
  await page.getByRole('button', { name: '상태변경' }).click();
  await page.getByTestId('mobile-consultation-detail-sheet').getByRole('button', { name: '완료' }).click();
  await page.getByText('상태가 변경되었습니다.').waitFor();
  await page.getByLabel('상담 정보 닫기').click();
  await page.getByTestId('mobile-consultation-detail-sheet').waitFor({ state: 'detached' });

  await openCreateSheet(page);
  await page.getByRole('button', { name: '상담 등록', exact: true }).click();
  await page.getByText('상담이 등록되었습니다.').waitFor();

  if (state.statusPayloads.at(-1)?.status !== 'completed') {
    throw new Error(`status payload mismatch: ${JSON.stringify(state.statusPayloads)}`);
  }
  const created = state.createdPayloads.at(-1);
  if (!created || created.studentName !== '최지훈' || created.preferredTime !== '10:30') {
    throw new Error(`create payload mismatch: ${JSON.stringify(created)}`);
  }
  if (!state.hits.some((hit) => hit.startsWith('GET /consultations?startDate='))) {
    throw new Error(`missing consultation list request: ${state.hits.join(' | ')}`);
  }
  if (!state.hits.some((hit) => hit.includes('limit=500'))) {
    throw new Error(`missing month count request: ${state.hits.join(' | ')}`);
  }

  await assertNoRawVisibleText(page, 'mobile consultations normal');
  await assertNoHorizontalOverflow(page, 'mobile consultations normal');
  await page.screenshot({ path: '/Users/etlab/paca-mobile-consultations.png', fullPage: true });
  await context.close();
  return { state, diagnostics };
}

async function runLoadError(browser) {
  const state = makeState({ failLoad: true });
  const { context, page, diagnostics } = await createMobilePage(browser, state);

  await gotoWorkspace(page);
  await page.getByText('상담 목록을 불러오지 못했습니다. 잠시 후 다시 시도해주세요.').waitFor();
  await assertNoRawVisibleText(page, 'mobile consultations load error');
  await assertNoHorizontalOverflow(page, 'mobile consultations load error');
  await page.screenshot({ path: '/Users/etlab/paca-mobile-consultations-load-error.png', fullPage: true });
  await context.close();
  return { state, diagnostics };
}

async function runStatusError(browser) {
  const state = makeState({ failStatus: true });
  const { context, page, diagnostics } = await createMobilePage(browser, state);

  await gotoWorkspace(page);
  await page.locator('[data-testid="mobile-consultation-card"]:has-text("김민서")').first().click();
  await page.getByRole('button', { name: '상태변경' }).click();
  await page.getByTestId('mobile-consultation-detail-sheet').getByRole('button', { name: '완료' }).click();
  await page.getByText('상담 상태를 변경하지 못했습니다. 잠시 후 다시 시도해주세요.').waitFor();
  await assertNoRawVisibleText(page, 'mobile consultations status error');
  await assertNoHorizontalOverflow(page, 'mobile consultations status error');
  await context.close();
  return { state, diagnostics };
}

async function runCreateError(browser) {
  const state = makeState({ failCreate: true });
  const { context, page, diagnostics } = await createMobilePage(browser, state);

  await gotoWorkspace(page);
  await openCreateSheet(page);
  await page.getByRole('button', { name: '상담 등록', exact: true }).click();
  await page.getByText('상담 등록을 완료하지 못했습니다. 잠시 후 다시 시도해주세요.').waitFor();
  await assertNoRawVisibleText(page, 'mobile consultations create error');
  await assertNoHorizontalOverflow(page, 'mobile consultations create error');
  await context.close();
  return { state, diagnostics };
}

function assertDiagnostics(result) {
  const pageErrors = nonServiceWorkerErrors(result.diagnostics.pageErrors);
  if (pageErrors.length > 0) throw new Error(`unexpected page errors: ${pageErrors.join(' | ')}`);
}

async function main() {
  const browser = await launchSmokeBrowser();
  try {
    const normal = await runNormal(browser);
    const loadError = await runLoadError(browser);
    const statusError = await runStatusError(browser);
    const createError = await runCreateError(browser);
    [normal, loadError, statusError, createError].forEach(assertDiagnostics);
    console.log(JSON.stringify({
      hits: normal.state.hits,
      createdPayload: normal.state.createdPayloads.at(-1),
      statusPayload: normal.state.statusPayloads.at(-1),
      normalConsoleErrors: normal.diagnostics.consoleErrors,
      loadErrorConsoleErrors: loadError.diagnostics.consoleErrors,
      statusErrorConsoleErrors: statusError.diagnostics.consoleErrors,
      createErrorConsoleErrors: createError.diagnostics.consoleErrors,
    }, null, 2));
  } finally {
    await browser.close();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
