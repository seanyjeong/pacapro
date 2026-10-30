const express=require('express');
const request=require('supertest');
const {ilsanAdmissionFileCors}=require('../../middleware/ilsanAdmissionFileCors');
const app=express();app.use(ilsanAdmissionFileCors);app.use((_req,res)=>res.status(401).json({error:'protected'}));
test('local file preflight permits only anonymous intake, never credentials',async()=>{
  const response=await request(app).options('/paca/ilsan-admissions/submit').set('Origin','null')
    .set('Access-Control-Request-Method','POST').set('Access-Control-Request-Headers','content-type,idempotency-key');
  expect(response.status).toBe(204);expect(response.headers['access-control-allow-origin']).toBe('null');
  expect(response.headers['access-control-allow-credentials']).toBeUndefined();
});
test.each(['/paca/ilsan-admissions','/paca/ilsan-admissions/1/confirm','/paca/students'])('does not allow local file access to %s',async path=>{
  const response=await request(app).options(path).set('Origin','null').set('Access-Control-Request-Method','POST');
  expect(response.status).toBe(401);expect(response.headers['access-control-allow-origin']).toBeUndefined();
});
test('foreign origins and authorization headers are not added to the exception',async()=>{
  const foreign=await request(app).get('/paca/ilsan-admissions/availability').set('Origin','https://other.example');
  expect(foreign.headers['access-control-allow-origin']).toBeUndefined();
  const privileged=await request(app).options('/paca/ilsan-admissions/submit').set('Origin','null')
    .set('Access-Control-Request-Method','POST').set('Access-Control-Request-Headers','authorization');
  expect(privileged.headers['access-control-allow-origin']).toBeUndefined();
});
