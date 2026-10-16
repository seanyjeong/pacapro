const repo = require('../repositories/ilsanAdmissionExistingRepository');
const apps = require('../repositories/ilsanAdmissionRepository');
const codec = require('./ilsanAdmissionCodec');
const { plan, ENCRYPTED_FIELDS } = require('../models/ilsanAdmissionExisting');
const { fail, fingerprint } = require('../models/ilsanAdmission');

function readable(student) {
  const result={...student,name:codec.open(student.name)};
  for (const field of ENCRYPTED_FIELDS) result[field]=student[field]==null ? '' : codec.open(student[field]);
  return result;
}
function openApplication(record) {
  if (!['submitted','scheduled','review'].includes(record.status)) fail(409,'CLOSED_APPLICATION','이미 처리된 원서입니다.');
  return codec.view(record).profile;
}
const phoneDigits = phone => (phone || '').replace(/\D/g,'');
function createExistingService(pool,{actor,scope,row}) {
  async function preview(conn,record,targetId,lock=false) {
    const profile=openApplication(record);
    if (!Number.isSafeInteger(targetId) || targetId<1) fail(422,'INVALID_STUDENT','기존 학생을 선택해 주세요.');
    const [raw]=await repo.students(conn,targetId,lock);
    if (!raw) fail(404,'STUDENT_NOT_FOUND','일산 교육원의 기존 학생을 찾을 수 없습니다.');
    const current=readable(raw);
    if (current.name.trim()!==profile.name) fail(409,'STUDENT_MISMATCH','원서와 기존 학생 이름이 다릅니다. 학생을 다시 확인해 주세요.');
    const changes=plan(profile,current);
    return { student:current,fields:changes.fields,additions:changes.additions,
      preview_hash:fingerprint({application:record.id,revision:record.revision,profile,current,fields:changes.fields}) };
  }
  return {
    async existingStudents(user,id) {
      actor(user);
      return apps.transaction(pool,async conn=>{
        await scope(conn);const profile=codec.view(await row(conn,id)).profile;
        const students=(await repo.students(conn)).map(readable).filter(s=>s.name.trim()===profile.name);
        return {students:students.map(({id,name,student_number,status,phone,school,grade})=>({id,name,student_number,status,phone,school,grade,
          exact_phone:!!phoneDigits(phone) && phoneDigits(phone)===phoneDigits(profile.phone)}))};
      });
    },
    async existingPreview(user,id,input) {
      actor(user);
      return apps.transaction(pool,async conn=>{await scope(conn);const result=await preview(conn,await row(conn,id),input.student_id);
        const {additions,...visible}=result;return visible;});
    },
    async existingConfirm(user,id,input) {
      actor(user);
      return apps.transaction(pool,async conn=>{
        await scope(conn,true);const record=await row(conn,id,true);
        const result=await preview(conn,record,input.student_id,true);
        if (input.preview_hash!==result.preview_hash) fail(409,'SOURCE_CHANGED','학생 정보가 변경됐습니다. 추가할 정보를 다시 확인해 주세요.');
        const values=Object.fromEntries(Object.entries(result.additions).map(([key,value])=>[key,ENCRYPTED_FIELDS.includes(key)?codec.seal(value):value]));
        await repo.fill(conn,input.student_id,values);
        await repo.complete(conn,id,user.id,{operation:'fill_missing',target_student_id:input.student_id,filled_fields:Object.keys(values)});
        return codec.view(await row(conn,id));
      });
    },
  };
}
module.exports = { createExistingService };
