/** Real OAuth/MCP -> PEAK HTTP gateway -> PACA HTTP -> disposable MySQL only. */
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const http = require('node:http');
const path = require('node:path');
const fs = require('node:fs');
const pacaRoot = process.env.PACA_CANDIDATE_ROOT;
const peakRoot = process.env.PEAK_CANDIDATE_ROOT;
const mcpRoot = process.env.MCP_CANDIDATE_ROOT;
assert([pacaRoot,peakRoot,mcpRoot].every(root => root && path.isAbsolute(root)));
assert(process.env.RUN_MAX_ENGINE_MYSQL === '1' && Number(process.env.TEST_MYSQL_PORT) >= 10000);
const express = require(path.join(pacaRoot,'backend/node_modules/express'));
const { fixture } = require(path.join(pacaRoot,'backend/__tests__/integration/max-engine-efficient-fixture'));
const { createApp } = require(path.join(mcpRoot,'mcp/shared/server'));
const { createClient } = require(path.join(mcpRoot,'mcp/shared/client'));
const { openStore } = require(path.join(mcpRoot,'mcp/shared/store'));
const { login, connect } = require(path.join(mcpRoot,'mcp/test/helpers'));
async function listen(app) {
  const server = http.createServer(app);
  await new Promise(resolve => server.listen(0,'127.0.0.1',resolve));
  return { server, url:`http://127.0.0.1:${server.address().port}` };
}
async function main() {
  let f, source, gateway, mcp, store, client;
  try {
    f = await fixture();
    Object.assign(process.env,{DB_HOST:'127.0.0.1',DB_PORT:process.env.TEST_MYSQL_PORT,DB_USER:'root',DB_PASSWORD:'',
      DB_NAME:'max_engine_eff_test_paca',PEAK_DB_HOST:'127.0.0.1',PEAK_DB_PORT:process.env.TEST_MYSQL_PORT,
      PEAK_DB_USER:'root',PEAK_DB_PASSWORD:'',PEAK_DB_NAME:'max_engine_eff_test_peak'});
    await f.paca.query(fs.readFileSync(path.join(pacaRoot,'backend/migrations/20260927_max_engine_commands.sql'),'utf8'));
    for (const sql of fs.readFileSync(path.join(pacaRoot,'backend/migrations/20261003_peak_max_engine_commands.sql'),'utf8')
      .replace(/^--.*$/gm,'').split(';').filter(sql=>sql.trim())) await f.peak.query(sql);
    // The shared synthetic fixture recreates catalog tables, not command ledgers.
    await f.paca.query('DELETE FROM max_engine_commands');
    await f.peak.query('DELETE FROM max_engine_commands');
    await f.paca.execute("UPDATE instructors SET status='active' WHERE id=1");
    await f.peak.execute('UPDATE record_types SET is_active=1');
    await f.insert('peak','record_types',{id:3,academy_id:1,name:'합성측정',unit:'kg',direction:'higher',is_active:1,min_value:0,max_value:100});
    await f.insert('peak','daily_assignments',{id:1,academy_id:1,date:f.date,time_slot:'afternoon',student_id:1,paca_attendance_id:1});
    const app = express(); app.use(express.json());
    app.use('/paca/integrations/max-engine/full',require(path.join(pacaRoot,'backend/routes/integrations/full')));
    source = await listen(app);
    process.env.MAX_ENGINE_PACA_URL = source.url;
    const proxy = express(); proxy.use(express.json());
    proxy.use('/peak/integrations/max-engine/full',require(path.join(peakRoot,'backend/routes/maxEngine')));
    gateway = await listen(proxy);
    mcp = await listen();
    const config = { provider:'peak',publicUrl:new URL(mcp.url),apiUrl:new URL(gateway.url),
      storageKey:crypto.randomBytes(32),allowedRedirectHosts:['localhost','chatgpt.com'],accessTokenTtlSec:900,
      scopes:['business:read','business:confirmed-write'] };
    store = openStore(':memory:',config.storageKey);
    mcp.server.on('request',createApp({config,store,source:createClient(config)}));
    const auth = await login(mcp.url); assert.equal(auth.status,200);
    client = await connect(mcp.url,auth.tokens.access_token);
    assert.equal(client.client.getServerVersion().version,'0.4.0');
    assert.equal((await client.client.listTools()).tools.length,18);
    const preview = async (name,args) => {
      const result = await client.call(name,args);
      assert.equal(result.isError,undefined,JSON.stringify(result.content));
      return result.data;
    };
    const confirm = async p => {
      const result = await client.call('confirm_change',{preview_id:p.preview_id,confirm:true});
      assert.equal(result.isError,undefined,JSON.stringify(result.content));
      return result.data;
    };
    let context = await preview('teaching_context',{date:f.date,time_slot:'afternoon'});
    assert.equal(context.instructors.items.find(row=>row.instructor_id===1).available,false);
    await confirm(await preview('preview_instructor_work_schedule',{instructor_id:1,work_date:f.date,time_slot:'afternoon',scheduled_start_time:'14:00',scheduled_end_time:'18:00'}));
    context = await preview('teaching_context',{date:f.date,time_slot:'afternoon'});
    assert.equal(context.instructors.items.find(row=>row.instructor_id===1).available,true);
    const warmup = await confirm(await preview('preview_exercise_create',{name:'합성 준비운동',default_sets:1,default_reps:10}));
    const jump = await confirm(await preview('preview_exercise_create',{name:'합성 점프',default_sets:3,default_reps:5}));
    const p = await preview('preview_class_setup',{date:f.date,time_slot:'afternoon',class_num:1,instructor_id:1,
      assignment_ids:[1],exercises:[{exercise_id:warmup.resource_id,note:'1세트'},{exercise_id:jump.resource_id,note:'3세트'}]});
    const saved = await confirm(p);
    await confirm(p);
    await confirm(await preview('preview_plan_exercises',{plan_id:saved.resource_id,steps:[{action:'move',exercise_id:jump.resource_id,position:1}]}));
    await confirm(await preview('preview_student_record',{date:f.date,student_id:1,record_type_id:3,value:'49.5'}));
    const finalContext = await preview('teaching_context',{date:f.date,time_slot:'afternoon'});
    assert.deepEqual(finalContext.plans.items[0].exercises.map(row=>row.exercise_id),[jump.resource_id,warmup.resource_id]);
    assert.equal(finalContext.students.items.find(row=>row.assignment_id===1).class_num,1);
    assert.equal((await f.peak.query('SELECT COUNT(*) n FROM student_records WHERE student_id=1 AND record_type_id=3 AND measured_at=?',[f.date]))[0][0].n,1);
    const count = async pool=>(await pool.query('SELECT COUNT(*) n FROM max_engine_commands'))[0][0].n;
    assert.equal(await count(f.paca),1); assert.equal(await count(f.peak),5);
    console.log(JSON.stringify({status:'passed',chain:'OAuth/MCP -> actual PEAK gateway -> actual PACA HTTP -> isolated MySQL',
      mcp_version:'0.4.0',tools:18,synthetic_confirmed_commands:6,operational_business_writes:0,
      registered_work_schedule:true,exercise_catalog_entries:2,class_assigned:true,ordered_plan_exercises:2,
      dated_measurement_saved:true,retry_applied_once:true}));
  } finally {
    await client?.client.close();
    for (const item of [mcp,gateway,source]) if(item) { item.server.closeAllConnections();await new Promise(resolve=>item.server.close(resolve)); }
    store?.close();
    if(source) {
      await require(path.join(pacaRoot,'backend/config/database')).end();
      await require(path.join(pacaRoot,'backend/config/peak-database')).end();
    }
    await f?.close();
  }
}
main().catch(error=>{console.error(error.message);process.exitCode=1;});
