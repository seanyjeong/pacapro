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

function makeState(mode = 'success') {
  return {
    hits: [],
    mode,
    savePayload: null,
    studentConsultationPayload: null,
  };
}

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
    preferred_date: '2026-06-24',
    preferred_time: '10:30',
    status: 'pending',
    inquiry_content: '정시 체대 상담 희망',
    created_at: '2026-06-22T09:00:00.000Z',
    updated_at: '2026-06-22T09:00:00.000Z',
    ...overrides,
  };
}

function makeChecklistTemplate() {
  return [
    { id: 1, category: '학생 배경', text: '타학원 경험 확인', input: { type: 'text', label: '학원명' } },
    { id: 2, category: '체력 및 성향', text: '현재 체력 수준', input: { type: 'radio', label: '체력', options: ['상', '중', '하'] } },
    { id: 3, category: '안내 완료', text: '수업료 안내' },
  ];
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

    if (method === 'GET' && path === '/consultations/510') {
      if (state.mode === 'load-error') {
        return jsonRoute(route, { message: 'HTTP 500 DB timeout stack trace' }, 500);
      }
      return jsonRoute(route, makeConsultation());
    }

    if (method === 'GET' && path === '/consultations/520') {
      return jsonRoute(route, makeConsultation({
        id: 520,
        consultation_type: 'learning',
        learning_type: 'admission',
        parent_name: '',
        parent_phone: '',
        linked_student_id: 41,
        linked_student_name: '김진우',
        status: 'confirmed',
      }));
    }

    if (method === 'GET' && path === '/consultations/settings/info') {
      return jsonRoute(route, {
        academy: { id: 1, name: 'PACA 일산', slug: 'paca-ilsan' },
        settings: { checklist_template: makeChecklistTemplate() },
        weeklyHours: [],
        blockedSlots: [],
      });
    }

    if (method === 'GET' && path === '/students/41') {
      return jsonRoute(route, { student: { id: 41, name: '김진우', grade: '고2', school: '일산고' } });
    }

    if (method === 'GET' && path === '/student-consultations/41') {
      return jsonRoute(route, { consultations: [] });
    }

    if (method === 'GET' && path === '/student-consultations/41/peak-records') {
      return jsonRoute(route, {
        found: true,
        records: {
          제자리멀리뛰기: { value: 248, unit: 'cm', direction: 'higher', measured_at: '2026-06-20' },
        },
      });
    }

    if (method === 'PUT' && path === '/consultations/510') {
      state.savePayload = JSON.parse(request.postData() || '{}');
      return jsonRoute(route, { message: 'saved' });
    }

    if (method === 'POST' && path === '/student-consultations') {
      state.studentConsultationPayload = JSON.parse(request.postData() || '{}');
      return jsonRoute(route, { id: 99 });
    }

    return jsonRoute(route, { message: 'mocked' });
  });
}

async function createTabletConductPage(browser, mode = 'success', viewport = { width: 1180, height: 820 }) {
  const state = makeState(mode);
  const context = await createAuthedContext(browser, viewport);
  await installRoutes(context, state);
  const page = await context.newPage();
  page.setDefaultTimeout(15000);
  const diagnostics = createDiagnostics(page);
  return { context, diagnostics, page, state };
}

async function runNewInquiry(browser) {
  const result = await createTabletConductPage(browser);
  const { context, page, state } = result;

  await page.goto('/tablet/consultations/510/conduct', { waitUntil: 'domcontentloaded' });
  await page.getByRole('heading', { name: /상담 진행/ }).waitFor();
  await page.getByRole('heading', { name: '상담 체크리스트' }).waitFor();
  await page.getByText('타학원 경험 확인').click();
  await page.getByPlaceholder('학원명 입력').fill('PACA 테스트');
  await page.getByPlaceholder('상담 중 메모할 내용을 입력하세요...').fill('태블릿 상담 메모');
  await page.getByRole('button', { name: '상담 완료 저장' }).click();
  await page.getByText('상담이 완료 처리되었습니다.').waitFor();

  if (state.savePayload?.status !== 'completed') {
    throw new Error(`tablet save payload mismatch: ${JSON.stringify(state.savePayload)}`);
  }

  await assertNoRawVisibleText(page, 'tablet conduct new inquiry');
  await assertNoHorizontalOverflow(page, 'tablet conduct new inquiry');
  await page.screenshot({ path: '/Users/etlab/paca-tablet-conduct-new-inquiry.png', fullPage: true });

  await context.close();
  return result;
}

async function runLearning(browser) {
  const result = await createTabletConductPage(browser, 'success', { width: 820, height: 1180 });
  const { context, page, state } = result;

  await page.goto('/tablet/consultations/520/conduct', { waitUntil: 'domcontentloaded' });
  await page.getByRole('heading', { name: /재원생 상담/ }).waitFor();
  await page.getByRole('button', { name: '실기 (P-EAK)' }).waitFor();
  await page.getByPlaceholder('학업 관련 메모...').fill('태블릿 정시 전략 점검');
  await page.getByRole('button', { name: '상담 기록 저장' }).click();
  await page.getByText('상담 기록이 저장되었습니다.').waitFor();

  if (state.studentConsultationPayload?.student_id !== 41) {
    throw new Error(`tablet learning payload mismatch: ${JSON.stringify(state.studentConsultationPayload)}`);
  }

  await assertNoRawVisibleText(page, 'tablet conduct learning');
  await assertNoHorizontalOverflow(page, 'tablet conduct learning');
  await page.screenshot({ path: '/Users/etlab/paca-tablet-conduct-learning.png', fullPage: true });

  await context.close();
  return result;
}

async function runLoadError(browser) {
  const result = await createTabletConductPage(browser, 'load-error', { width: 820, height: 1180 });
  const { context, page } = result;

  await page.goto('/tablet/consultations/510/conduct', { waitUntil: 'domcontentloaded' });
  await page.getByRole('heading', { name: '상담 정보를 불러오지 못했습니다' }).waitFor();
  await page.getByText('잠시 후 다시 시도해주세요.').waitFor();
  await assertNoRawVisibleText(page, 'tablet conduct load error');
  await assertNoHorizontalOverflow(page, 'tablet conduct load error');
  await page.screenshot({ path: '/Users/etlab/paca-tablet-conduct-error.png', fullPage: true });

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
    const newInquiry = await runNewInquiry(browser);
    const learning = await runLearning(browser);
    const loadError = await runLoadError(browser);
    [newInquiry, learning, loadError].forEach(assertDiagnostics);
    console.log(JSON.stringify({
      errorHits: loadError.state.hits,
      learningPayload: learning.state.studentConsultationPayload,
      newInquiryPayload: newInquiry.state.savePayload,
    }, null, 2));
  } finally {
    await browser.close();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
