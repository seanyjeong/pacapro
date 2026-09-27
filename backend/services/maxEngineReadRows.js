const catalog = require('../constants/maxEngineReadCatalog.json');
const repo = require('../repositories/maxEngineFullReadRepository');
const { scanLimit, maxIds } = require('../constants/maxEngineReadOptions');
const { decrypt, fail } = require('./maxEngineFullSecurity');

async function page(actor, spec, cursor, filters, options = {}) {
  const limit = options.limit || 100;
  const rows = await repo.read(spec, actor.academy_id, cursor, filters, options);
  const next = rows.length > limit ? Number(rows[limit - 1][spec.key]) : null;
  const slice = rows.slice(0, limit);
  const owned = spec.paca_student_field
    ? await repo.pacaStudentIds(actor.academy_id, slice.map(r => r.__paca_student_id)) : null;
  const columns = options.columns || spec.columns;
  return { items: slice.filter(r => !owned || owned.has(Number(r.__paca_student_id)))
    .map(r => Object.fromEntries(columns.map(k => [k, decrypt(r[k])]))), next_cursor: next };
}
async function all(actor, provider, resource, filters = {}, options = {}) {
  const spec = catalog[`${provider}.${resource}`];
  if (!spec) fail(404, 'RESOURCE_NOT_FOUND', '허용된 조회 항목이 아닙니다.');
  const items = [];
  let cursor = 0;
  for (let scanned = 0; scanned < scanLimit; scanned += 1000) {
    const result = await page(actor, spec, cursor, filters, { ...options, limit: 1000 });
    items.push(...result.items);
    if (result.next_cursor === null) return items;
    cursor = result.next_cursor;
  }
  fail(422, 'QUERY_TOO_BROAD', '조회 범위가 10,000행을 넘습니다. 기간이나 학생을 좁혀 주세요.');
}
async function byIds(actor, provider, resource, ids, columns) {
  const unique = [...new Set(ids.filter(id => Number.isSafeInteger(Number(id)) && Number(id) > 0).map(Number))];
  const rows = [];
  for (let i = 0; i < unique.length; i += maxIds) {
    rows.push(...await all(actor, provider, resource, {}, { ids: unique.slice(i, i + maxIds), columns }));
  }
  return rows;
}
module.exports = { page, all, byIds };
