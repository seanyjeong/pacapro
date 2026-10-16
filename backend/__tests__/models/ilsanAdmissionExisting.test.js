const {plan}=require('../../models/ilsanAdmissionExisting');
const profile={phone:'010-1000-2000',school:'신규고',grade:'고2',gender:'female',father_name:'아버지',father_phone:'010-1111-2222',mother_name:'어머니',mother_phone:'010-3333-4444',primary_parent:'mother'};
test('only missing fields are added; existing defaults, conflicts and contacts survive',()=>{
  const current={phone:'010-5555-6666',school:'기존고',grade:'고1',gender:'male',father_name:'기존 아버지',father_phone:null,mother_name:'  ',mother_phone:'010-9999-8888',parent_phone:''};
  expect(plan(profile,current).additions).toEqual({father_phone:profile.father_phone,mother_name:profile.mother_name,parent_phone:current.mother_phone});
});
test('blank applicant values do not clear existing data or create an empty update',()=>{
  expect(plan({...profile,father_name:'',father_phone:''},{...profile,parent_phone:profile.mother_phone}).additions).toEqual({});
});
