import assert from 'node:assert/strict';
import { createAuthedContext, launchSmokeBrowser, jsonRoute, normalizePacaApiPath } from './paca-smoke-utils.mjs';
const browser = await launchSmokeBrowser();
const student = { id: 77, name: '합성수시정시', academy_id: 1, student_number: '2026077', gender: 'male',
  student_type: 'exam', school: '합성고', grade: '고3', admission_type: 'both', status: 'active',
  phone: '00000000000', parent_phone: '', class_days: [], weekly_count: 0, monthly_tuition: 0,
  final_monthly_tuition: 0, discount_rate: 0, payment_due_day: 5, is_season_registered: false,
  is_trial: false, enrollment_date: '2026-10-06', time_slot: 'evening', deleted_at: null };
const results = [];
try {
  for (const viewport of [{ width: 1365, height: 900 }, { width: 390, height: 844 }]) {
    const context = await createAuthedContext(browser, viewport); const hits = [];
    await context.route('**/*', async route => {
      const req = route.request(), url = new URL(req.url());
      if (url.hostname !== 'supermax.kr') return route.continue();
      const path = normalizePacaApiPath(url); hits.push({ path, query: url.search, method: req.method() });
      assert.equal(req.method(), 'GET', 'read-only smoke must never write business data');
      if (path === '/students/77') return jsonRoute(route, { student, payments: [], performances: [] });
      if (path === '/students') return jsonRoute(route, { students: [student], pagination: { total: 1 } });
      if (path === '/settings/academy') return jsonRoute(route, { settings: { exam_tuition: {}, adult_tuition: {}, tuition_due_day: 5 } });
      if (path === '/seasons/registerable') return jsonRoute(route, { seasons: [] });
      return jsonRoute(route, { settings: {}, classes: [], seasons: [], instructors: [], notifications: [], unreadCount: 0 });
    });
    const page = await context.newPage(); page.setDefaultTimeout(15000);
    await page.goto('/students/new');
    const admission = page.locator('#field-admission-type'); await admission.waitFor();
    assert.equal(await admission.locator('option[value="both"]').textContent(), '수시+정시');
    await admission.selectOption('both'); assert.equal(await admission.inputValue(), 'both');
    await page.goto('/students/77/edit'); await admission.waitFor();
    assert.equal(await admission.inputValue(), 'both');
    await page.goto('/students');
    const filter = page.locator('select').filter({ has: page.locator('option[value="both"]') });
    await filter.waitFor(); await filter.selectOption('both');
    await page.waitForTimeout(500);
    assert(hits.some(h => h.path === '/students' && h.query.includes('admission_type=both')));
    assert.equal(await filter.inputValue(), 'both');
    results.push({ viewport, create_option: true, edit_preserved: true, filter_sent: true, business_writes: 0 });
    await context.close();
  }
  console.log(JSON.stringify({ status: 'passed', mode: 'production_assets_with_synthetic_read_responses', results }));
} finally { await browser.close(); }
