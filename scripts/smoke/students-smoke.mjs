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
import fs from 'node:fs/promises';

const PHOTO_PNG_BASE64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/p9sAAAAASUVORK5CYII=';
const XLSX_MAGIC_BUFFER = Buffer.from([0x50, 0x4B, 0x03, 0x04, 0x14, 0x00]);

function makeStudent(overrides) {
  return {
    id: 1,
    academy_id: 1,
    student_number: '2026041',
    name: '김진우',
    gender: 'male',
    student_type: 'exam',
    phone: '01011112222',
    parent_phone: '01033334444',
    school: '일산고',
    grade: '고2',
    age: null,
    address: null,
    admission_type: 'regular',
    profile_image_url: null,
    profile_image_key: null,
    profile_thumb_key: null,
    profile_image_updated_at: null,
    class_days: [{ day: 1, timeSlot: 'evening' }, { day: 3, timeSlot: 'evening' }],
    weekly_count: 2,
    monthly_tuition: '520000',
    discount_rate: '10',
    discount_reason: null,
    payment_due_day: 5,
    final_monthly_tuition: '468000',
    is_season_registered: false,
    current_season_id: null,
    status: 'active',
    rest_start_date: null,
    rest_end_date: null,
    rest_reason: null,
    enrollment_date: '2026-03-04',
    withdrawal_date: null,
    notes: null,
    is_trial: false,
    trial_remaining: null,
    trial_dates: null,
    time_slot: 'evening',
    memo: null,
    class_days_next: null,
    class_days_effective_from: null,
    consultation_date: '2026-02-20',
    created_at: '2026-02-20T09:00:00.000Z',
    updated_at: '2026-06-22T09:00:00.000Z',
    deleted_at: null,
    ...overrides,
  };
}

const STUDENTS = [
  makeStudent({
    id: 41,
    name: '김진우',
    school: '일산고',
    status: 'active',
    profile_image_url: '/students/41/photo/thumb',
    profile_image_key: 'academies/1/students/41/profile-original.png',
    profile_thumb_key: 'academies/1/students/41/profile-thumb.png',
    profile_image_updated_at: '2026-07-03T10:00:00.000Z',
  }),
  makeStudent({ id: 42, name: '박서연', gender: 'female', school: '강남고', status: 'active', student_number: '2026042' }),
  makeStudent({ id: 43, name: '이민수', school: '상담대기고', status: 'pending', student_number: '2026043' }),
  makeStudent({ id: 44, name: '최체험', gender: 'female', school: '체험고', status: 'trial', is_trial: true, trial_remaining: 1 }),
  makeStudent({ id: 45, name: '한휴원', school: '휴원고', status: 'paused', rest_start_date: '2026-06-01' }),
];

function makeState(mode) {
  return {
    exportDownloaded: false,
    hits: [],
    importPayloadBytes: 0,
    mode,
    pendingDeletedId: null,
    trialMovePayload: null,
  };
}

function filterStudents(url) {
  const status = url.searchParams.get('status');
  const isTrial = url.searchParams.get('is_trial');
  const search = url.searchParams.get('search')?.trim();

  let students = [...STUDENTS];
  if (isTrial === 'true') students = students.filter((student) => student.is_trial);
  if (isTrial === 'false') students = students.filter((student) => !student.is_trial);
  if (status) students = students.filter((student) => student.status === status);
  if (search) {
    students = students.filter((student) =>
      [student.name, student.phone, student.student_number, student.school].some((value) => value?.includes(search)),
    );
  }

  return students;
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

    if (method === 'GET' && path === '/students/41/photo/thumb') return fulfillPhoto(route);
    if (method === 'GET' && path === '/students/41/photo/original') return fulfillPhoto(route);

    if (method === 'GET' && path === '/exports/students') {
      state.exportDownloaded = true;
      return route.fulfill({
        status: 200,
        contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        headers: {
          'access-control-allow-origin': '*',
          'access-control-expose-headers': 'Content-Disposition',
          'content-disposition': "attachment; filename=\"students_20260704.xlsx\"; filename*=UTF-8''%ED%95%99%EC%83%9D%EB%AA%85%EB%8B%A8_20260704.xlsx",
        },
        body: XLSX_MAGIC_BUFFER,
      });
    }

    if (method === 'GET' && path === '/students') {
      if (state.mode === 'load-error') {
        return jsonRoute(route, { message: 'HTTP 500 DB timeout stack trace' }, 500);
      }

      const students = filterStudents(url);
      return jsonRoute(route, {
        message: 'ok',
        pagination: { total: students.length, page: 1, limit: 100, totalPages: 1 },
        students,
      });
    }

    if (method === 'POST' && path === '/students/import') {
      state.importPayloadBytes = request.postDataBuffer()?.length || 0;
      return jsonRoute(route, {
        message: '학생 엑셀 업로드가 완료되었습니다.',
        summary: { total: 1, created: 1, skipped: 0, failed: 0 },
        results: [{ status: 'created', message: '홍길동 학생을 등록했습니다.' }],
      });
    }

    if (method === 'PUT' && path === '/students/44') {
      state.trialMovePayload = JSON.parse(request.postData() || '{}');
      return jsonRoute(route, { message: 'updated', student: makeStudent({ id: 44, status: 'pending', is_trial: false }) });
    }

    if (method === 'DELETE' && path === '/students/43') {
      if (state.mode === 'pending-delete-error') {
        return jsonRoute(route, { message: 'HTTP 500 DB timeout stack trace' }, 500);
      }

      state.pendingDeletedId = 43;
      return jsonRoute(route, { message: 'deleted' });
    }

    return jsonRoute(route, { message: 'mocked' });
  });
}

