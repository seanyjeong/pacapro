const db = require('../config/database');
const { pageSize } = require('../config/maxEngineSync');
const { isoToMysql } = require('../models/maxEngineSyncPage');
async function serverTime() {
  // Source TIMESTAMP has second precision: checkpoint only a closed second so
  // later writes in the current second remain eligible for the next strict > scan.
  const [rows] = await db.execute("SELECT DATE_FORMAT(UTC_TIMESTAMP() - INTERVAL 1 SECOND, '%Y-%m-%dT%H:%i:%sZ') AS server_time");
  return new Date(rows[0].server_time).toISOString();
}
async function students(page) {
  const where = ['academy_id = ?', 'updated_at <= ?'];
  const params = [page.academyId, isoToMysql(page.watermark)];
  if (page.since) { where.push('updated_at > ?'); params.push(isoToMysql(page.since)); }
  if (page.after) {
    where.push('(updated_at > ? OR (updated_at = ? AND id > ?))');
    params.push(page.after.updated_at, page.after.updated_at, page.after.id);
  }
  // No status/deleted filter: tombstones and prospect students are required for safe reconciliation.
  const [rows] = await db.execute(`SELECT id, academy_id, name, gender, school, grade,
    phone, parent_phone, admission_type, status, deleted_at, updated_at
    FROM students WHERE ${where.join(' AND ')} ORDER BY updated_at, id LIMIT ${pageSize + 1}`, params);
  return rows;
}
module.exports = { serverTime, students };
