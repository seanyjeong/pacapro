import {
  assertNoHorizontalOverflow,
  assertNoRawVisibleText,
  nonServiceWorkerErrors,
} from './paca-smoke-utils.mjs';

export function assertStudentFormDiagnostics(result) {
  const pageErrors = nonServiceWorkerErrors(result.diagnostics.pageErrors);
  if (pageErrors.length > 0) {
    throw new Error(`unexpected page errors: ${pageErrors.join(' | ')}`);
  }
}

export async function waitForStudentFormUrl(page, urlPattern, state, label) {
  try {
    await page.waitForURL(urlPattern, { timeout: 15000 });
  } catch (error) {
    const alertText = await page.locator('[role="alert"]').allTextContents().catch(() => []);
    throw new Error(
      `${label} navigation failed: ${error.message}\n`
      + `hits=${state.hits.join(' | ')}\n`
      + `fields=${JSON.stringify(state.lastFieldValues || {})}\n`
      + `alerts=${alertText.join(' | ')}`,
    );
  }
}

export async function submitStudentForm(page, label) {
  await page.locator('button[type="submit"]').filter({ hasText: label }).click();
}

export async function clickWithoutNativeDialog(page, locator, label) {
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

export async function runTrialReactivationSmoke(browser, createStudentFormPage) {
  const result = await createStudentFormPage(browser, 'trial-reactivation');
  const { context, page, state } = result;

  await page.goto('/students/77/edit?activate_trial=true', { waitUntil: 'domcontentloaded' });
  await page.getByRole('heading', { name: '새 체험 일정 등록' }).waitFor();
  const trialSection = page.getByTestId('trial-section');
  await trialSection.getByText('체험 일정 수정').waitFor();

  await submitStudentForm(page, '수정');
  await trialSection.getByRole('alert').getByText(
    '오늘 또는 이후의 새 체험 일정을 1개 이상 선택해주세요.',
  ).waitFor();
  if (state.editPayload) throw new Error('stale trial dates must not send an update request');

  await trialSection.getByRole('button', { name: '일정 추가' }).click();
  await trialSection.locator('input[type="date"]').last().fill('2099-01-01');
  await submitStudentForm(page, '수정');
  await waitForStudentFormUrl(page, '**/students/77', state, 'trial reactivation');

  if (state.editPayload?.status !== 'trial' || state.editPayload?.is_trial !== true) {
    throw new Error(`trial activation status mismatch: ${JSON.stringify(state.editPayload)}`);
  }
  if (state.editPayload?.trial_remaining !== 1) {
    throw new Error(`trial activation remaining mismatch: ${JSON.stringify(state.editPayload)}`);
  }
  await assertNoRawVisibleText(page, 'trial reactivation');
  await assertNoHorizontalOverflow(page, 'trial reactivation');

  await context.close();
  return result;
}
