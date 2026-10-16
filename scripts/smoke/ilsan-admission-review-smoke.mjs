import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {launchSmokeBrowser,createDiagnostics,jsonRoute,installFakeAttendanceSocket,DEFAULT_BASE_URL,nonServiceWorkerErrors} from './paca-smoke-utils.mjs';
const require=createRequire(import.meta.url);
const release=require('../../src/constants/release.json');
const model=require('../../backend/models/ilsanAdmission');
const user={id:2,role:'owner',name:'합성 원장',academy_id:2,permissions:{}};
const record={id:1,revision:1,status:'submitted',created_at:'2026-10-16',enrollment_date:null,terms:null,quote:null,student_id:null,review_code:null,
  profile:{name:'합성 접수학생',school:'합성고',grade:'고2',gender:'female',birth_six:'080229',phone:'010-1234-5678',father_name:'합성아버지',father_phone:'010-1111-2222',mother_name:'합성어머니',mother_phone:'010-3333-4444',primary_parent:'mother',enrollment_date:'2026-11-20',consent:true}};
const browser=await launchSmokeBrowser();
const calls=[];
try {
  const context=await browser.newContext({baseURL:DEFAULT_BASE_URL,viewport:{width:1440,height:1000},serviceWorkers:'block'});
  await context.addCookies([{name:'paca_auth',value:'1',url:DEFAULT_BASE_URL}]);
  await context.addInitScript(({user,version})=>{localStorage.setItem('token','synthetic-only');localStorage.setItem('user',JSON.stringify(user));localStorage.setItem('app_version',version);sessionStorage.setItem('version_reload_attempt',version);},{user,version:release.version});
  await installFakeAttendanceSocket(context);
  await context.route('**/*',async route=>{
    const req=route.request(),url=new URL(req.url());
    if(url.origin===new URL(DEFAULT_BASE_URL).origin)return route.continue();
    // All external traffic is intercepted. No synthetic submission reaches production.
    if(url.hostname!=='supermax.kr')return route.abort();
    const path=url.pathname.replace(/^\/paca/,'');
    if(path==='/ilsan-admissions')return jsonRoute(route,{applications:[record],next_cursor:null});
    if(path==='/ilsan-admissions/1/preview'){
      const terms=req.postDataJSON();calls.push({action:'preview',terms});
      return jsonRoute(route,{terms,quote:model.quote(terms),duplicate_student_ids:[],preview_hash:model.fingerprint(terms)});
    }
    if(path==='/ilsan-admissions/1/confirm'){
      const body=req.postDataJSON(),{preview_hash,...terms}=body;
      assert.equal(preview_hash,model.fingerprint(terms));calls.push({action:'confirm',terms});
      Object.assign(record,{status:'scheduled',revision:2,enrollment_date:terms.enrollment_date,terms,quote:model.quote(terms)});
      return jsonRoute(route,record);
    }
    if(path==='/ilsan-admissions/1/cancel'){
      assert.equal(req.postDataJSON().revision,record.revision);calls.push({action:'cancel'});
      Object.assign(record,{status:'cancelled',revision:3});return jsonRoute(route,record);
    }
    if(path.startsWith('/consultations'))return jsonRoute(route,{pagination:{total:0}});
    if(path==='/settings/academy')return jsonRoute(route,{settings:{academy_name:'일산 맥스체대입시'}});
    return jsonRoute(route,{});
  });
  const page=await context.newPage(),diagnostics=createDiagnostics(page);
  await page.clock.install({time:new Date('2026-10-16T03:00:00Z')});
  await page.goto('/admissions');
  await page.getByRole('button',{name:/합성 접수학생/}).click();
  await page.getByLabel('월 학원비 (원)',{exact:true}).fill('300000');
  await page.getByLabel('할인율 (%)',{exact:true}).fill('10');
  await page.getByRole('checkbox',{name:'화',exact:true}).check();
  await page.getByRole('checkbox',{name:'목',exact:true}).check();
  await page.getByRole('button',{name:'일할 금액 확인',exact:true}).click();
  await page.getByRole('button',{name:/확인하고 .*등록 예약/}).waitFor();
  // Editing the date removes approval until another server preview succeeds.
  await page.getByLabel('등록일',{exact:true}).fill('2026-11-24');
  assert.equal(await page.getByRole('button',{name:/확인하고 .*등록 예약/}).count(),0);
  await page.getByRole('button',{name:'일할 금액 확인',exact:true}).click();
  await page.getByRole('button',{name:'확인하고 2026-11-24 등록 예약',exact:true}).click();
  await page.getByRole('status').filter({hasText:'2026-11-24에 등록하도록 예약했습니다.'}).waitFor();
  assert.equal(calls.filter(call=>call.action==='confirm').length,1);
  assert.equal(calls.find(call=>call.action==='confirm').terms.enrollment_date,'2026-11-24');
  await page.getByRole('button',{name:'등록 예약 취소',exact:true}).click();
  await page.getByRole('dialog').getByRole('button',{name:'원서 취소',exact:true}).click();
  await page.getByRole('status').filter({hasText:'등록 예약을 취소했습니다.'}).waitFor();
  assert.equal(await page.getByRole('button',{name:'일할 금액 확인',exact:true}).count(),0);
  assert.equal(calls.filter(call=>call.action==='cancel').length,1);
  // Production PWA expects a service worker; this isolated harness intentionally blocks it.
  assert.deepEqual(nonServiceWorkerErrors(diagnostics.pageErrors),[]);
  console.log(JSON.stringify({passed:true,scenario:'staff preview → date edit → recalculate → schedule → cancel',calls: calls.map(call=>call.action),external_network:'intercepted; no production writes',service_worker_blocked_errors:diagnostics.pageErrors}));
  await context.close();
} finally {await browser.close();}
