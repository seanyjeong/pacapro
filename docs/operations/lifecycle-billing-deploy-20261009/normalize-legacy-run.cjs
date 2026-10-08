require('/root/pacapro/backend/node_modules/dotenv').config({path:'/root/pacapro/backend/.env'});
const fs=require('fs'), assert=require('node:assert/strict');
const pool=require('/root/pacapro/backend/config/database');
const billing=require('/root/pacapro/backend/services/studentLifecycleBillingService');
const {normalize}=require('./docs/operations/lifecycle-billing-deploy-20261009/normalize-legacy-pause.cjs');
const dir='/root/backups/paca-lifecycle-billing-display-20261008T152342792438Z';
const apply=process.argv[2]==='--apply';
assert(process.argv.length===2 || (process.argv.length===3&&apply));
const context={academyId:2,studentId:9146,userId:2,paymentId:5086,date:'2026-10-07',originalAmount:400000,currentAmount:77000};
(async()=>{const c=await pool.getConnection();try{
if(!apply)await c.query('SET TRANSACTION READ ONLY');await c.beginTransaction();
const expected=apply?JSON.parse(fs.readFileSync(dir+'/legacy-normalize-plan.json','utf8')).source_hash:undefined;
const result=await normalize(c,context,expected);
if(apply){
 const [s]=await c.execute('SELECT * FROM students WHERE academy_id=2 AND id=9146');
 const current=await billing.preview(c,{...context,action:'pause',student:s[0],previousDate:context.date,creditType:'none'});
 const next=await billing.preview(c,{...context,action:'pause',student:s[0],previousDate:context.date,date:'2026-10-10',creditType:'none'});
 assert.equal(current.summary.adjusted_amount,77000);assert.equal(next.summary.adjusted_amount,116000);
 result.verified_readonly_date_preview={date:'2026-10-10',original_amount:next.summary.original_amount,adjusted_amount:next.summary.adjusted_amount,date_change_saved:false};
}
fs.writeFileSync(dir+(apply?'/legacy-normalize-applied.json':'/legacy-normalize-plan.json'),JSON.stringify(result,null,2),{mode:0o600,flag:'wx'});
if(apply)await c.commit();else await c.rollback();console.log(JSON.stringify(result));
}catch(e){await c.rollback();throw e;}finally{c.release();await pool.end();}})().catch(e=>{console.error(e.message);process.exitCode=1;});
