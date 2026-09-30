jest.mock('../../config/database',()=>({execute:jest.fn()}));
jest.mock('../../config/peak-database',()=>({execute:jest.fn()}));
const crypto=require('crypto');
const security=require('../../services/maxEngineFullSecurity');
const {validate}=require('../../services/maxEngineFullCommands');
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
test('payment uses exact decimal arithmetic and preserves prior notes',()=>{
 const before={paid_amount:'0.10',final_amount:'0.30',payment_status:'partial',notes:'prior'};
 const result=payments.result({paid_amount:'0.20',payment_date:'2026-09-27',payment_method:'cash'},before);
 expect(result.paid_amount).toBe('0.30');expect(result.payment_status).toBe('paid');expect(result.notes).toContain('prior');
 expect(()=>payments.result({paid_amount:'0'},before)).toThrow();
 expect(()=>payments.result({paid_amount:'1'},{...before,payment_status:'paid'})).toThrow();
 expect(()=>payments.result({paid_amount:'1'},{...before,payment_status:'cancelled'})).toThrow();
 expect(payments.result({paid_amount:'0'}, {...before,final_amount:'0',paid_amount:'0'}).payment_status).toBe('paid');
});
