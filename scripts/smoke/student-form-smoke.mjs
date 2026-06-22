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

function makeStudent(overrides = {}) {
  return {
    id: 77,
    academy_id: 1,
    student_number: '2026077',
    name: '김신규',
    gender: 'male',
    student_type: 'exam',
    phone: '010-2222-3333',
    parent_phone: '',
    school: '일산고',
    grade: '고2',
    age: null,
    address: null,
    admission_type: 'regular',
    profile_image_url: null,
    class_days: [],
    weekly_count: 0,
    monthly_tuition: '0',
    discount_rate: '0',
    discount_reason: null,
    payment_due_day: 5,
    final_monthly_tuition: '0',
    is_season_registered: false,
    current_season_id: null,
    status: 'active',
    rest_start_date: null,
    rest_end_date: null,
    rest_reason: null,
    enrollment_date: '2026-06-22',
    withdrawal_date: null,
    notes: null,
    is_trial: false,
    trial_remaining: null,
    trial_dates: null,
    time_slot: 'evening',
    memo: null,
    class_days_next: null,
    class_days_effective_from: null,
    consultation_date: null,
    created_at: '2026-06-22T09:00:00.000Z',
    updated_at: '2026-06-22T09:00:00.000Z',
    deleted_at: null,
    ...overrides,
  };
}

function makeState(mode) {
  return { editPayload: null, hits: [], mode, studentPayload: null, studentPayloads: [] };
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

    if (method === 'GET' && path === '/settings/academy') {
      return jsonRoute(route, {
        settings: {
          exam_tuition: {
            weekly_1: 260000,
            weekly_2: 520000,
            weekly_3: 690000,
            weekly_4: 840000,
            weekly_5: 980000,
            weekly_6: 1100000,
            weekly_7: 1200000,
          },
          adult_tuition: {
            weekly_1: 180000,
            weekly_2: 320000,
            weekly_3: 450000,
            weekly_4: 580000,
            weekly_5: 700000,
            weekly_6: 820000,
            weekly_7: 900000,
          },
          tuition_due_day: 5,
          morning_class_time: '09:00-12:00',
          afternoon_class_time: '13:00-18:00',
          evening_class_time: '18:00-21:00',
        },
      });
    }

    if (method === 'GET' && path === '/seasons/active') {
      return jsonRoute(route, { seasons: [] });
    }

    if (method === 'POST' && path === '/students') {
      state.studentPayload = JSON.parse(request.postData() || '{}');
      state.studentPayloads.push(state.studentPayload);
      if (state.mode === 'same-name-warning' && !state.studentPayload.confirm_force) {
        return jsonRoute(route, {
          code: 'SAME_NAME_EXISTS',
          existingStudent: { gender: 'male', name: '김신규', phone: '010-9999-0000' },
          message: 'same name',
        }, 409);
      }
      if (state.mode === 'save-error') {
        return jsonRoute(route, { message: 'HTTP 500 DB timeout stack trace' }, 500);
      }
      return jsonRoute(route, { message: 'created', student: makeStudent({ name: state.studentPayload.name }) });
    }

    if (method === 'GET' && path === '/students/77') {
      if (state.mode === 'edit-load-error') {
        return jsonRoute(route, { message: 'HTTP 500 DB timeout stack trace' }, 500);
      }
      return jsonRoute(route, {
        message: 'ok',
        payments: [],
        performances: [],
        student: makeStudent({ id: 77, name: '김수정', phone: '010-7777-8888' }),
      });
    }

    if (method === 'PUT' && path === '/students/77') {
      state.editPayload = JSON.parse(request.postData() || '{}');
      if (state.mode === 'edit-save-error') {
        return jsonRoute(route, { message: 'HTTP 500 DB timeout stack trace' }, 500);
      }
      return jsonRoute(route, { message: 'updated', student: makeStudent({ id: 77, name: state.editPayload.name }) });
    }

    if (method === 'GET' && path === '/students') {
      return jsonRoute(route, { message: 'ok', students: [makeStudent()], pagination: { total: 1 } });
    }

    return jsonRoute(route, { message: 'mocked' });
  });
}

async function createStudentFormPage(browser, mode, viewport = { width: 1365, height: 900 }) {
  const state = makeState(mode);
  const context = await createAuthedContext(browser, viewport);
  await installRoutes(context, state);
  const page = await context.newPage();
  page.setDefaultTimeout(15000);
  const diagnostics = createDiagnostics(page);
  return { context, page, state, diagnostics };
}

async function fillRequiredStudentFields(page) {
  await page.waitForLoadState('networkidle', { timeout: 10000 }).catch(() => {});
  await page.locator('#field-name').fill('김신규');
  await page.locator('#field-phone').fill('010-2222-3333');
  await page.locator('#field-grade').selectOption('고2');
}