async function createStudentsPage(browser, mode, viewport = { width: 1365, height: 900 }) {
  const state = makeState(mode);
  const context = await createAuthedContext(browser, viewport);
  await installRoutes(context, state);
  const page = await context.newPage();
  page.setDefaultTimeout(15000);
  const diagnostics = createDiagnostics(page);
  return { context, page, state, diagnostics };
}

async function clickWithoutNativeDialog(page, locator, label) {
  const nativeDialog = page
    .waitForEvent('dialog', { timeout: 800 })
    .then(async (dialog) => {
      const message = dialog.message();
      await dialog.dismiss();
      return message;
    })
    .catch(() => null);

  await locator.click();
  const message = await nativeDialog;
  if (message) throw new Error(`${label} opened native browser dialog: ${message}`);
}

async function runDesktop(browser) {
  const result = await createStudentsPage(browser, 'success');
  const { context, page, state } = result;

  await page.goto('/students', { waitUntil: 'domcontentloaded' });
  await page.getByRole('heading', { name: '학생 운영', exact: true }).waitFor();
  await waitForStudentsShell(page);
  await page.getByRole('button', { name: /재원생/ }).click();
  const board = page.getByTestId('students-work-queue');
  await board.getByText('학생 운영 보드').waitFor();
  await board.getByText(/현재 목록\s*2명/).first().waitFor();
  await board.getByText(/체험\s*1명/).waitFor();
  await board.getByText(/미등록\s*1명/).waitFor();
  const download = await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('button', { name: '엑셀' }).click(),
  ]).then(([download]) => download);
  const downloadPath = await download.path();
  const downloadedBytes = await fs.readFile(downloadPath);
  if (downloadedBytes[0] !== 0x50 || downloadedBytes[1] !== 0x4B) {
    throw new Error('student excel download did not save an xlsx payload');
  }
  await page.getByText('학생 명단 엑셀을 다운로드했습니다.').waitFor();
  if (!state.exportDownloaded) throw new Error('student export endpoint was not called');

  const uploadPath = '/tmp/paca-student-import-smoke.xlsx';
  await fs.writeFile(uploadPath, XLSX_MAGIC_BUFFER);
  const fileChooserPromise = page.waitForEvent('filechooser');
  await page.getByRole('button', { name: '업로드' }).click();
  const fileChooser = await fileChooserPromise;
  await Promise.all([
    page.waitForResponse((response) => {
      const url = new URL(response.url());
      return response.request().method() === 'POST' && normalizePacaApiPath(url) === '/students/import';
    }),
    fileChooser.setFiles(uploadPath),
  ]);
  await page.getByText('학생 엑셀 업로드 완료: 신규 1명, 중복 0명, 실패 0명').waitFor();
  if (state.importPayloadBytes < XLSX_MAGIC_BUFFER.length) {
    throw new Error(`student import payload too small: ${state.importPayloadBytes}`);
  }

  await board.getByRole('link', { name: '수업일 관리' }).waitFor();
  if ((await board.getByRole('link', { name: '수업일 관리' }).getAttribute('href')) !== '/students/class-days') {
    throw new Error('student class-days quick link mismatch');
  }
  if ((await board.getByRole('link', { name: '상담 관리' }).getAttribute('href')) !== '/consultations/enrolled') {
    throw new Error('student consultation quick link mismatch');
  }
  if ((await board.getByRole('link', { name: '문자 발송' }).getAttribute('href')) !== '/sms') {
    throw new Error('student sms quick link mismatch');
  }
  await board.getByRole('button', { name: '체험 학생 보기' }).click();
  await page.locator('table').getByText('최체험').waitFor();
  await page.locator('table').getByText('김진우').waitFor({ state: 'hidden' });
  await board.getByRole('button', { name: '미등록 학생 보기' }).click();
  await page.locator('table').getByText('이민수').waitFor();
  await page.locator('table').getByText('최체험').waitFor({ state: 'hidden' });
  await board.getByRole('button', { name: '재원 학생 보기' }).click();
  await page.locator('table').getByText('김진우').waitFor();
  await page.locator('table').getByText('박서연').waitFor();
  await page.locator('table').getByRole('button', { name: '김진우 상세 보기' }).waitFor();
  await page.waitForFunction(() => Array.from(document.images).some((image) => image.complete && image.naturalWidth > 0));
  if (!state.hits.some((hit) => hit.startsWith('GET /students/41/photo/thumb'))) {
    throw new Error('student profile photo was not requested on desktop list');
  }
  await page.getByRole('button', { name: '김진우 사진 크게 보기' }).click();
  await page.getByTestId('student-photo-preview-dialog').waitFor();
  await page.getByRole('img', { name: '김진우 사진 확대' }).waitFor();
  if (!state.hits.some((hit) => hit.startsWith('GET /students/41/photo/original'))) {
    throw new Error('student original profile photo was not requested for preview');
  }
  await page.screenshot({ path: '/Users/etlab/paca-student-photo-preview.png', fullPage: true });
  await page.getByRole('button', { name: '닫기' }).click();
  await assertNoRawVisibleText(page, 'students desktop');
  await assertNoHorizontalOverflow(page, 'students desktop');
  await page.screenshot({ path: '/Users/etlab/paca-students-desktop.png', fullPage: true });

  await page.getByRole('button', { name: /미등록관리/ }).click();
  await page.locator('table').getByText('이민수').waitFor();
  await page.getByPlaceholder('이름, 학번, 전화번호로 검색...').fill('이민수');
  const pendingRow = page.locator('tr:has-text("이민수")');
  await pendingRow.waitFor();
  await clickWithoutNativeDialog(page, pendingRow.locator('button').last(), 'pending student delete');
  await page.getByRole('alertdialog').getByRole('heading', { name: '미등록 학생 삭제' }).waitFor();
  await page.screenshot({ path: '/Users/etlab/paca-students-pending-delete-dialog.png', fullPage: true });
  await Promise.all([
    page.waitForResponse((response) => {
      const url = new URL(response.url());
      return response.request().method() === 'DELETE' && normalizePacaApiPath(url) === '/students/43';
    }),
    page.getByRole('button', { name: '삭제' }).click(),
  ]);
  if (state.pendingDeletedId !== 43) {
    throw new Error(`pending delete id mismatch: ${state.pendingDeletedId}`);
  }

  await page.getByPlaceholder('이름, 학번, 전화번호로 검색...').fill('');
  await page.getByRole('button', { name: '체험생 등록 전환' }).click();
  const trialRow = page.locator('tr:has-text("최체험")');
  await trialRow.waitFor();
  await clickWithoutNativeDialog(page, trialRow.getByRole('button', { name: '미등록관리로 이동' }), 'trial move to pending');
  await page.getByRole('alertdialog').getByRole('heading', { name: '미등록관리 이동' }).waitFor();
  await page.screenshot({ path: '/Users/etlab/paca-students-trial-move-dialog.png', fullPage: true });
  await Promise.all([
    page.waitForResponse((response) => {
      const url = new URL(response.url());
      return response.request().method() === 'PUT' && normalizePacaApiPath(url) === '/students/44';
    }),
    page.getByRole('button', { name: '이동' }).click(),
  ]);
  if (state.trialMovePayload?.status !== 'pending' || state.trialMovePayload?.is_trial !== false) {
    throw new Error(`trial move payload mismatch: ${JSON.stringify(state.trialMovePayload)}`);
  }

  await context.close();
  return { diagnostics: result.diagnostics, state };
}

