import {
  createAuthedContext,
  createDiagnostics,
  installFakeAttendanceSocket,
  jsonRoute,
  launchSmokeBrowser,
  nonServiceWorkerErrors,
  normalizePacaApiPath,
} from './paca-smoke-utils.mjs';

function formatDate(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

const today = formatDate(new Date());
const range = {
  start: formatDate(new Date(new Date().getFullYear(), new Date().getMonth(), 1)),
  end: formatDate(new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0)),
};

const students = Array.from({ length: 36 }, (_, index) => ({
  student_id: 1000 + index,
  student_name: `스크롤학생${String(index + 1).padStart(2, '0')}`,
  grade: index % 3 === 0 ? '고3' : index % 3 === 1 ? '고2' : '고1',
  attendance_status: null,
  notes: null,
  season_type: index === 0 ? 'regular' : null,
  is_trial: false,
  trial_remaining: null,
  is_makeup: false,
}));

const schedule = {
  id: 901,
  class_date: today,
  time_slot: 'afternoon',
  instructor_id: 3,
  instructor_name: '박코치',
  title: '오후 실기 집중반',
  content: '스크롤 회귀 테스트',
  attendance_taken: false,
  notes: null,
  student_count: students.length,
  trial_count: 0,
};

async function installRoutes(context, state) {
  await context.route('**/*', async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    if (url.hostname !== 'supermax.kr') return route.continue();

    const method = request.method();
    const path = normalizePacaApiPath(url);
    state.hits.push(`${method} ${path}${url.search}`);

    if (method === 'GET' && path === '/schedules') {
      return jsonRoute(route, { schedules: [schedule] });
    }
    if (method === 'GET' && path === '/schedules/slot') {
      return jsonRoute(route, { schedule: { ...schedule, students }, available_students: [] });
    }
    if (method === 'POST' && path === '/schedules/901/attendance') {
      state.submissions.push(request.postDataJSON());
      return jsonRoute(route, { success: true });
    }
    if (method === 'GET' && path === `/schedules/date/${today}/instructor-attendance`) {
      const instructor = { id: 3, name: '박코치', salary_type: 'hourly' };
      return jsonRoute(route, {
        attendances: [],
        instructors: [instructor],
        instructors_by_slot: { afternoon: [instructor] },
      });
    }
    if (method === 'GET' && path === '/schedules/instructor-schedules/month') {
      return jsonRoute(route, {
        schedules: {
          [today]: {
            morning: { scheduled: 0, attended: 0 },
            afternoon: { scheduled: 1, attended: 0 },
            evening: { scheduled: 0, attended: 0 },
          },
        },
      });
    }
    if (method === 'GET' && path === '/consultations/calendar/events') {
      return jsonRoute(route, { events: {} });
    }
    if (method === 'GET' && path === '/instructors/overtime/pending') {
      return jsonRoute(route, { requests: [] });
    }

    return jsonRoute(route, { message: 'mocked' });
  });
}

async function main() {
  const browser = await launchSmokeBrowser();
  const state = { hits: [], submissions: [] };
  try {
    const context = await createAuthedContext(browser, { width: 1180, height: 820 });
    await installFakeAttendanceSocket(context);
    await installRoutes(context, state);
    const page = await context.newPage();
    const diagnostics = createDiagnostics(page);

    await page.goto('/schedules', { waitUntil: 'networkidle' });
    await page.getByRole('heading', { name: '수업 관리' }).waitFor();
    await page.locator('[aria-label="오후"]').filter({ hasText: String(students.length) }).click();
    await page.getByRole('dialog').getByText('스크롤학생36').waitFor();

    const dialog = page.getByRole('dialog');
    const scroller = dialog.locator('div.overflow-y-auto').first();
    const lastPresentButton = dialog.getByRole('button', { name: '출석' }).last();
    await lastPresentButton.scrollIntoViewIfNeeded();
    const before = await scroller.evaluate((element) => element.scrollTop);
    if (before < 120) throw new Error(`slot modal did not scroll enough before attendance: ${before}`);

    await lastPresentButton.click();
    await page.waitForTimeout(30);
    await page.evaluate(() => window.__emitPacaAttendanceUpdate?.(901));
    await page.getByRole('dialog').getByText('스크롤학생36').waitFor();
    await page.waitForTimeout(180);

    const after = await scroller.evaluate((element) => element.scrollTop);
    if (after < before - 40) {
      throw new Error(`slot attendance refresh moved modal scroll from ${before} to ${after}`);
    }

    if (!state.submissions.length) throw new Error('attendance save endpoint was not called');
    const pageErrors = nonServiceWorkerErrors(diagnostics.pageErrors);
    if (pageErrors.length > 0) throw new Error(`unexpected page errors: ${pageErrors.join(' | ')}`);

    await context.close();
    console.log(JSON.stringify({ before, after, hits: state.hits, submissions: state.submissions }, null, 2));
  } finally {
    await browser.close();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
