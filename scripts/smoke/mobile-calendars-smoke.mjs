import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import {
  assertNoHorizontalOverflow, assertNoRawVisibleText, createAuthedContext, createDiagnostics,
  isPacaApiRequest, jsonRoute, launchSmokeBrowser, nonServiceWorkerErrors, normalizePacaApiPath,
} from './paca-smoke-utils.mjs';

const BASE_URL = process.env.PACA_SMOKE_BASE_URL || 'http://localhost:3109';
const OUTPUT_DIR = 'test-results/mobile-calendars';
const TODAY = new Date();
const MONTH = `${TODAY.getFullYear()}-${String(TODAY.getMonth() + 1).padStart(2, '0')}`;
const DAY = `${MONTH}-15`;
const USER = { id: 20, name: '강사', role: 'staff', academy_id: 1, academy: { id: 1, name: 'PACA 일산' }, permissions: {} };
const EVENT = {
  id: 1, academy_id: 1, title: '학원 전체 모의 실기 평가와 입시 설명회',
  description: '운동복과 개인 물병을 준비해주세요.\n오전 수업 후 설명회를 진행합니다.',
  event_type: 'academy', event_date: DAY, is_all_day: false, is_holiday: false,
  start_time: '09:00:00', end_time: '12:00:00', block_consultation: false, color: '#3b82f6',
};
const SCHEDULES = [
  { id: 1, instructor_id: 1, instructor_name: '김강사', work_date: DAY, time_slot: 'morning', scheduled_start_time: '09:00:00', scheduled_end_time: '12:00:00' },
  { id: 2, instructor_id: 1, instructor_name: '김강사', work_date: DAY, time_slot: 'evening', scheduled_start_time: '18:00:00', scheduled_end_time: '21:00:00' },
  { id: 3, instructor_id: 2, instructor_name: '이강사', work_date: DAY, time_slot: 'afternoon', scheduled_start_time: null, scheduled_end_time: null },
  { id: 4, instructor_id: 3, instructor_name: '박이름이긴강사', work_date: DAY, time_slot: 'evening', scheduled_start_time: '18:30:00', scheduled_end_time: '21:00:00' },
];

async function setup(browser, width = 390) {
  const state = { failEvents: false, failSchedules: false, empty: false, hits: [], held: null };
  const context = await createAuthedContext(browser, { width, height: 844 }, BASE_URL);
  await context.addInitScript(user => localStorage.setItem('user', JSON.stringify(user)), USER);
  await context.route('**/*', async route => {
    const request = route.request();
    const url = new URL(request.url());
    if (!isPacaApiRequest(url, BASE_URL)) {
      if (url.origin !== new URL(BASE_URL).origin) return route.abort();
      return route.continue();
    }
    if (request.method() === 'OPTIONS') return jsonRoute(route, {});
    assert.equal(request.method(), 'GET', '조회 화면에서 변경 요청이 발생하면 안 된다');
    assert.equal(request.headers().authorization, 'Bearer smoke-token');
    const path = normalizePacaApiPath(url);
    state.hits.push(`${path}${url.search}`);
    if (path === '/auth/me') return jsonRoute(route, { user: USER });
    if (path === '/academy-events') {
      if (state.failEvents) return jsonRoute(route, { message: 'SQL stack trace HTTP 500' }, 500);
      assert.match(url.searchParams.get('start_date'), /^\d{4}-\d{2}-01$/);
      assert.match(url.searchParams.get('end_date'), /^\d{4}-\d{2}-\d{2}$/);
      const inMonth = url.searchParams.get('start_date').startsWith(MONTH);
      return jsonRoute(route, { events: inMonth && !state.empty ? [EVENT, { ...EVENT, id: 2, title: '학원 휴일', is_all_day: true, is_holiday: true }] : [] });
    }
    if (path === '/schedules/instructor-schedules/calendar') {
      if (state.held) {
        const hold = state.held;
        state.held = null;
        hold.started();
        await hold.promise;
      }
      if (state.failSchedules) return jsonRoute(route, { message: 'SQL stack trace HTTP 500' }, 500);
      const month = `${url.searchParams.get('year')}-${url.searchParams.get('month').padStart(2, '0')}`;
      return jsonRoute(route, {
        year_month: month,
        instructors: [{ id: 1, name: '김강사' }, { id: 2, name: '이강사' }, { id: 3, name: '박이름이긴강사' }, { id: 4, name: '미배정강사' }],
        schedules: month === MONTH && !state.empty ? SCHEDULES : [],
      });
    }
    return jsonRoute(route, {});
  });
  const page = await context.newPage();
  const diagnostics = createDiagnostics(page);
  return { context, page, diagnostics, state };
}

async function ready(page) {
  await page.locator('section[aria-label="월간 달력"][aria-busy="false"]').waitFor();
}

