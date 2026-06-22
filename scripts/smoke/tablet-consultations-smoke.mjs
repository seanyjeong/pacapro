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

function formatDate(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

const today = formatDate(new Date());

function makeConsultation(overrides = {}) {
  return {
    id: 510,
    academy_id: 1,
    consultation_type: 'new_registration',
    parent_name: '김진우 학부모',
    parent_phone: '010-3333-4444',
    student_name: '김진우',
    student_phone: '010-1111-2222',
    student_grade: '고2',
    student_school: '일산고',
    gender: 'male',
    preferred_date: today,
    preferred_time: '10:30',
    status: 'pending',
    inquiry_content: '정시 체대 상담 희망',
    created_at: '2026-06-22T09:00:00.000Z',
    updated_at: '2026-06-22T09:00:00.000Z',
    ...overrides,
  };
}

function makeState(mode = 'success') {
  return { hits: [], mode };
}

async function installRoutes(context, state) {
  await context.route('**/*', async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const isApi = url.hostname === 'chejump.com' || url.hostname === 'supermax.kr';

    if (!isApi) return route.continue();

    const method = request.method();
    const path = normalizePacaApiPath(url);
    state.hits.push(`${method} ${path}${url.search}`);

    if (method === 'GET' && path === '/consultations') {
      if (state.mode === 'load-error') {
        return jsonRoute(route, { message: 'HTTP 500 DB timeout stack trace' }, 500);
      }

      return jsonRoute(route, {
        consultations: [
          makeConsultation(),
          makeConsultation({
            id: 511,
            consultation_type: 'learning',
            learning_type: 'regular',
            parent_name: '',
            parent_phone: '',
            student_name: '박서연',
            student_phone: '010-5555-6666',
            student_grade: '고3',
            student_school: '강남고',
            preferred_time: '11:00',
            linked_student_id: 42,
            linked_student_name: '박서연',
            status: 'confirmed',
          }),
        ],
        pagination: { total: 2, page: 1, limit: 20, totalPages: 1 },
        stats: { total: 2, pending: 1, confirmed: 1, completed: 0, cancelled: 0, no_show: 0 },
      });
    }

    return jsonRoute(route, { message: 'mocked' });
  });
}

async function createTabletConsultationsPage(browser, mode, viewport) {
  const state = makeState(mode);
  const context = await createAuthedContext(browser, viewport);
  await installRoutes(context, state);
  const page = await context.newPage();
  page.setDefaultTimeout(15000);
  const diagnostics = createDiagnostics(page);
  return { context, diagnostics, page, state };
}

async function runNormal(browser, viewport, label) {
  const result = await createTabletConsultationsPage(browser, 'success', viewport);
  const { context, page, state } = result;

  await page.goto('/tablet/consultations', { waitUntil: 'domcontentloaded' });
  await page.getByRole('heading', { name: '오늘 상담 운영' }).waitFor();
  await page.getByText('김진우').first().waitFor();
  await page.getByText('박서연').first().waitFor();

  const conductHref = await page.getByRole('link', { name: '김진우 상담 진행' }).getAttribute('href');
  if (conductHref !== '/tablet/consultations/510/conduct') {
    throw new Error(`conduct href mismatch: ${conductHref}`);
  }

  const studentHref = await page.getByRole('link', { name: '박서연 학생 상세' }).getAttribute('href');
  if (studentHref !== '/tablet/students/42') {
    throw new Error(`student href mismatch: ${studentHref}`);
  }

  const smsHref = await page.getByRole('link', { name: '박서연 문자 보내기' }).getAttribute('href');
  if (smsHref !== '/tablet/sms?studentId=42') {
    throw new Error(`sms href mismatch: ${smsHref}`);
  }

  if (!state.hits.some((hit) => hit.includes(`/consultations?startDate=${today}&endDate=${today}`))) {
    throw new Error(`missing today's consultation request: ${state.hits.join(' | ')}`);
  }

  await assertNoRawVisibleText(page, `tablet consultations ${label}`);
  await assertNoHorizontalOverflow(page, `tablet consultations ${label}`);
  await page.screenshot({ path: `/Users/etlab/paca-tablet-consultations-${label}.png`, fullPage: true });

  await context.close();
  return result;
}

async function runLoadError(browser) {
  const result = await createTabletConsultationsPage(browser, 'load-error', { width: 820, height: 1180 });
  const { context, page } = result;

  await page.goto('/tablet/consultations', { waitUntil: 'domcontentloaded' });
  await page.getByRole('heading', { name: '상담 일정을 불러오지 못했습니다' }).waitFor();
  await page.getByText('잠시 후 다시 시도해주세요.').waitFor();
  await assertNoRawVisibleText(page, 'tablet consultations load error');
  await assertNoHorizontalOverflow(page, 'tablet consultations load error');
  await page.screenshot({ path: '/Users/etlab/paca-tablet-consultations-load-error.png', fullPage: true });

  await context.close();
  return result;
}

function assertDiagnostics(result) {
  const pageErrors = nonServiceWorkerErrors(result.diagnostics.pageErrors);
  if (pageErrors.length > 0) throw new Error(`unexpected page errors: ${pageErrors.join(' | ')}`);
}

async function main() {
  const browser = await launchSmokeBrowser();
  try {
    const landscape = await runNormal(browser, { width: 1180, height: 820 }, 'landscape');
    const portrait = await runNormal(browser, { width: 820, height: 1180 }, 'portrait');
    const loadError = await runLoadError(browser);
    [landscape, portrait, loadError].forEach(assertDiagnostics);
    console.log(JSON.stringify({
      landscapeHits: landscape.state.hits,
      loadErrorHits: loadError.state.hits,
      portraitHits: portrait.state.hits,
    }, null, 2));
  } finally {
    await browser.close();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
