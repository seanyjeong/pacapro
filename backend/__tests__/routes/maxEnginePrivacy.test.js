const express=require('express');
const request=require('supertest');
const {isIntegration,errorHandler}=require('../../middleware/maxEnginePrivacy');
test('malformed delegated-login JSON never reaches the legacy raw-error logger',async()=>{
 const logger=jest.fn(),app=express();app.use(express.json());app.use(errorHandler);
 app.use((error,_req,res,_next)=>{void _next;logger(error);res.sendStatus(500);});
 const response=await request(app).post('/paca/integrations/max-engine/full/token').set('content-type','application/json').send('{"password":"private-synthetic-input"');
 expect(response.status).toBe(400);expect(response.text).not.toContain('private-synthetic-input');expect(logger).not.toHaveBeenCalled();
 expect(isIntegration({path:'/paca/integrations/max-engine/full/token'})).toBe(true);
 expect(isIntegration({path:'/paca/students'})).toBe(false);
});
