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

function makeState(mode) {
  return {
    completePayload: null,
    hits: [],
    mode,
  };
}

async function installRoutes(context, state) {
  await context.route('**/*', async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const isApi = url.hostname === 'chejump.com' || url.hostname === 'supermax.kr';

    if (!isApi) return route.continue();

    const method = request.method();
    const path = normalizePacaApiPath(url);
    state.hits.push(`${method} ${path}`);

    if (method === 'OPTIONS') {
      return route.fulfill({ status: 204, headers: { 'access-control-allow-origin': '*' } });
    }

    if (method === 'GET' && path === '/onboarding/data') {
      if (state.mode === 'load-error') {
        return jsonRoute(route, { message: 'HTTP 500 DB timeout' }, 500);
      }

      return jsonRoute(route, {
        academy: {
          id: 1,
          name: 'PACA 일산',
          phone: '031-900-0000',
          address: '경기 고양시 일산동구',
          business_number: '123-45-67890',
        },
        settings: {
          morning_class_time: '09:30-12:00',
          afternoon_class_time: '14:00-18:00',
          evening_class_time: '18:30-21:00',
          tuition_due_day: 5,
          salary_payment_day: 10,
          salary_month_type: 'next',
          settings: JSON.stringify({
            exam_tuition: { 1: 210000, 2: 320000, 3: 430000, 4: 520000, 5: 610000, 6: 700000, 7: 780000 },
            adult_tuition: { 1: 160000, 2: 240000, 3: 310000, 4: 390000, 5: 470000, 6: 540000, 7: 600000 },
          }),
        },
      });
    }

    if (method === 'POST' && path === '/onboarding/complete') {
      state.completePayload = JSON.parse(request.postData() || '{}');
      return jsonRoute(route, { success: true, message: 'saved' });
    }

    if (method === 'POST' && path === '/onboarding/sample-data') {
      return jsonRoute(route, {
        success: true,
        message: 'created',
        data: {
          students: [{ id: 1, name: '김학생' }],
          instructors: [{ id: 1, name: '박강사' }],
          seasons: [{ id: 1, name: '겨울 시즌' }],
        },
      });
    }

    if (method === 'POST' && path === '/onboarding/skip') {
      return jsonRoute(route, { success: true, message: 'skipped' });
    }

    return jsonRoute(route, { message: 'mocked' });
  });
}

async function createOnboardingPage(browser, mode, viewport = { width: 1280, height: 900 }) {
  const state = makeState(mode);
  const context = await createAuthedContext(browser, viewport);
  await installRoutes(context, state);
  const page = await context.newPage();
  const diagnostics = createDiagnostics(page);
  return { context, page, state, diagnostics };
}

async function runLoadFailure(browser) {
  const result = await createOnboardingPage(browser, 'load-error', { width: 390, height: 844 });
  const { context, page } = result;

  await page.goto('/onboarding', { waitUntil: 'domcontentloaded' });
  await page.getByRole('alert').getByText('초기 설정 정보를 불러오지 못했습니다').waitFor({ timeout: 15000 });
  await assertNoRawVisibleText(page, 'onboarding load error');
  await assertNoHorizontalOverflow(page, 'onboarding load error');

  await context.close();
  return result;
}

async function runHappyPath(browser) {
  const result = await createOnboardingPage(browser, 'success');
  const { context, page, state } = result;

  await page.goto('/onboarding', { waitUntil: 'domcontentloaded' });
  await page.getByRole('heading', { name: '초기 운영 설정' }).waitFor({ timeout: 15000 });
  await page.screenshot({ path: '/Users/etlab/paca-onboarding-start.png', fullPage: true });

  await page.getByLabel('학원명').fill('PACA 강남');
  await page.getByLabel('대표 전화').fill('02-555-1212');
  await page.getByLabel('주소').fill('서울 강남구 테헤란로');
  await page.getByLabel('사업자등록번호').fill('987-65-43210');

  await page.getByRole('button', { name: '다음: 수업 시간' }).click();
  await page.getByRole('heading', { name: '수업 시간', exact: true }).waitFor();
  await page.getByLabel('오전반 시작').fill('08:30');
  await page.getByLabel('오전반 종료').fill('11:30');

  await page.getByRole('button', { name: '다음: 학원비' }).click();
  await page.getByRole('heading', { name: '학원비', exact: true }).waitFor();
  await page.getByLabel('입시반 주 3회 학원비').fill('450000');

  await page.getByRole('button', { name: '다음: 정산' }).click();
  await page.getByRole('heading', { name: '정산 설정', exact: true }).waitFor();
  await page.getByRole('button', { name: '익월 정산' }).click();
  await page.getByLabel('학원비 기본 납부일').selectOption('10');

  await page.getByRole('button', { name: '다음: 검토' }).click();
  await page.getByRole('heading', { name: '검토 후 시작', exact: true }).waitFor();
  await page.getByLabel('테스트용 샘플 데이터 생성').check();
  await page.getByRole('button', { name: '운영 시작' }).click();
  await page.getByRole('heading', { name: '설정이 저장되었습니다' }).waitFor({ timeout: 15000 });

  if (!state.completePayload) throw new Error('onboarding complete payload was not sent');
  if (state.completePayload.academy_name !== 'PACA 강남') {
    throw new Error(`academy_name mismatch: ${state.completePayload.academy_name}`);
  }
  if (state.completePayload.morning_class_time !== '08:30-11:30') {
    throw new Error(`morning_class_time mismatch: ${state.completePayload.morning_class_time}`);
  }
  if (state.completePayload.tuition_settings?.exam_tuition?.['3'] !== 450000) {
    throw new Error('입시반 주 3회 학원비 payload mismatch');
  }
  if (!state.hits.includes('POST /onboarding/sample-data')) {
    throw new Error('sample data route was not called');
  }

  await assertNoRawVisibleText(page, 'onboarding happy path');
  await assertNoHorizontalOverflow(page, 'onboarding happy path');
  await page.screenshot({ path: '/Users/etlab/paca-onboarding.png', fullPage: true });

  await context.close();
  return result;
}

async function runMobileLayout(browser) {
  const result = await createOnboardingPage(browser, 'success', { width: 390, height: 844 });
  const { context, page } = result;

  await page.goto('/onboarding', { waitUntil: 'domcontentloaded' });
  await page.getByRole('heading', { name: '초기 운영 설정' }).waitFor({ timeout: 15000 });
  await assertNoRawVisibleText(page, 'onboarding mobile layout');
  await assertNoHorizontalOverflow(page, 'onboarding mobile layout');
  await page.screenshot({ path: '/Users/etlab/paca-onboarding-mobile.png', fullPage: true });

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
    const loadFailure = await runLoadFailure(browser);
    const mobileLayout = await runMobileLayout(browser);
    const happyPath = await runHappyPath(browser);
    [loadFailure, mobileLayout, happyPath].forEach(assertDiagnostics);
    console.log(JSON.stringify({
      loadFailureHits: loadFailure.state.hits,
      mobileLayoutHits: mobileLayout.state.hits,
      happyPathHits: happyPath.state.hits,
      completePayload: happyPath.state.completePayload,
    }, null, 2));
  } finally {
    await browser.close();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
