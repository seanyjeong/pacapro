import {
  createAuthedContext,
  createDiagnostics,
  jsonRoute,
  launchSmokeBrowser,
  nonServiceWorkerErrors,
  normalizePacaApiPath,
} from './paca-smoke-utils.mjs';

// 학생 목록의 탭·필터·정렬이 학생 상세의 "목록으로" 뒤에도 그대로 남는지 확인한다.
function makeStudent(overrides) {
  return {
    id: 1,
    academy_id: 1,
    name: '학생',
    gender: 'male',
    student_type: 'exam',
    phone: '01011112222',
    school: '일산고',
    grade: '고2',
    admission_type: 'regular',
    class_days: [{ day: 1, timeSlot: 'evening' }],
    weekly_count: 1,
    monthly_tuition: '300000',
    status: 'active',
    enrollment_date: '2026-03-04',
    is_trial: false,
    trial_dates: null,
    created_at: '2026-02-20T09:00:00.000Z',
    ...overrides,
  };
}

const STUDENTS = [
  makeStudent({ id: 41, name: '김진우' }),
  makeStudent({ id: 42, name: '박서연', school: '강남고', admission_type: 'advance' }),
  makeStudent({ id: 43, name: '이민수', school: '상담대기고', status: 'pending', consultation_date: '2026-10-01' }),
  makeStudent({ id: 47, name: '오미등', school: '가람고', status: 'pending', consultation_date: '2026-10-05' }),
];

function filterStudents(url) {
  const status = url.searchParams.get('status');
  const admissionType = url.searchParams.get('admission_type');
  return STUDENTS.filter((student) => (!status || student.status === status)
    && (!admissionType || student.admission_type === admissionType));
}

async function installRoutes(context) {
  await context.route('**/*', async (route) => {
    const url = new URL(route.request().url());
    if (url.hostname !== 'supermax.kr') return route.continue();
    const path = normalizePacaApiPath(url);
    if (route.request().method() === 'GET' && path === '/students') {
      const students = filterStudents(url);
      return jsonRoute(route, { message: 'ok', pagination: { total: students.length, page: 1, limit: 100, totalPages: 1 }, students });
    }
    return jsonRoute(route, { message: 'mocked' });
  });
}

async function rowNames(page) {
  const text = await page.locator('tbody').innerText();
  return ['오미등', '이민수'].sort((a, b) => text.indexOf(a) - text.indexOf(b));
}

async function main() {
  const browser = await launchSmokeBrowser();
  try {
    const context = await createAuthedContext(browser, { width: 1365, height: 900 });
    await installRoutes(context);
    const page = await context.newPage();
    page.setDefaultTimeout(15000);
    const diagnostics = createDiagnostics(page);
    const goBackToList = () => page.getByRole('button', { name: '목록으로' }).first().click();
    const isListUrl = (search) => (url) => url.pathname === '/students' && url.search === search;

    await page.goto('/students', { waitUntil: 'domcontentloaded' });
    await page.getByTestId('students-operations-workspace').waitFor();
    const admissionFilter = page.locator('label:has-text("입시유형")').locator('..').locator('select');
    await admissionFilter.selectOption('advance');
    await page.locator('table').getByText('김진우').waitFor({ state: 'hidden' });
    await page.locator('th:has-text("학생 정보")').getByRole('button').click();
    await page.locator('table').getByRole('button', { name: '박서연 상세 보기' }).click();
    await page.waitForURL('**/students/42');
    await goBackToList();
    await page.waitForURL(isListUrl('?admission_type=advance&sort=name&dir=asc'));
    await page.locator('table').getByText('박서연').waitFor();
    if ((await admissionFilter.inputValue()) !== 'advance') throw new Error('목록 복귀 후 입시유형 필터가 사라졌습니다.');
    if ((await page.locator('th:has-text("학생 정보")').getAttribute('aria-sort')) !== 'ascending') {
      throw new Error('목록 복귀 후 정렬이 사라졌습니다.');
    }

    await page.getByRole('button', { name: /미등록관리/ }).click();
    await page.locator('table').getByText('오미등').waitFor();
    const schoolHeader = page.locator('th:has-text("학교")');
    await schoolHeader.getByRole('button').click();
    if ((await rowNames(page)).join(',') !== '오미등,이민수') throw new Error('미등록관리 학교 오름차순 정렬이 틀렸습니다.');
    await schoolHeader.getByRole('button').click();
    if ((await rowNames(page)).join(',') !== '이민수,오미등') throw new Error('미등록관리 학교 내림차순 정렬이 틀렸습니다.');
    await page.locator('th:has-text("상담일")').getByRole('button').click();
    await page.locator('th:has-text("상담일")').getByRole('button').click();
    if ((await rowNames(page)).join(',') !== '오미등,이민수') throw new Error('미등록관리 상담일 정렬이 틀렸습니다.');

    await page.getByRole('button', { name: '이민수 새 체험 일정 등록' }).click();
    await page.waitForURL('**/students/43/edit?activate_trial=true');
    await page.goto('/students/43', { waitUntil: 'domcontentloaded' });
    await goBackToList();
    await page.waitForURL(isListUrl('?tab=pending&sort=consultation&dir=desc'));
    await page.locator('table').getByText('이민수').waitFor();
    if ((await rowNames(page)).join(',') !== '오미등,이민수') throw new Error('미등록관리 복귀 후 정렬이 사라졌습니다.');

    await page.goBack({ waitUntil: 'domcontentloaded' });
    await page.goBack({ waitUntil: 'domcontentloaded' });
    await page.waitForURL('**/students/43/edit?activate_trial=true');
    await page.goBack({ waitUntil: 'domcontentloaded' });
    await page.waitForURL(isListUrl('?tab=pending&sort=consultation&dir=desc'));
    await page.locator('table').getByText('오미등').waitFor();

    await page.goto('/students/41', { waitUntil: 'domcontentloaded' });
    await goBackToList();
    await page.waitForURL(isListUrl(''));

    const pageErrors = nonServiceWorkerErrors(diagnostics.pageErrors);
    if (pageErrors.length > 0) throw new Error(`unexpected page errors: ${pageErrors.join(' | ')}`);
    console.log(JSON.stringify({ ok: true, consoleErrors: diagnostics.consoleErrors }, null, 2));
    await context.close();
  } finally {
    await browser.close();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
