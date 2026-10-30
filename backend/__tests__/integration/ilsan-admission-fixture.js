/** Schema-backed synthetic fixture. Only the dedicated disposable loopback server is allowed. */
const mysql = require('mysql2/promise');
const fs = require('fs');
const path = require('path');
const schema = require('./max-engine-schema.json');

async function createFixture() {
  const port = Number(process.env.TEST_ILSAN_MYSQL_PORT);
  if (process.env.RUN_ILSAN_MYSQL !== '1' || !Number.isInteger(port) || port < 10000) throw new Error('Dedicated admission MySQL required');
  const options={host:'127.0.0.1',port,user:'root',password:'',dateStrings:true,multipleStatements:true};
  const admin=await mysql.createConnection(options);
  // A fresh name, no DROP DATABASE, and a server identity supplied by the temporary harness.
  const [[server]]=await admin.query('SELECT @@datadir AS directory');
  if(!server.directory.includes('/paca-ilsan-test-')) {await admin.end();throw new Error('Not the disposable admission server');}
  await admin.query('CREATE DATABASE ilsan_admission_test CHARACTER SET utf8mb4');
  const pool=mysql.createPool({...options,database:'ilsan_admission_test',connectionLimit:8});
  try {
    for(const table of ['academies','users','students','student_payments','class_schedules','attendance']) {
      const columns=schema[`paca.${table}`];
      const definitions=columns.map(([name,type,nullable])=>`\`${name}\` ${type} ${name==='id'?'NOT NULL AUTO_INCREMENT PRIMARY KEY':nullable==='NO'?'NOT NULL':'NULL'}`);
      await pool.query(`CREATE TABLE \`${table}\` (${definitions.join(',')}) ENGINE=InnoDB`);
    }
    const read=name=>fs.readFileSync(path.join(__dirname,'../../migrations',name),'utf8');
    await pool.query(read('20260929_add_student_parent_phones.mysql'));
    await pool.query(read('20261016_ilsan_admission_applications.mysql'));
    await pool.query(read('20261016_ilsan_admission_applications.mysql')); // idempotent forward migration
    await pool.query('ALTER TABLE attendance ADD UNIQUE KEY uq_attendance_student(class_schedule_id,student_id)');
    async function insert(table, values) {
      const complete={...values};
      for(const [name,type,nullable] of schema[`paca.${table}`]) {
        if(name==='id'||name in complete||nullable!=='NO')continue;
        complete[name]=type.startsWith('enum(')?type.match(/'([^']+)'/)[1]:type==='json'?'{}':/date|timestamp/.test(type)?'2026-10-16':/int|decimal/.test(type)?0:'synthetic';
      }
      const keys=Object.keys(complete);
      return pool.execute(`INSERT INTO \`${table}\` (${keys.map(k=>`\`${k}\``).join(',')}) VALUES (${keys.map(()=>'?').join(',')})`,Object.values(complete));
    }
    for(const id of [1,2]) {
      await insert('academies',{id,name:id===2?'일산 맥스체대입시':'합성 다른 교육원',owner_user_id:id});
      await insert('users',{id,name:'합성 원장',email:`owner${id}@example.invalid`,role:'owner',academy_id:id,is_active:1,approval_status:'approved'});
    }
    await insert('users',{id:3,name:'읽기 직원',email:'reader@example.invalid',role:'staff',academy_id:2,is_active:1,approval_status:'approved',permissions:JSON.stringify({students:{view:true,edit:false}})});
    return {pool,insert,close:()=>pool.end()};
  } catch(error){await pool.end();throw error;} finally{await admin.end();}
}
module.exports={createFixture};