async function runCalendar(browser) {
  const { context, page, diagnostics, state } = await setup(browser);
  await page.goto('/m');
  await page.getByRole('link', { name: /학원일정/ }).click();
  await ready(page);
  await page.getByRole('button', { name: new RegExp(`^${DAY},`) }).click();
  const details = page.getByRole('region', { name: '선택한 날짜의 학원 일정' });
  await details.getByRole('heading', { name: EVENT.title }).waitFor();
  await details.getByText('09:00 ~ 12:00').waitFor();
  await details.getByText('휴일', { exact: true }).waitFor();
  assert.equal(await page.getByRole('button', { name: /추가|수정|삭제|저장/ }).count(), 0);
  await assertNoHorizontalOverflow(page, '학원 일정 390');
  await page.screenshot({ path: `${OUTPUT_DIR}/academy-events-390.png`, fullPage: true });

  await page.getByRole('button', { name: '다음 달', exact: true }).click();
  await ready(page);
  await page.getByText('이번 달에 등록된 학원 일정이 없습니다.').waitFor();
  await page.getByRole('button', { name: '오늘', exact: true }).click();
  await ready(page);
  state.failEvents = true;
  await page.getByRole('button', { name: '일정 새로고침' }).click();
  await page.getByRole('alert').waitFor();
  await assertNoRawVisibleText(page, '학원 일정 오류');
  state.failEvents = false;
  await page.getByRole('button', { name: '다시 시도' }).click();
  await ready(page);
  await page.getByRole('alert').filter({ hasText: '학원 일정을 불러오지 못했습니다.' }).waitFor({ state: 'hidden' });

  await page.getByRole('link', { name: '모바일 홈으로 이동' }).click();
  await page.getByRole('link', { name: /강사 근무달력/ }).click();
  await ready(page);
  const day = page.getByRole('button', { name: new RegExp(`^${DAY},`) });
  await day.click();
  assert.match(await day.innerText(), /김강사/);
  assert.match(await day.innerText(), /\+1/);
  const work = page.getByRole('region', { name: '선택한 날짜의 강사 근무' });
  await work.getByRole('heading', { name: '오전 1명' }).waitFor();
  await work.getByRole('heading', { name: '오후 1명' }).waitFor();
  await work.getByRole('heading', { name: '저녁 2명' }).waitFor();
  await work.getByText('18:30 ~ 21:00').waitFor();
  await page.screenshot({ path: `${OUTPUT_DIR}/instructors-all-390.png`, fullPage: true });
  await page.getByLabel('강사', { exact: true }).selectOption('1');
  assert.match(await day.innerText(), /오전/);
  assert.match(await day.innerText(), /저녁/);
  assert.equal(await work.getByText('이강사', { exact: true }).count(), 0);
  await work.getByText('이번 달 1일 · 2개 시간대 배정').waitFor();
  await page.screenshot({ path: `${OUTPUT_DIR}/instructor-filter-390.png`, fullPage: true });
  await page.getByLabel('강사', { exact: true }).selectOption('4');
  await work.getByText('이번 달에 배정된 근무 일정이 없습니다.').waitFor();
  await page.getByLabel('강사', { exact: true }).selectOption('all');
  await page.getByRole('button', { name: `${MONTH}-01`, exact: true }).click();
  await work.getByText('이 날짜에는 배정된 근무가 없습니다.').waitFor();

  // 느린 이전 달 응답이 현재 달을 덮어쓰지 않아야 한다.
  let release;
  let started;
  const heldStarted = new Promise(resolve => { started = resolve; });
  state.held = { promise: new Promise(resolve => { release = resolve; }), started };
  await page.getByRole('button', { name: '다음 달', exact: true }).click();
  await heldStarted;
  await page.getByRole('status').waitFor();
  await page.getByRole('button', { name: '오늘', exact: true }).click();
  await ready(page);
  release();
  await page.waitForLoadState('networkidle');
  await day.waitFor();
  assert.match(await day.innerText(), /김강사/);

  state.failSchedules = true;
  await page.getByRole('button', { name: '일정 새로고침' }).click();
  await page.getByRole('alert').waitFor();
  await assertNoRawVisibleText(page, '근무 달력 오류');
  state.failSchedules = false;
  await page.getByRole('button', { name: '다시 시도' }).click();
  await ready(page);
  await assertNoHorizontalOverflow(page, '강사 달력 390');
  assert.equal(nonServiceWorkerErrors(diagnostics.pageErrors).length, 0, diagnostics.pageErrors.join('\n'));
  assert.ok(diagnostics.consoleErrors.every(message => /500|service worker|ServiceWorker/i.test(message)), diagnostics.consoleErrors.join('\n'));
  await context.close();
  return state.hits;
}

async function runViewports(browser) {
  for (const width of [320, 768, 1280]) {
    const { context, page, diagnostics } = await setup(browser, width);
    for (const route of ['academy-events', 'instructor-calendar']) {
      await page.goto(`/m/${route}`);
      await ready(page);
      await page.getByRole('button', { name: new RegExp(`^${DAY},`) }).click();
      await assertNoHorizontalOverflow(page, `${route} ${width}`);
      await assertNoRawVisibleText(page, `${route} ${width}`);
      await page.screenshot({ path: `${OUTPUT_DIR}/${route}-${width}.png`, fullPage: true });
    }
    assert.equal(nonServiceWorkerErrors(diagnostics.pageErrors).length, 0);
    await context.close();
  }
  const context = await browser.newContext({ baseURL: BASE_URL });
  const page = await context.newPage();
  await page.goto('/m/instructor-calendar');
  assert.equal(new URL(page.url()).pathname, '/login');
  await context.close();
}

await mkdir(OUTPUT_DIR, { recursive: true });
const browser = await launchSmokeBrowser();
try {
  const hits = await runCalendar(browser);
  await runViewports(browser);
  console.log(JSON.stringify({ result: 'passed', widths: [320, 390, 768, 1280], hits, screenshots: OUTPUT_DIR }, null, 2));
} finally {
  await browser.close();
}
