const paca = require('../config/database');
const peak = require('../config/peak-database');
const { pageSize } = require('../config/maxEngineFull');

async function read(spec, academyId, cursor, filters) {
  const db = spec.provider === 'paca' ? paca : peak;
  const owned = spec.shared ? `(${spec.scope} = ? OR (${spec.shared_predicate}))` : `${spec.scope} = ?`;
  const params = [academyId, cursor];
  const clauses = [owned, `t.\`${spec.key}\` > ?`];
  if (spec.columns.includes('deleted_at')) clauses.push('t.deleted_at IS NULL');
  for (const [field, value] of Object.entries(filters)) {
    clauses.push(value === null ? `t.\`${field}\` IS NULL` : `t.\`${field}\` = ?`);
    if (value !== null) params.push(value);
  }
  const [rows] = await db.execute(
    `SELECT ${spec.columns.map(c => `t.\`${c}\``).join(', ')} ${spec.paca_student_field ? ', ' + spec.paca_student_field + ' AS __paca_student_id' : ''}
     FROM \`${spec.table}\` t
     ${spec.join ? 'JOIN ' + spec.join : ''} WHERE ${clauses.join(' AND ')}
     ORDER BY t.\`${spec.key}\` LIMIT ${pageSize + 1}`, params);
  return rows;
}
async function pacaStudentIds(academyId, ids) {
  if (!ids.length) return new Set();
  const [rows] = await paca.execute(`SELECT id FROM students WHERE academy_id = ? AND deleted_at IS NULL
    AND id IN (${ids.map(() => '?').join(',')})`, [academyId, ...ids]);
  return new Set(rows.map(r => Number(r.id)));
}
module.exports = { read, pacaStudentIds };
