const {plan}=require('../../models/ilsanAdmissionExisting');
const profile={phone:'010-1000-2000',school:'신규고',grade:'고2',gender:'female',father_name:'아버지',father_phone:'010-1111-2222',mother_name:'어머니',mother_phone:'010-3333-4444',primary_parent:'mother'};
test('missing fields are filled and differing fields are offered as application replacements',()=>{
  const current={phone:'010-5555-6666',school:'기존고',grade:'고1',gender:'male',father_name:'기존 아버지',father_phone:null,mother_name:'  ',mother_phone:'010-9999-8888',parent_phone:''};
  const result=plan(profile,current);
  expect(result.additions).toEqual({father_phone:profile.father_phone,mother_name:profile.mother_name,parent_phone:profile.mother_phone});
  expect(result.replacements).toEqual({phone:profile.phone,school:profile.school,grade:profile.grade,gender:profile.gender,father_name:profile.father_name,mother_phone:profile.mother_phone});
});
test('blank applicant values and same numbers in another format are kept',()=>{
  const result=plan({...profile,father_name:'',father_phone:''},{...profile,phone:'01010002000',father_name:'기존 아버지',parent_phone:profile.mother_phone});
  expect(result.additions).toEqual({});expect(result.replacements).toEqual({});
  expect(result.fields.every(f=>f.action==='keep')).toBe(true);
});
