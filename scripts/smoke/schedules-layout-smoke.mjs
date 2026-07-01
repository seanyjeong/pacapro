import {
  assertNoHorizontalOverflow,
  createAuthedContext,
  jsonRoute,
  launchSmokeBrowser,
  normalizePacaApiPath,
} from './paca-smoke-utils.mjs';

const BASE_URL = process.env.PACA_SMOKE_BASE_URL || 'http://localhost:3109';
const CALENDAR_RESIZE_DELTA = 160;
const EXPANDED_PANEL_MIN_WIDTH = 300;
const RAIL_MAX_WIDTH = 64;
const SLOT_MIN_WIDTH = 110;

function formatDate(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function monthRange(date = new Date()) {
  return {
    end: formatDate(new Date(date.getFullYear(), date.getMonth() + 1, 0)),
    month: date.getMonth(),
    start: formatDate(new Date(date.getFullYear(), date.getMonth(), 1)),
    today: formatDate(date),
    year: date.getFullYear(),
  };
}

const range = monthRange();

const schedules = [
  {
    id: 101,
    class_date: range.today,
    time_slot: 'afternoon',
    instructor_id: 3,
    instructor_name: '박코치',
    title: '오후 실기 집중반',
    content: '기초 체력 및 기록 점검',
    attendance_taken: false,
    notes: '실내',
    student_count: 8,
    trial_count: 1,
    created_at: `${range.today}T09:00:00Z`,
    updated_at: `${range.today}T09:00:00Z`,
  },
];

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
    state.hits.push(`${method} ${path}${url.search}`);

    if (method === 'GET' && path === '/settings/academy') return jsonRoute(route, { message: 'ok', settings: {} });
    if (method === 'GET' && path === '/consultations') return jsonRoute(route, { consultations: [] });
    if (method === 'GET' && path === '/schedules') return jsonRoute(route, { schedules });
    if (method === 'GET' && path === '/schedules/instructor-schedules/month') {
      return jsonRoute(route, {
        schedules: {
          [range.today]: {
            morning: { scheduled: 1, attended: 1 },
            afternoon: { scheduled: 2, attended: 1 },
            evening: { scheduled: 1, attended: 0 },
          },
        },
      });
    }
    if (method === 'GET' && path === '/consultations/calendar/events') {
      return jsonRoute(route, { events: { [range.today]: [{ id: 1, student_name: '상담학생' }] } });
    }
    if (method === 'GET' && path === '/instructors/overtime/pending') {
      return jsonRoute(route, { requests: [{ id: 7 }] });
    }

    return jsonRoute(route, { message: 'mocked' });
  });
}

async function readScheduleDeskLayout(page) {
  await page.waitForFunction(() => document.querySelectorAll('[aria-label="오전"]').length >= 7);
  return page.evaluate(() => {
    const slotWidths = [...document.querySelectorAll('[aria-label="오전"]')]
      .map((node) => node.getBoundingClientRect().width)
      .filter((width) => width > 0);
    const board = document.querySelector('[data-testid="schedules-operations-board"]');
    const calendar = [...document.querySelectorAll('h3')]
      .find((node) => /\d{4}년\s+\d{1,2}월/.test(node.textContent || ''))
      ?.closest('div.rounded-xl, div.rounded-lg, div.rounded-md, div[class*="rounded"]');
    if (!board || !calendar || slotWidths.length === 0) return null;
    const boardRect = board.getBoundingClientRect();
    const calendarRect = calendar.getBoundingClientRect();
    return {
      boardLeft: Math.round(boardRect.left),
      boardTop: Math.round(boardRect.top),
      calendarWidth: Math.round(calendarRect.width),
      calendarRight: Math.round(calendarRect.right),
      calendarTop: Math.round(calendarRect.top),
      minSlotWidth: Math.round(Math.min(...slotWidths)),
    };
  });
}

async function assertCalendarHasDeskWidth(page) {
  const layout = await readScheduleDeskLayout(page);

  if (!layout) throw new Error('schedule board/calendar layout was not measurable');
  if (layout.minSlotWidth < SLOT_MIN_WIDTH) {
    throw new Error(`schedule calendar slot is too narrow: ${layout.minSlotWidth}px`);
  }
  if (layout.boardLeft > layout.calendarRight && layout.boardTop <= layout.calendarTop) {
    throw new Error('schedule operations board still competes with the calendar width at 1365px');
  }
}

async function assertInstructorPanelResizesCalendar(page) {
  const rail = page.locator('button[title="강사 근무 패널 펼치기"]');
  const railBox = await rail.boundingBox();
  if (!railBox) throw new Error('collapsed instructor rail is not visible on desktop');
  if (railBox.width > RAIL_MAX_WIDTH) {
    throw new Error(`collapsed instructor rail is too wide: ${Math.round(railBox.width)}px`);
  }

  const collapsed = await readScheduleDeskLayout(page);
  if (!collapsed) throw new Error('collapsed calendar layout was not measurable');
  await rail.click();
  await page.waitForFunction((minWidth) => {
    const closeButton = document.querySelector('button[title="패널 접기"]');
    return (closeButton?.getBoundingClientRect().width || 0) >= minWidth;
  }, EXPANDED_PANEL_MIN_WIDTH);
  const expandedToggleBox = await page.locator('button[title="패널 접기"]').boundingBox();
  const expanded = await readScheduleDeskLayout(page);

  if (!expandedToggleBox || expandedToggleBox.width < EXPANDED_PANEL_MIN_WIDTH) {
    throw new Error(`expanded instructor panel is too narrow: ${Math.round(expandedToggleBox?.width || 0)}px`);
  }
  if (!expanded || collapsed.calendarWidth - expanded.calendarWidth < CALENDAR_RESIZE_DELTA) {
    throw new Error(`calendar did not shrink with expanded instructor panel: ${collapsed?.calendarWidth}px -> ${expanded?.calendarWidth}px`);
  }

  await page.locator('button[title="패널 접기"]').click();
  await page.waitForFunction((maxWidth) => {
    const railButton = document.querySelector('button[title="강사 근무 패널 펼치기"]');
    return (railButton?.getBoundingClientRect().width || Number.POSITIVE_INFINITY) <= maxWidth;
  }, RAIL_MAX_WIDTH);
  const recollapsed = await readScheduleDeskLayout(page);
  if (!recollapsed || recollapsed.calendarWidth < collapsed.calendarWidth - 8) {
    throw new Error(`calendar did not recover after panel collapse: ${expanded?.calendarWidth}px -> ${recollapsed?.calendarWidth}px`);
  }
}

async function main() {
  const browser = await launchSmokeBrowser();
  try {
    const context = await createAuthedContext(browser, { width: 1365, height: 900 });
    const state = { externalContinues: [], hits: [] };
    await installRoutes(context, state);
    const page = await context.newPage();

    await page.goto('/schedules', { waitUntil: 'networkidle' });
    await page.getByTestId('schedules-workspace').waitFor();
    await page.getByRole('heading', { name: '수업 관리' }).waitFor();
    await assertCalendarHasDeskWidth(page);
    await assertInstructorPanelResizesCalendar(page);
    await assertNoHorizontalOverflow(page, 'schedules layout desktop');
    await page.screenshot({ path: '/Users/etlab/paca-schedules-layout-desktop.png', fullPage: true });

    await context.close();
    console.log(JSON.stringify({ hits: state.hits }, null, 2));
  } finally {
    await browser.close();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
