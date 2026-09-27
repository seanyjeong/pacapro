const catalog = require('../constants/maxEngineReadCatalog.json');
const repo = require('../repositories/maxEngineFullReadRepository');
const { pageSize } = require('../config/maxEngineFull');
const { fail, decrypt } = require('./maxEngineFullSecurity');

function resources(provider) {
  return Object.entries(catalog).filter(([name]) => name.startsWith(provider + '.')).map(([name, spec]) => ({
    resource: name.split('.')[1], source: spec.provider, fields: spec.columns, page_size: pageSize,
    filters: spec.columns.filter(c => c === 'id' || c.endsWith('_id') || ['date', 'year_month', 'status', 'measured_at', 'test_month', 'class_date'].includes(c))
      .filter(c => c !== 'academy_id'),
  }));
}
async function read(actor, provider, resource, query) {
  const spec = catalog[`${provider}.${resource}`];
  if (!spec) fail(404, 'RESOURCE_NOT_FOUND', '허용된 조회 항목이 아닙니다.');
  if (Object.keys(query).some(k => !['cursor', 'filters'].includes(k))) fail(422, 'INVALID_QUERY', 'cursor와 filters만 사용할 수 있습니다.');
  const cursor = query.cursor ?? '0';
  if (!/^\d+$/.test(String(cursor)) || !Number.isSafeInteger(Number(cursor))) fail(422, 'INVALID_QUERY', 'cursor를 확인해 주세요.');
  let filters = {};
  try { if (query.filters !== undefined) filters = JSON.parse(query.filters); }
  catch { fail(422, 'INVALID_QUERY', 'filters는 JSON 객체여야 합니다.'); }
  const allowed = resources(provider).find(r => r.resource === resource).filters;
  if (!filters || Array.isArray(filters) || typeof filters !== 'object' || Object.entries(filters).some(([k, v]) =>
    !allowed.includes(k) || (v !== null && !['string', 'number', 'boolean'].includes(typeof v)) || String(v).length > 100)) {
    fail(422, 'INVALID_QUERY', '허용된 필터 필드와 단일 값을 확인해 주세요.');
  }
  const rows = await repo.read(spec, actor.academy_id, Number(cursor), filters);
  const next = rows.length > pageSize ? Number(rows[pageSize - 1][spec.key]) : null;
  const page = rows.slice(0, pageSize);
  const ids = spec.paca_student_field ? await repo.pacaStudentIds(actor.academy_id, page.map(r => r.__paca_student_id)) : null;
  const items = page.filter(r => !ids || ids.has(Number(r.__paca_student_id)))
    .map(row => Object.fromEntries(spec.columns.map(field => [field, decrypt(row[field])])));
  return { academy_id: actor.academy_id, resource, items, next_cursor: next };
}
module.exports = { resources, read };
