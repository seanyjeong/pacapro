/** Default is read-only; writes require a reviewed source plan and caller transaction. */
require('dotenv').config();
const fs = require('fs');
const repair = require('../services/studentPausedBillingRepairService');

async function main() {
  const args = process.argv.slice(2);
  const value = name => {
    const index = args.indexOf(name);
    return index >= 0 && args[index + 1] && !args[index + 1].startsWith('--') ? args[index + 1] : undefined;
  };
  const options = { academyId: Number(value('--academy-id')), userId: Number(value('--actor-id')),
    academyName: value('--academy-name') };
  const output = value('--output');
  if (!output) throw new Error('--output is required');
  const applyMode = args.includes('--apply');
  if (applyMode && !value('--plan')) throw new Error('--plan is required for --apply');
  if (![options.academyId, options.userId].every(id => Number.isSafeInteger(id) && id > 0) || !options.academyName) {
    throw new Error('--academy-id, --academy-name and --actor-id are required');
  }
  const pool = require('../config/database');
  const conn = await pool.getConnection();
  let outputCreated = false, commitAttempted = false;
  try {
    if (!applyMode) await conn.query('SET TRANSACTION READ ONLY');
    await conn.beginTransaction();
    const result = applyMode
      ? await repair.apply(conn, options, JSON.parse(fs.readFileSync(value('--plan'), 'utf8')))
      : await repair.plan(conn, options);
    fs.writeFileSync(output, JSON.stringify(result, null, 2) + '\n', { mode: 0o600, flag: 'wx' });
    outputCreated = true;
    if (applyMode) { commitAttempted = true; await conn.commit(); } else await conn.rollback();
    process.stdout.write(JSON.stringify({ status: applyMode ? 'applied' : 'read_only_preview',
      corrected: applyMode ? result.results.length : result.corrections.length, review: result.review.length }) + '\n');
  } catch (error) {
    await conn.rollback();
    if (applyMode && outputCreated && !commitAttempted) fs.unlinkSync(output);
    if (applyMode && outputCreated && commitAttempted) {
      const result = JSON.parse(fs.readFileSync(output, 'utf8'));
      fs.writeFileSync(output, JSON.stringify({ ...result, commit_status: 'unverified' }, null, 2) + '\n');
    }
    throw error;
  } finally { conn.release(); await pool.end(); }
}

main().catch(error => { process.stderr.write(error.message + '\n'); process.exitCode = 1; });
