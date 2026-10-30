// Run with ego-browser in an existing TaskSpace after installing google-integration-fixture.mjs.
// This function never launches a browser or calls the production API.
export async function checkGoogleIntegration(page) {
  const assert = (condition, message) => { if (!condition) throw new Error(message); };
  const checked = key => page.evaluate(key => document.getElementById(`google-${key}`).getAttribute('aria-checked') === 'true', key);
  await page.waitForSelector('#google-calendar');
  for (const key of ['calendar', 'drive', 'sheets']) {
    const before = await checked(key);
    await page.click(`#google-${key}`);
    await page.waitForFunction(({ key, before }) => document.getElementById(`google-${key}`).getAttribute('aria-checked') === String(!before), { key, before });
    assert(await checked(key) !== before, `${key} toggle did not persist`);
  }
  const beforeFailure = await checked('calendar');
  await page.evaluate(() => { window.__googleFixture.fail = true; });
  await page.click('#google-calendar');
  await page.waitForSelector('#google-integration [role="alert"]');
  assert(await checked('calendar') === beforeFailure, 'Failed setting changed the visible state');
  await page.evaluate(() => { window.__googleFixture.fail = false; });
  await page.click('loc=role:button[name="다시 불러오기"]');
  await page.waitForFunction(() => !document.querySelector('#google-integration [role="alert"]'));
  await page.click('loc=role:button[name="연결 해제"]');
  await page.waitForSelector('text="연결된 구글 계정 없음"');
  assert(await page.evaluate(() => ['calendar', 'drive', 'sheets'].every(key => document.getElementById(`google-${key}`).disabled)), 'Disconnected service switches must be disabled');
  const evidence = await page.evaluate(() => ({
    disconnected: !window.__googleFixture.state.connected,
    hits: window.__googleFixture.hits.filter(path => path.includes('/google-integration')),
    overflow: document.documentElement.scrollWidth > innerWidth,
  }));
  assert(!evidence.overflow, 'Horizontal page overflow');
  return evidence;
}
