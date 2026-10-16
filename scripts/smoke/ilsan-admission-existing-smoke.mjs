import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {launchSmokeBrowser,jsonRoute,DEFAULT_BASE_URL,installFakeAttendanceSocket} from './paca-smoke-utils.mjs';
const require=createRequire(import.meta.url),release=require('../../src/constants/release.json');
const user={id:2,role:'owner',name:'합성 원장',academy_id:2,permissions:{}};
const record={id:1,revision:1,status:'submitted',created_at:'2026-10-16',enrollment_date:null,terms:null,quote:null,student_id:null,review_code:null,
  profile:{name:'합성 기존학생',school:'합성고',grade:'고2',gender:'female',birth_six:'080229',phone:'010-1234-5678',father_name:'합성아버지',father_phone:'010-1111-2222',mother_name:'합성어머니',mother_phone:'010-3333-4444',primary_parent:'mother',enrollment_date:'2026-11-20',consent:true}};
const student={id:55,name:record.profile.name,student_number:'2026001',phone:'',school:'합성고',grade:'고2',status:'paused',exact_phone:false};
const fields=[{field:'father_name',label:'아버님 성함',current:'',incoming:'합성아버지',action:'fill'},
  {field:'mother_phone',label:'어머님 전화번호',current:'010-9999-8888',incoming:record.profile.mother_phone,action:'keep'}];
const calls=[];const browser=await launchSmokeBrowser();
try {
  const context=await browser.newContext({baseURL:DEFAULT_BASE_URL,viewport:{width:1440,height:1000},serviceWorkers:'block'});
  await context.addCookies([{name:'paca_auth',value:'1',url:DEFAULT_BASE_URL}]);
  await context.addInitScript(({user,version})=>{localStorage.setItem('token','synthetic-only');localStorage.setItem('user',JSON.stringify(user));localStorage.setItem('app_version',version);sessionStorage.setItem('version_reload_attempt',version);},{user,version:release.version});
  await installFakeAttendanceSocket(context);
  await context.route('**/*',async route=>{
    const req=route.request(),url=new URL(req.url());
    if(url.origin===new URL(DEFAULT_BASE_URL).origin)return route.continue();
    if(url.hostname!=='supermax.kr')return route.abort();
    const path=url.pathname.replace(/^\/paca/,'');
    if(path==='/ilsan-admissions')return jsonRoute(route,{applications:[record],next_cursor:null});
    if(path==='/ilsan-admissions/1/existing-students')return jsonRoute(route,{students:[student,{...student,id:56,student_number:'2026002',school:'다른고'}]});
    if(path==='/ilsan-admissions/1/existing-preview'){
      assert.equal(req.postDataJSON().student_id,55);calls.push('preview');return jsonRoute(route,{student,fields,preview_hash:'synthetic-preview'});
    }
    if(path==='/ilsan-admissions/1/existing-confirm'){
      assert.deepEqual(req.postDataJSON(),{student_id:55,preview_hash:'synthetic-preview'});calls.push('confirm');
      Object.assign(record,{status:'enrolled',revision:2,student_id:55,completion_kind:'fill_missing',filled_fields:['father_name']});return jsonRoute(route,record);
    }
    if(path==='/ilsan-admissions/1/confirm')throw new Error('Existing student must never call new enrollment');
    return jsonRoute(route,{});
  });
  const page=await context.newPage();await page.goto('/admissions');
  await page.getByRole('button',{name:/합성 기존학생/}).click();
  await page.getByText('같은 이름의 기존 학생이 있습니다',{exact:true}).waitFor();
  assert.equal(await page.getByLabel('월 학원비 (원)',{exact:true}).count(),0);
  assert.equal(await page.getByRole('button',{name:'추가할 정보 확인',exact:true}).isDisabled(),true);
  await page.getByLabel('기존 학생',{exact:true}).selectOption('55');
  await page.getByRole('button',{name:'추가할 정보 확인',exact:true}).click();
  await page.getByRole('list',{name:'정보 보완 미리보기'}).waitFor();
  assert.match(await page.getByRole('list',{name:'정보 보완 미리보기'}).innerText(),/010-9999-8888 \(유지\)/);
  assert.equal(await page.getByRole('button',{name:'기존 학생에 빈 정보만 반영',exact:true}).isDisabled(),true);
  await page.getByRole('checkbox',{name:'원서와 동일한 학생임을 확인했습니다',exact:true}).check();
  await page.getByRole('button',{name:'기존 학생에 빈 정보만 반영',exact:true}).click();
  await page.getByText('정보 보완 완료',{exact:true}).first().waitFor();
  assert.equal(await page.getByRole('link',{name:'학생 보기'}).getAttribute('href'),'/students/55');
  assert.deepEqual(calls,['preview','confirm']);
  console.log(JSON.stringify({passed:true,scenario:'choose existing student → preview blanks and preserved values → identity confirmation → fill missing only',production_writes:0}));
} finally {await browser.close();}
