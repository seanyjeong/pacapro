const model = require('../../models/ilsanAdmission');
const form = {name:'합성학생',school:'합성고',grade:'고2',gender:'female',birth_six:'080229',phone:'01012345678',
  father_name:'',mother_name:'합성보호자',mother_phone:'01098765432',primary_parent:'mother',enrollment_date:'2026-10-20',consent:true};
test('collects only six birth digits, normalizes phones and allows one available guardian', () => {
  expect(model.application(form,'2026-10-16')).toMatchObject({birth_six:'080229',phone:'010-1234-5678',mother_phone:'010-9876-5432'});
  for (const birth_six of ['0802291234567','070229','081331']) expect(()=>model.application({...form,birth_six},'2026-10-16')).toThrow();
});
test('requires consent, real registration date and a selected available parent contact', () => {
  for (const change of [{consent:false},{enrollment_date:'2026-02-30'},{primary_parent:'father'},{enrollment_date:'2026-10-01'},{name:'ENC:invalid'},{mother_name:'ENC:invalid'}]) {
    expect(()=>model.application({...form,...change},'2026-10-16')).toThrow();
  }
});
test('first tuition uses remaining scheduled lessons, then rounds fee and discount down to thousands', () => {
  const result=model.quote(model.terms({enrollment_date:'2026-10-20',monthly_tuition:300000,discount_rate:10,class_days:[2,4],time_slot:'evening'},'2026-10-16'));
  expect(result).toMatchObject({total_classes:9,remaining_classes:4,prorated_amount:133000,discount_amount:13000,final_amount:120000});
  expect(result.class_dates).toEqual(['2026-10-20','2026-10-22','2026-10-27','2026-10-29']);
});
test('no remaining scheduled class costs zero and invalid fee or timetable is rejected', () => {
  const base={enrollment_date:'2026-10-31',monthly_tuition:300000,class_days:[1],time_slot:'evening'};
  expect(model.quote(model.terms(base,'2026-10-16')).final_amount).toBe(0);
  for(const change of [{monthly_tuition:-1},{monthly_tuition:''},{monthly_tuition:null},{class_days:[]},{class_days:[1,1]},{time_slot:'night'}]) {
    expect(()=>model.terms({...base,...change},'2026-10-16')).toThrow();
  }
});
test('stored JSON key reordering preserves hashes while changed amounts do not', () => {
  expect(model.fingerprint({b:2,a:{d:4,c:3}})).toBe(model.fingerprint({a:{c:3,d:4},b:2}));
  expect(model.fingerprint({amount:1000})).not.toBe(model.fingerprint({amount:2000}));
});
