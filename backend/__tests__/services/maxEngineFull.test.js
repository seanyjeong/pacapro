jest.mock('../../config/database',()=>({execute:jest.fn()}));
jest.mock('../../config/peak-database',()=>({execute:jest.fn()}));
const crypto=require('crypto');
const security=require('../../services/maxEngineFullSecurity');
const {validate,catalog}=require('../../services/maxEngineFullCommands');
const payments=require('../../services/maxEngineFullPayments');
beforeEach(()=>{process.env.MAX_ENGINE_LINK_SECRET=crypto.randomBytes(48).toString('hex');process.env.DATA_ENCRYPTION_KEY=crypto.randomBytes(32).toString('hex');});
test('authenticated ciphertext roundtrip; tampering and missing keys fail closed',()=>{
 const body={operation:'student_update',changes:{name:'합성학생'}};
 const encrypted=security.seal(body);expect(encrypted).not.toContain('합성학생');expect(security.unseal(encrypted)).toEqual(body);
 expect(()=>security.unseal('corrupted')).toThrow();
 const name=security.encrypt('합성학생');expect(name.startsWith('ENC:')).toBe(true);expect(security.decrypt(name)).toBe('합성학생');
 expect(()=>security.decrypt('ENC:invalid')).toThrow();
 delete process.env.DATA_ENCRYPTION_KEY;expect(()=>security.encrypt('합성학생')).toThrow();
 delete process.env.MAX_ENGINE_LINK_SECRET;expect(()=>security.seal(body)).toThrow();
});
test('partial updates preserve null and reject foreign scope, unknown fields and impossible dates',()=>{
 expect(validate({operation:'student_update',resource_id:1,changes:{school:null}})).toEqual({operation:'student_update',resource_id:1,changes:{school:null}});
 for(const body of [
  {operation:'student_update',resource_id:1,changes:{academy_id:2}},
  {operation:'student_update',resource_id:1,changes:{}},
  {operation:'student_create',changes:{name:'합성',phone:'000',enrollment_date:'2026-02-30'}},
  {operation:'__proto__',changes:{}},
  {operation:['student_update'],changes:{}},
  {operation:'student_update',resource_id:1,changes:{name:'ENC:forged',status:'active'}},
 ])expect(()=>validate(body)).toThrow();
});
test('engine-only source is allowed for create and missing phone has a specific 422 message',()=>{
 const command=validate({operation:'student_create',changes:{name:'합성',phone:'01012345678',enrollment_date:'2026-09-30',registration_source:'max_engine'}});
 expect(command.changes.registration_source).toBe('max_engine');
 expect(()=>validate({operation:'student_create',changes:{name:'합성',enrollment_date:'2026-09-30',registration_source:'max_engine'}})).toThrow('학생 전화번호가 없습니다');
 expect(()=>validate({operation:'student_create',changes:{name:'합성',phone:'---',enrollment_date:'2026-09-30',registration_source:'max_engine'}})).toThrow('학생 전화번호가 없습니다');
 expect(()=>validate({operation:'student_create',changes:{name:'합성',phone:'01012345678',enrollment_date:'2026-09-30',registration_source:'other'}})).toThrow();
});
test('existing MCP schedule commands remain available with prospect registration',()=>{
 const operations=catalog('paca').map(entry=>entry.operation);
 for(const operation of ['class_schedule_update','instructor_schedule_update','academy_event_update','consultation_reschedule']){
  expect(operations).toContain(operation);
 }
 expect(validate({operation:'class_schedule_update',resource_id:7,changes:{time_slot:'morning'}}))
  .toEqual({operation:'class_schedule_update',resource_id:7,changes:{time_slot:'morning'}});
});
test('consultation block create needs a date and reason without id, delete needs an id and no fields',()=>{
 const entries=Object.fromEntries(catalog('paca').map(entry=>[entry.operation,entry]));
 expect(entries.consultation_block_create).toMatchObject({resource:'consultation_blocked_slots',requires_id:false});
 expect(entries.consultation_block_delete).toMatchObject({resource:'consultation_blocked_slots',requires_id:true});
 expect(validate({operation:'consultation_block_create',changes:{blocked_date:'2030-10-14',start_time:'11:30',end_time:'12:30',reason:'외부 일정'}}).resource_id).toBeNull();
 for(const body of [
  {operation:'consultation_block_create',resource_id:1,changes:{blocked_date:'2030-10-14',is_all_day:true,reason:'x'}},
  {operation:'consultation_block_create',changes:{blocked_date:'2030-10-14',is_all_day:true,reason:' '}},
  {operation:'consultation_block_create',changes:{blocked_date:'2030-10-14',start_time:'11:30:00',end_time:'12:30',reason:'x'}},
  {operation:'consultation_block_create',changes:{blocked_date:'2030-10-14',is_all_day:true,reason:'x',academy_event_id:1}},
  {operation:'consultation_block_delete',changes:{}},
  {operation:'consultation_block_delete',resource_id:1,changes:{reason:'x'}},
 ])expect(()=>validate(body)).toThrow();
 expect(validate({operation:'consultation_block_delete',resource_id:1,changes:{}})).toEqual({operation:'consultation_block_delete',resource_id:1,changes:{}});
});
test('academy event create needs a title and date without id and rejects unknown fields',()=>{
 expect(catalog('paca').find(entry=>entry.operation==='academy_event_create')).toMatchObject({resource:'academy_events',requires_id:false});
 expect(validate({operation:'academy_event_create',changes:{title:'강남대 실기 인솔',event_date:'2030-10-17',start_time:'15:20',event_type:'work'}}).resource_id).toBeNull();
 for(const changes of [{event_date:'2030-10-17'},{title:' ',event_date:'2030-10-17'},{title:'x'},{title:'x',event_date:'2030-10-17',event_type:'trip'},
  {title:'x',event_date:'2030-10-17',start_time:'15:20:00'},{title:'x',event_date:'2030-10-17',academy_id:2}])expect(()=>validate({operation:'academy_event_create',changes})).toThrow();
 expect(()=>validate({operation:'academy_event_create',resource_id:1,changes:{title:'x',event_date:'2030-10-17'}})).toThrow();
});
test('payment uses exact decimal arithmetic and preserves prior notes',()=>{
 const before={paid_amount:'0.10',final_amount:'0.30',payment_status:'partial',notes:'prior'};
 const result=payments.result({paid_amount:'0.20',payment_date:'2026-09-27',payment_method:'cash'},before);
 expect(result.paid_amount).toBe('0.30');expect(result.payment_status).toBe('paid');expect(result.notes).toContain('prior');
 expect(()=>payments.result({paid_amount:'0'},before)).toThrow();
 expect(()=>payments.result({paid_amount:'1'},{...before,payment_status:'paid'})).toThrow();
 expect(()=>payments.result({paid_amount:'1'},{...before,payment_status:'cancelled'})).toThrow();
 expect(payments.result({paid_amount:'0'}, {...before,final_amount:'0',paid_amount:'0'}).payment_status).toBe('paid');
});
test('payment_update recalculates final amount like the payment screen and guards closed, withdrawn and below-paid bills',()=>{
 const before={base_amount:'300000.00',discount_amount:'0.00',additional_amount:'0.00',carryover_amount:10000,final_amount:'290000.00',paid_amount:'0.00',payment_status:'pending',notes:'prior',student_status:'active'};
 const cut=payments.updated({discount_amount:'50500',notes:'형제 할인'},before);
 expect(cut).toMatchObject({base_amount:'300000.00',discount_amount:'50500.00',final_amount:'239000.00',payment_status:'pending'});
 expect(cut.notes).toBe('prior\n청구액 수정: 290000.00 → 239000.00 (형제 할인)');
 expect(payments.updated({base_amount:'5000',notes:'x'},{...before,carryover_amount:20000}).final_amount).toBe('0.00');
 const partial={...before,paid_amount:'100000.00',payment_status:'partial'};
 expect(payments.updated({base_amount:'200000',notes:'x'},partial).payment_status).toBe('partial');
 expect(payments.updated({base_amount:'110000',notes:'x'},partial)).toMatchObject({final_amount:'100000.00',payment_status:'paid'});
 const code=(changes,b)=>{try{payments.updated(changes,b);}catch(e){return e.code||e.error?.code||e.message;}};
 expect(String(code({base_amount:'100000',notes:'x'},partial))).toContain('PAYMENT_BELOW_PAID');
 for(const status of ['paid','cancelled'])expect(String(code({base_amount:'1',notes:'x'},{...before,payment_status:status}))).toContain('PAYMENT_CLOSED');
 for(const status of ['withdrawn','graduated'])expect(String(code({base_amount:'1',notes:'x'},{...before,student_status:status}))).toContain('STUDENT_STATUS_CONFLICT');
 expect(()=>validate({operation:'payment_update',resource_id:1,changes:{base_amount:'1000'}})).toThrow();
 expect(()=>validate({operation:'payment_update',resource_id:1,changes:{base_amount:'1000',notes:'  '}})).toThrow();
 expect(()=>validate({operation:'payment_update',resource_id:1,changes:{notes:'사유만'}})).toThrow();
 expect(()=>validate({operation:'payment_update',resource_id:1,changes:{final_amount:'1000',notes:'x'}})).toThrow();
 expect(catalog('paca').find(c=>c.operation==='payment_update')).toMatchObject({resource:'student_payments',source:'paca'});
});
test('expense_create needs date, screen category and positive amount without id',()=>{
 expect(catalog('paca').find(c=>c.operation==='expense_create')).toMatchObject({resource:'expenses',source:'paca',requires_id:false});
 const changes={expense_date:'2026-10-23',category:'supplies',amount:'35000',description:'매트 구입',payment_method:'card'};
 expect(validate({operation:'expense_create',changes})).toEqual({operation:'expense_create',resource_id:null,changes});
 for(const bad of [{...changes,amount:'0'},{...changes,amount:35000},{...changes,category:'salary'},{...changes,category:'refund'},
  {...changes,payment_method:'bank'},{...changes,expense_date:'2026-02-30'},{...changes,academy_id:2},{category:'other',amount:'1'}])
  expect(()=>validate({operation:'expense_create',changes:bad})).toThrow();
 expect(()=>validate({operation:'expense_create',resource_id:1,changes})).toThrow();
});
test('monthly_payment_create needs a student and billing month without id',()=>{
 expect(catalog('paca').find(c=>c.operation==='monthly_payment_create')).toMatchObject({resource:'student_payments',source:'paca',requires_id:false});
 const changes={student_id:4,year_month:'2026-11'};
 expect(validate({operation:'monthly_payment_create',changes})).toEqual({operation:'monthly_payment_create',resource_id:null,changes});
 for(const bad of [{student_id:4},{year_month:'2026-11'},{student_id:4,year_month:'2026-13'},{student_id:4,year_month:'2026-11',amount:'1000'},{student_id:'4',year_month:'2026-11'}])
  expect(()=>validate({operation:'monthly_payment_create',changes:bad})).toThrow();
 expect(()=>validate({operation:'monthly_payment_create',resource_id:4,changes})).toThrow();
});
