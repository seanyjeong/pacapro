const paca = require('../config/database');
const peak = require('../config/peak-database');
const { pageSize } = require('../config/maxEngineFull');

async function read(spec, academyId, cursor, filters, options = {}) {
  const db = spec.provider === 'paca' ? paca : peak;
  const owned = spec.shared ? `(${spec.scope} = ? OR (${spec.shared_predicate}))` : `${spec.scope} = ?`;
  const params = [academyId, cursor];
  const clauses = [owned, `t.\`${spec.key}\` > ?`];
  if (spec.columns.includes('deleted_at')) clauses.push('t.deleted_at IS NULL');
  if (spec.provider === 'paca' && spec.join?.includes('students s ON')) clauses.push('s.deleted_at IS NULL');
  if (options.ids) {
    if (!options.ids.length) return [];
    clauses.push(`t.\`${spec.key}\` IN (${options.ids.map(() => '?').join(',')})`);
    params.push(...options.ids);
  }
  for (const [field, value] of Object.entries(filters)) {
    clauses.push(value === null ? `t.\`${field}\` IS NULL` : `t.\`${field}\` = ?`);
    if (value !== null) params.push(value);
  }
  // options are constructed only by the trusted service, never from raw query JSON.
  for (const [field, values] of Object.entries(options.in || {})) {
    if (!spec.columns.includes(field)) throw new Error('Unknown internal field');
    if (!values.length) return [];
    clauses.push(`t.\`${field}\` IN (${values.map(() => '?').join(',')})`);
    params.push(...values);
  }
  for (const [field, from, to] of options.ranges || []) {
    if (!spec.columns.includes(field)) throw new Error('Unknown internal field');
    clauses.push(`t.\`${field}\` >= ? AND t.\`${field}\` <= ?`);
    params.push(from, to);
  }
  const columns = options.columns || spec.columns;
  if (columns.some(c => !spec.columns.includes(c))) throw new Error('Unknown internal column');
  const limit = options.limit || pageSize;
  const [rows] = await db.execute(
    `SELECT ${columns.map(c => `t.\`${c}\``).join(', ')} ${spec.paca_student_field ? ', ' + spec.paca_student_field + ' AS __paca_student_id' : ''}
     FROM \`${spec.table}\` t
     ${spec.join ? 'JOIN ' + spec.join : ''} WHERE ${clauses.join(' AND ')}
     ORDER BY t.\`${spec.key}\` LIMIT ${limit + 1}`, params);
  return rows;
}
async function pacaStudentIds(academyId, ids) {
  if (!ids.length) return new Set();
  const [rows] = await paca.execute(`SELECT id FROM students WHERE academy_id = ? AND deleted_at IS NULL
    AND id IN (${ids.map(() => '?').join(',')})`, [academyId, ...ids]);
  return new Set(rows.map(r => Number(r.id)));
}
module.exports = { read, pacaStudentIds };
