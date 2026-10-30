const assert = require('node:assert/strict');
const path = require('node:path');
const fs = require('node:fs/promises');
const { chromium } = require('playwright');
const { ACADEMY_ID, PUBLIC_FORM_PATH } = require('../../constants/ilsanAdmission');
const { open } = require('../../services/ilsanAdmissionCodec');
const release = require('../../../src/constants/release.json');

async function verifyAdmissionLinkBrowser({ app, pool, token, otherToken, readerToken }) {
  const baseURL = process.env.PACA_ADMISSION_LINK_BASE_URL;
  const origin = new URL(baseURL).origin;
  assert.ok(['localhost', '127.0.0.1'].includes(new URL(origin).hostname));
  const server = await new Promise(resolve => {
    const listener = app.listen(0, '127.0.0.1', () => resolve(listener));
  });
  const browser = await chromium.launch({
    executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true,
  });
  const evidence = path.resolve(__dirname, '../../../test-results/admission-link');
  await fs.mkdir(evidence, { recursive: true });
  const submissions = [];

  async function contextFor(authToken, user = {}, options = {}) {
    const context = await browser.newContext({
      baseURL: origin, viewport: {width:1440,height:1000}, serviceWorkers: 'block', ...options,
    });
    await context.addInitScript(({authToken,user,version}) => {
      localStorage.setItem('app_version', version);
      sessionStorage.setItem('version_reload_attempt', version);
      if (authToken) {
        localStorage.setItem('token', authToken);
        localStorage.setItem('user', JSON.stringify(user));
      }
      // No realtime connection may leave the isolated browser fixture.
      window.WebSocket = class extends EventTarget {
        static OPEN = 1;
        readyState = 1;
        send() {}
        close() {}
      };
    }, {authToken,user,version:release.version});
    if (authToken) await context.addCookies([{name:'paca_auth',value:'1',url:origin}]);
    await context.route('**/*', async route => {
      const request = route.request(), url = new URL(request.url());
      if (url.origin === origin) return route.continue();
      if (url.origin !== 'https://supermax.kr') return route.abort();
      if (url.pathname.startsWith('/paca/ilsan-admissions')) {
        if (url.pathname.endsWith('/submit')) submissions.push({
          authorization: request.headers().authorization,
          body: request.postDataJSON(),
        });
        const response = await route.fetch({
          url:`http://127.0.0.1:${server.address().port}${url.pathname}${url.search}`,
        });
        return route.fulfill({response,headers:{...response.headers(),'access-control-allow-origin':origin}});
      }
      return route.fulfill({json:{},headers:{'access-control-allow-origin':origin}});
    });
    return context;
  }

  try {
    const owner = await contextFor(token, {id:2,role:'owner',academy_id:ACADEMY_ID,permissions:{}});
    await owner.grantPermissions(['clipboard-read','clipboard-write'], {origin});
    const page = await owner.newPage();
    await page.goto('/admissions');
    const button = page.getByRole('button',{name:'입학원서 링크 복사',exact:true});
    await button.waitFor();
    for (const width of [1440,820,390]) {
      await page.setViewportSize({width,height:1000});
      await page.evaluate(async () => {
        await Promise.all(document.getAnimations()
          .filter(animation => animation.effect?.getTiming().iterations !== Infinity)
          .map(animation => animation.finished.catch(() => {})));
      });
      await page.waitForFunction(() => {
        const button = [...document.querySelectorAll('button')].find(item => item.textContent === '입학원서 링크 복사');
        const bounds = button?.getBoundingClientRect();
        return bounds && bounds.x >= 0 && bounds.right <= innerWidth;
      });
      assert.equal(await button.isVisible(), true);
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
      const bounds = await button.boundingBox();
      assert.ok(bounds.x >= 0 && bounds.x + bounds.width <= width);
      await page.screenshot({path:path.join(evidence,`staff-${width}.png`),fullPage:true});
    }
    await button.click();
    await page.getByRole('status').filter({hasText:'입학원서 링크를 복사했습니다.'}).waitFor();
    const copied = await page.evaluate(() => navigator.clipboard.readText());
    assert.equal(copied, `${origin}${PUBLIC_FORM_PATH}`);

    await page.evaluate(() => {
      navigator.clipboard.writeText = async () => { throw new DOMException('Fixture denied','NotAllowedError'); };
    });
    await button.click();
    const manual = page.getByRole('textbox',{name:'복사할 입학원서 링크'});
    await manual.waitFor();
    assert.equal(await manual.inputValue(), copied);
    assert.equal(await manual.evaluate(input => input.selectionEnd - input.selectionStart), copied.length);
    assert.equal(await page.getByRole('status').filter({hasText:'입학원서 링크를 복사했습니다.'}).count(),0);

    const agents = [
      ['desktop',1440,'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/130.0.0.0 Safari/537.36'],
      ['tablet',820,'Mozilla/5.0 (iPad; CPU OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Version/17.0 Mobile/15E148 Safari/604.1'],
      ['mobile',390,'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Version/17.0 Mobile/15E148 Safari/604.1'],
    ];
    for (const [device,width,userAgent] of agents) {
      const anonymous = await contextFor(null,{}, {viewport:{width,height:1000},userAgent});
      const form = await anonymous.newPage();
      await form.clock.install({time:new Date('2026-10-16T03:00:00Z')});
      await form.goto(copied);
      await form.getByRole('button',{name:'입학원서 제출',exact:true}).waitFor();
      assert.equal(new URL(form.url()).pathname,PUBLIC_FORM_PATH);
      assert.equal(await form.evaluate(() => localStorage.getItem('token')),null);
      assert.equal((await anonymous.cookies()).some(cookie => cookie.name==='paca_auth'),false);
      assert.equal(await form.evaluate(() => document.documentElement.scrollWidth <= innerWidth),true);
      if (device === 'mobile') {
        await form.locator('#admission-name').fill('합성 링크학생');
        await form.locator('#admission-school').fill('합성고');
        await form.getByLabel('학년',{exact:true}).selectOption('고2');
        await form.getByLabel('성별',{exact:true}).selectOption('female');
        await form.locator('#admission-birth').fill('080229');
        await form.locator('#admission-phone').fill('01012345678');
        await form.locator('#admission-mother-name').fill('합성 보호자');
        await form.locator('#admission-mother-phone').fill('01033334444');
        await form.locator('#admission-date').fill('2026-10-20');
        await form.locator('input[type="checkbox"]').check();
        await form.getByRole('button',{name:'입학원서 제출',exact:true}).click();
        await form.getByRole('heading',{name:'입학원서를 접수했습니다',exact:true}).waitFor();
        assert.equal(submissions.length,1);
        assert.equal(submissions[0].authorization,undefined);
        assert.equal(submissions[0].body.academy_id,undefined);
        const [rows] = await pool.query('SELECT * FROM ilsan_admission_applications');
        assert.equal(rows.length,1);
        assert.equal(rows[0].academy_id,ACADEMY_ID);
        assert.equal(JSON.parse(open(rows[0].profile_encrypted)).name,'합성 링크학생');
      }
      await form.screenshot({path:path.join(evidence,`public-${device}.png`),fullPage:true});
      await anonymous.close();
    }
    for (const [authToken,user] of [
      [otherToken,{id:1,role:'owner',academy_id:1,permissions:{}}],
      [readerToken,{id:3,role:'staff',academy_id:ACADEMY_ID,permissions:{students:{view:true,edit:false}}}],
      [otherToken,{id:1,role:'owner',academy_id:ACADEMY_ID,permissions:{}}],
    ]) {
      const denied = await contextFor(authToken,user);
      const screen = await denied.newPage();
      const response = screen.waitForResponse(r => r.url().includes('/ilsan-admissions/share-link'));
      await screen.goto('/admissions');
      assert.equal((await response).status(),403);
      assert.equal(await screen.getByRole('button',{name:'입학원서 링크 복사',exact:true}).count(),0);
      await denied.close();
    }
    await pool.execute('UPDATE users SET academy_id=1 WHERE id=2');
    try {
      await button.click();
      await button.waitFor({state:'hidden'});
      assert.equal(await manual.count(),0);
    } finally { await pool.execute('UPDATE users SET academy_id=2 WHERE id=2'); }
    await owner.close();
  } finally {
    await browser.close();
    await new Promise(resolve => server.close(resolve));
  }
}

module.exports = { verifyAdmissionLinkBrowser };
