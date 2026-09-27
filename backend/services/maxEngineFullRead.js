const catalog = require('../constants/maxEngineReadCatalog.json');
const rows = require('./maxEngineReadRows');
const { pageSize } = require('../config/maxEngineFull');
const { displays, relations, maxIds } = require('../constants/maxEngineReadOptions');
const { fail } = require('./maxEngineFullSecurity');

function expansions(spec) {
  return Object.fromEntries(Object.entries(relations[spec.provider]).filter(([, [field, target]]) =>
    spec.columns.includes(field) && catalog[`${spec.provider}.${target}`]));
}
function resources(provider) {
  return Object.entries(catalog).filter(([name]) => name.startsWith(provider + '.')).map(([name, spec]) => ({
    resource: name.split('.')[1], source: spec.provider, fields: spec.columns, page_size: pageSize, max_ids: maxIds,
    expand: Object.fromEntries(Object.entries(expansions(spec)).map(([key, [, target]]) => [key, displays[target]])),
    filters: spec.columns.filter(c => c === 'id' || c.endsWith('_id') || ['date', 'year_month', 'status', 'measured_at', 'test_month', 'class_date'].includes(c))
      .filter(c => c !== 'academy_id'),
  }));
}
function parse(value, fallback) {
  if (value === undefined) return fallback;
  if (typeof value !== 'string' || value.length > 4000) fail(422, 'INVALID_QUERY', 'JSON 조회 조건을 확인해 주세요.');
  try { return JSON.parse(value); }
  catch { fail(422, 'INVALID_QUERY', '조회 조건은 JSON이어야 합니다.'); }
}
async function read(actor, provider, resource, query) {
  const spec = catalog[`${provider}.${resource}`];
  if (!spec) fail(404, 'RESOURCE_NOT_FOUND', '허용된 조회 항목이 아닙니다.');
  if (Object.keys(query).some(k => !['cursor', 'filters', 'ids', 'expand'].includes(k))) fail(422, 'INVALID_QUERY', 'cursor·filters·ids·expand만 사용할 수 있습니다.');
  const cursor = query.cursor ?? '0';
  if (typeof cursor !== 'string' || !/^\d+$/.test(cursor) || !Number.isSafeInteger(Number(cursor))) fail(422, 'INVALID_QUERY', 'cursor를 확인해 주세요.');
  const filters = parse(query.filters, {}), ids = parse(query.ids), expand = parse(query.expand, []);
  const allowed = resources(provider).find(r => r.resource === resource).filters;
  if (!filters || Array.isArray(filters) || typeof filters !== 'object' || Object.entries(filters).some(([k, v]) =>
    !allowed.includes(k) || (v !== null && !['string', 'number', 'boolean'].includes(typeof v)) || String(v).length > 100)) {
    fail(422, 'INVALID_QUERY', '허용된 필터 필드와 단일 값을 확인해 주세요.');
  }
  if (ids !== undefined && (!Array.isArray(ids) || !ids.length || ids.length > maxIds || ids.some(id => !Number.isSafeInteger(id) || id <= 0))) {
    fail(422, 'INVALID_QUERY', 'ids는 양의 정수 1~200개여야 합니다.');
  }
  const relations = expansions(spec);
  if (!Array.isArray(expand) || expand.length > 5 || expand.some(k => typeof k !== 'string' || !Object.hasOwn(relations, k))) {
    fail(422, 'INVALID_QUERY', 'catalog에 있는 표시용 expand만 지정해 주세요.');
  }
  const result = await rows.page(actor, spec, Number(cursor), filters, { ids, limit: ids ? maxIds : pageSize });
  for (const key of new Set(expand)) {
    const [field, target] = relations[key];
    const related = await rows.byIds(actor, spec.provider, target, result.items.map(r => r[field]), displays[target]);
    const index = new Map(related.map(r => [Number(r.id), r]));
    for (const item of result.items) (item.expanded ||= {})[key] = index.get(Number(item[field])) || null;
  }
  return { academy_id: actor.academy_id, resource, ...result };
}
module.exports = { resources, read };