async function runMobile(browser) {
  const result = await createStudentsPage(browser, 'success', { width: 390, height: 844 });
  const { context, page } = result;

  await page.goto('/students', { waitUntil: 'domcontentloaded' });
  await page.getByRole('heading', { name: '학생 운영', exact: true }).waitFor();
  await waitForStudentsShell(page);
  await page.getByTestId('students-work-queue').getByText('학생 운영 보드').waitFor();
  await page.getByTestId('students-work-queue').getByText(/현재 목록\s*2명/).first().waitFor();
  const detailButton = page.getByRole('button', { name: '김진우 상세 보기' });
  await detailButton.waitFor();
  await page.getByText('김진우').first().waitFor();
  await page.getByText('010-1111-2222').first().waitFor();
  await page.getByText('월 학원비').first().waitFor();
  await assertNoRawVisibleText(page, 'students mobile');
  await assertNoHorizontalOverflow(page, 'students mobile');
  await page.screenshot({ path: '/Users/etlab/paca-students-mobile.png', fullPage: true });
  await detailButton.scrollIntoViewIfNeeded();

  await context.close();
  return result;
}

async function waitForStudentsShell(page) {
  await page.getByTestId('students-operations-workspace').waitFor();
  await page.getByTestId('students-work-queue').waitFor();
}

