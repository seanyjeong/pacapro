import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {launchSmokeBrowser,jsonRoute,DEFAULT_BASE_URL,installFakeAttendanceSocket} from './paca-smoke-utils.mjs';
const require=createRequire(import.meta.url),release=require('../../src/constants/release.json');
const user={id:2,role:'owner',name:'합성 원장',academy_id:2,permissions:{}};
const today=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Seoul'}).format(new Date());
const profile={name:'합성 기존학생',school:'합성고',grade:'고2',gender:'female',birth_six:'080229',phone:'010-1234-5678',father_name:'합성아버지',father_phone:'010-1111-2222',mother_name:'합성어머니',mother_phone:'010-3333-4444',primary_parent:'mother',enrollment_date:today,consent:true};
const fields=[{field:'phone',label:'학생 전화번호',current:'010-9999-0000',incoming:profile.phone,action:'replace'},
  {field:'father_name',label:'아버님 성함',current:'',incoming:'합성아버지',action:'fill'},
  {field:'mother_phone',label:'어머님 전화번호',current:'010-9999-8888',incoming:profile.mother_phone,action:'replace'},
  {field:'school',label:'학교',current:'합성고',incoming:'합성고',action:'keep'}];
const quote={enrollment_date:today,monthly_tuition:300000,discount_rate:0,class_days:[1,2,3,4,5,6,0],time_slot:'evening',year_month:today.slice(0,7),
  total_classes:30,remaining_classes:10,class_dates:[today],prorated_amount:100000,discount_amount:0,final_amount:100000};
const terms={enrollment_date:today,monthly_tuition:300000,discount_rate:0,class_days:[0,1,2,3,4,5,6],time_slot:'evening'};

async function scenario(status) {
  const register=status==='pending',calls=[];
  const record={id:1,revision:1,status:'submitted',created_at:'2026-10-16',enrollment_date:null,terms:null,quote:null,student_id:null,review_code:null,profile};
  const student={id:55,name:profile.name,student_number:'2026001',phone:'010-9999-0000',school:'합성고',grade:'고2',status,exact_phone:false};
  const browser=await launchSmokeBrowser();
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
        const body=req.postDataJSON();assert.equal(body.student_id,55);calls.push(body.terms?'quote':'preview');
        if(body.terms)assert.deepEqual(body.terms,terms);
        return jsonRoute(route,{student,fields,register,terms:body.terms?terms:null,quote:body.terms?quote:null,preview_hash:body.terms?'synthetic-quote':'synthetic-preview'});
      }
      if(path==='/ilsan-admissions/1/existing-confirm'){
        calls.push('confirm');
        assert.deepEqual(req.postDataJSON(),register ? {student_id:55,preview_hash:'synthetic-quote',replace_fields:['phone'],terms}
          : {student_id:55,preview_hash:'synthetic-preview',replace_fields:['phone']});
        Object.assign(record,register ? {status:'enrolled',revision:3,student_id:55,terms,quote,enrollment_date:today}
          : {status:'enrolled',revision:2,student_id:55,completion_kind:'fill_missing',filled_fields:['father_name','phone']});
        return jsonRoute(route,record);
      }
      if(path==='/ilsan-admissions/1/confirm')throw new Error('Existing student must never call new enrollment');
      return jsonRoute(route,{});
    });
    const page=await context.newPage();await page.goto('/admissions');
    await page.getByRole('button',{name:/합성 기존학생/}).click();
    await page.getByText('같은 이름의 기존 학생이 있습니다',{exact:true}).waitFor();
    assert.equal(await page.getByLabel('월 학원비 (원)',{exact:true}).count(),0);
    assert.equal(await page.getByRole('button',{name:'원서와 비교',exact:true}).isDisabled(),true);
    await page.getByLabel('기존 학생',{exact:true}).selectOption('55');
    await page.getByRole('button',{name:'원서와 비교',exact:true}).click();
    const list=page.getByRole('list',{name:'원서 반영 미리보기'});await list.waitFor();
    assert.match(await list.innerText(),/합성고 \(유지\)/);
    const phone=list.getByRole('checkbox',{name:/학생 전화번호/}),mother=list.getByRole('checkbox',{name:/어머님 전화번호/});
    assert.equal(await phone.isChecked(),true);assert.equal(await mother.isChecked(),true);
    await mother.uncheck();
    await page.getByRole('checkbox',{name:'원서와 동일한 학생임을 확인했습니다',exact:true}).check();
    if(register){
      assert.equal(await page.getByRole('button',{name:'일할 금액을 먼저 확인해 주세요',exact:true}).isDisabled(),true);
      await page.getByLabel('월 학원비 (원)',{exact:true}).fill('300000');
      for(const day of ['월','화','수','목','금','토','일'])await page.getByRole('group').getByText(day,{exact:true}).click();
      await page.getByRole('button',{name:'일할 금액 확인'}).click();
      await page.getByText('첫 달 청구 금액',{exact:true}).waitFor();
      await page.getByRole('button',{name:'원서 내용 반영하고 오늘 재원 등록',exact:true}).click();
      await page.getByText(/재원 등록했습니다. 첫 달 청구서와 수업 배정을 만들었습니다/).waitFor();
    } else {
      assert.equal(await page.getByLabel('월 학원비 (원)',{exact:true}).count(),0);
      await page.getByRole('button',{name:'기존 학생에 원서 내용 반영',exact:true}).click();
      await page.getByText('정보 보완 완료',{exact:true}).first().waitFor();
    }
    assert.equal(await page.getByRole('link',{name:'학생 보기'}).getAttribute('href'),'/students/55');
    assert.deepEqual(calls,register?['preview','quote','confirm']:['preview','confirm']);
  } finally {await browser.close();}
}
await scenario('paused');
await scenario('pending');
console.log(JSON.stringify({passed:true,scenarios:['paused: compare → replacements preselected, one unchecked → info only','pending: compare → terms → quote → register on the same record'],production_writes:0}));