async function readRequiredStudentFields(page) {
  const validity = await page.locator('form').evaluate((form) => {
    const fields = Array.from(form.querySelectorAll('input, select, textarea')).map((field) => {
      const input = field;
      return {
        id: input.id || '',
        name: input.getAttribute('name') || '',
        required: input.hasAttribute('required'),
        validationMessage: input.validationMessage || '',
        value: input.value || '',
        valid: input.checkValidity(),
      };
    });
    return { formValid: form.checkValidity(), fields: fields.filter((field) => !field.valid || field.required) };
  });
  return {
    grade: await page.locator('#field-grade').inputValue().catch(() => ''),
    name: await page.locator('#field-name').inputValue().catch(() => ''),
    phone: await page.locator('#field-phone').inputValue().catch(() => ''),
    submitDisabled: await page.getByRole('button', { name: /^등록$/ }).isDisabled().catch(() => null),
    validity,
  };
}

async function submitStudentForm(page, label) {
  await page.getByRole('button', { name: label }).click();
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

async function runCreateSuccess(browser) {
  const result = await createStudentFormPage(browser, 'success');
  const { context, page, state } = result;

  await page.goto('/students/new', { waitUntil: 'domcontentloaded' });
  await page.getByRole('heading', { name: '학생 등록' }).waitFor();
  await page.getByText('학원비 자동 계산').waitFor();
  await fillRequiredStudentFields(page);
  await assertNoRawVisibleText(page, 'student form create input');
  await assertNoHorizontalOverflow(page, 'student form create input');
  await page.screenshot({ path: '/Users/etlab/paca-student-form-create-input.png', fullPage: true });
  state.lastFieldValues = await readRequiredStudentFields(page);
  await submitStudentForm(page, '등록');
  await waitForUrlWithDiagnostics(page, '**/students', state, 'create success');

  if (!state.studentPayload) throw new Error('student create payload was not sent');
  if (state.studentPayload.name !== '김신규') throw new Error(`name mismatch: ${state.studentPayload.name}`);
  if (state.studentPayload.phone !== '010-2222-3333') throw new Error(`phone mismatch: ${state.studentPayload.phone}`);
  if (state.studentPayload.grade !== '고2') throw new Error(`grade mismatch: ${state.studentPayload.grade}`);

  await assertNoRawVisibleText(page, 'student form create success');
  await assertNoHorizontalOverflow(page, 'student form create success');
  await page.screenshot({ path: '/Users/etlab/paca-student-form-create.png', fullPage: true });

  await context.close();
  return result;
}

async function runCreateError(browser) {
  const result = await createStudentFormPage(browser, 'save-error', { width: 390, height: 844 });
  const { context, page } = result;

  await page.goto('/students/new', { waitUntil: 'domcontentloaded' });
  await page.getByRole('heading', { name: '학생 등록' }).waitFor();
  await fillRequiredStudentFields(page);
  await submitStudentForm(page, '등록');
  await page.getByText('저장 실패').waitFor();
  await page.getByText('학생 정보를 저장하지 못했습니다. 잠시 후 다시 시도해주세요.').waitFor();
  await assertNoRawVisibleText(page, 'student form create error');
  await assertNoHorizontalOverflow(page, 'student form create error');
  await page.screenshot({ path: '/Users/etlab/paca-student-form-error-mobile.png', fullPage: true });

  await context.close();
  return result;
}

async function runCreateSameNameWarning(browser) {
  const result = await createStudentFormPage(browser, 'same-name-warning');
  const { context, page, state } = result;

  await page.goto('/students/new', { waitUntil: 'domcontentloaded' });
  await page.getByRole('heading', { name: '학생 등록' }).waitFor();
  await fillRequiredStudentFields(page);
  await clickWithoutNativeDialog(page, page.getByRole('button', { name: '등록' }), 'same name save');
  await page.getByRole('alertdialog').getByRole('heading', { name: '같은 이름 학생 확인' }).waitFor();
  await page.getByText('010-9999-0000').waitFor();
  await page.screenshot({ path: '/Users/etlab/paca-student-form-same-name-dialog.png', fullPage: true });
  await page.getByRole('button', { name: '그래도 저장' }).click();
  await waitForUrlWithDiagnostics(page, '**/students', state, 'same name create');

  if (state.studentPayloads.length !== 2) {
    throw new Error(`expected two create attempts: ${JSON.stringify(state.studentPayloads)}`);
  }
  if (state.studentPayloads[1].confirm_force !== true) {
    throw new Error(`same name confirm_force mismatch: ${JSON.stringify(state.studentPayloads[1])}`);
  }

  await context.close();
  return result;
}

async function runEditSuccess(browser) {
  const result = await createStudentFormPage(browser, 'success');
  const { context, page } = result;

  await page.goto('/students/77/edit', { waitUntil: 'domcontentloaded' });
  await page.getByRole('heading', { name: '학생 정보 수정' }).waitFor();
  await page.getByText('변경 저장 방식').waitFor();
  await page.locator('#field-name').waitFor();
  await page.locator('#field-name').fill('김수정완료');
  await page.getByRole('button', { name: '월' }).click();
  await assertNoRawVisibleText(page, 'student form edit class days');
  await assertNoHorizontalOverflow(page, 'student form edit class days');
  await page.screenshot({ path: '/Users/etlab/paca-student-edit-classdays.png', fullPage: true });
  await page.waitForLoadState('networkidle', { timeout: 10000 }).catch(() => {});
  await clickWithoutNativeDialog(page, page.getByRole('button', { name: '수정' }), 'class day edit save');
  await page.getByRole('alertdialog').getByRole('heading', { name: '수업요일 즉시 변경' }).waitFor();
  await page.screenshot({ path: '/Users/etlab/paca-student-edit-immediate-dialog.png', fullPage: true });
  await page.getByRole('button', { name: '즉시 변경하고 저장' }).click();
  await waitForUrlWithDiagnostics(page, '**/students/77', result.state, 'edit success');

  if (!result.state.editPayload) throw new Error('student edit payload was not sent');
  if (result.state.editPayload.name !== '김수정완료') throw new Error(`edit name mismatch: ${result.state.editPayload.name}`);
  if (result.state.editPayload.effective_from !== undefined) {
    throw new Error(`immediate edit should not send effective_from: ${JSON.stringify(result.state.editPayload)}`);
  }
  if (!result.state.editPayload.class_days?.some((slot) => slot.day === 1 && slot.timeSlot === 'evening')) {
    throw new Error(`class day payload mismatch: ${JSON.stringify(result.state.editPayload.class_days)}`);
  }

  await assertNoRawVisibleText(page, 'student form edit success');
  await assertNoHorizontalOverflow(page, 'student form edit success');

  await context.close();
  return result;
}

async function runEditError(browser) {
  const result = await createStudentFormPage(browser, 'edit-save-error', { width: 390, height: 844 });
  const { context, page } = result;

  await page.goto('/students/77/edit', { waitUntil: 'domcontentloaded' });
  await page.getByRole('heading', { name: '학생 정보 수정' }).waitFor();
  await page.locator('#field-name').fill('김수정실패');
  await page.waitForLoadState('networkidle', { timeout: 10000 }).catch(() => {});
  await submitStudentForm(page, '수정');
  await page.getByText('저장 실패').waitFor();
  await page.getByText('학생 정보를 저장하지 못했습니다. 잠시 후 다시 시도해주세요.').waitFor();
  await assertNoRawVisibleText(page, 'student form edit error');
  await assertNoHorizontalOverflow(page, 'student form edit error');
  await page.screenshot({ path: '/Users/etlab/paca-student-edit-error-mobile.png', fullPage: true });

  await context.close();
  return result;
}

async function runEditLoadError(browser) {
  const result = await createStudentFormPage(browser, 'edit-load-error', { width: 390, height: 844 });
  const { context, page } = result;

  await page.goto('/students/77/edit', { waitUntil: 'domcontentloaded' });
  await page.getByRole('heading', { name: '학생 정보 수정' }).waitFor({ timeout: 15000 });
  await page.getByText('학생 정보를 불러오지 못했습니다. 잠시 후 다시 시도해주세요.').waitFor();
  await page.getByRole('button', { name: '다시 불러오기' }).waitFor();
  await assertNoRawVisibleText(page, 'student form edit load error');
  await assertNoHorizontalOverflow(page, 'student form edit load error');
  await page.screenshot({ path: '/Users/etlab/paca-student-edit-load-error-mobile.png', fullPage: true });

  await context.close();
  return result;
}

function assertDiagnostics(result) {
  const pageErrors = nonServiceWorkerErrors(result.diagnostics.pageErrors);
  if (pageErrors.length > 0) throw new Error(`unexpected page errors: ${pageErrors.join(' | ')}`);
}

async function waitForUrlWithDiagnostics(page, urlPattern, state, label) {
  try {
    await page.waitForURL(urlPattern, { timeout: 15000 });
  } catch (error) {
    const alertText = await page.locator('[role="alert"]').allTextContents().catch(() => []);
    throw new Error(`${label} navigation failed: ${error.message}\nhits=${state.hits.join(' | ')}\nfields=${JSON.stringify(state.lastFieldValues || {})}\nalerts=${alertText.join(' | ')}`);
  }
}

async function main() {
  const browser = await launchSmokeBrowser();
  try {
    const createSuccess = await runCreateSuccess(browser);
    const createError = await runCreateError(browser);
    const createSameName = await runCreateSameNameWarning(browser);
    const editSuccess = await runEditSuccess(browser);
    const editError = await runEditError(browser);
    const editLoadError = await runEditLoadError(browser);
    [createSuccess, createError, createSameName, editSuccess, editError, editLoadError].forEach(assertDiagnostics);
    console.log(JSON.stringify({
      createHits: createSuccess.state.hits,
      createPayload: createSuccess.state.studentPayload,
      errorConsoleErrors: createError.diagnostics.consoleErrors,
      errorHits: createError.state.hits,
      sameNameHits: createSameName.state.hits,
      sameNamePayloads: createSameName.state.studentPayloads,
      editHits: editSuccess.state.hits,
      editPayload: editSuccess.state.editPayload,
      editErrorHits: editError.state.hits,
      editLoadErrorHits: editLoadError.state.hits,
    }, null, 2));
  } finally {
    await browser.close();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