function fulfillPhoto(route) {
  return route.fulfill({
    status: 200,
    contentType: 'image/png',
    headers: { 'access-control-allow-origin': '*' },
    body: Buffer.from(PHOTO_PNG_BASE64, 'base64'),
  });
}

async function runLoadError(browser) {
  const result = await createStudentsPage(browser, 'load-error', { width: 390, height: 844 });
  const { context, page } = result;

  await page.goto('/students', { waitUntil: 'domcontentloaded' });
  await page.getByRole('alert').getByRole('heading', { name: '학생 정보를 불러오지 못했습니다' }).waitFor();
  await page.getByRole('button', { name: '학생 등록' }).waitFor();
  await page.getByRole('button', { name: '다시 불러오기' }).waitFor();
  await assertNoRawVisibleText(page, 'students load error');
  await assertNoHorizontalOverflow(page, 'students load error');
  await page.screenshot({ path: '/Users/etlab/paca-students-error-mobile.png', fullPage: true });

  await context.close();
  return result;
}

async function runPendingDeleteError(browser) {
  const result = await createStudentsPage(browser, 'pending-delete-error');
  const { context, page, state } = result;

  await page.goto('/students', { waitUntil: 'domcontentloaded' });
  await page.getByRole('heading', { name: '학생 운영', exact: true }).waitFor();
  await page.locator('table').getByText('김진우').waitFor();
  await page.getByRole('button', { name: '미등록관리 상담 후속' }).click();
  const pendingRow = page.locator('tr:has-text("이민수")');
  try {
    await pendingRow.waitFor();
  } catch (error) {
    console.error(JSON.stringify({
      hits: state.hits,
      visibleText: await page.locator('body').innerText(),
    }, null, 2));
    await page.screenshot({ path: '/Users/etlab/paca-students-pending-delete-debug.png', fullPage: true });
    throw error;
  }
  await clickWithoutNativeDialog(page, pendingRow.locator('button').last(), 'pending student delete error');
  await page.getByRole('button', { name: '삭제' }).click();
  await page
    .getByRole('alertdialog')
    .getByRole('alert')
    .getByText('학생 삭제를 완료하지 못했습니다. 잠시 후 다시 시도해주세요.')
    .waitFor();
  await assertNoRawVisibleText(page, 'pending delete error');
  await assertNoHorizontalOverflow(page, 'pending delete error');
  await page.screenshot({ path: '/Users/etlab/paca-students-pending-delete-error.png', fullPage: true });

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
    const desktop = await runDesktop(browser);
    const mobile = await runMobile(browser);
    const loadError = await runLoadError(browser);
    const pendingDeleteError = await runPendingDeleteError(browser);
    [desktop, mobile, loadError, pendingDeleteError].forEach(assertDiagnostics);
    console.log(JSON.stringify({
      desktopHits: desktop.state.hits,
      errorConsoleErrors: loadError.diagnostics.consoleErrors,
      errorHits: loadError.state.hits,
      mobileHits: mobile.state.hits,
      normalConsoleErrors: desktop.diagnostics.consoleErrors,
      pendingDeleteErrorConsoleErrors: pendingDeleteError.diagnostics.consoleErrors,
      pendingDeleteErrorHits: pendingDeleteError.state.hits,
    }, null, 2));
  } finally {
    await browser.close();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
