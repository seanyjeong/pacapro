// AI 연결 직원 권한 검사 — 표는 constants/maxEngineStaffPermissions.js. 원장·관리자는 늘 통과, 직원은 매 요청 다시 읽은 파카 권한(users.permissions)으로.
const catalog = require('../constants/maxEngineReadCatalog.json');
const policy = require('../constants/maxEngineStaffPermissions');
const { fail } = require('./maxEngineFullSecurity');

const FULL = ['owner', 'admin'];
// 모자란 권한 하나(없으면 null). 표에 없는 것은 원장·관리자만.
function missing(actor, need) {
  if (FULL.includes(actor.role)) return null;
  if (need === undefined || need === policy.OWNER) return policy.OWNER;
  return need.find(([page, action]) => actor.permissions?.[page]?.[action] !== true) || null;
}
function check(actor, need) {
  const lack = missing(actor, need);
  if (!lack) return;
  if (lack === policy.OWNER) fail(403, 'PERMISSION_DENIED', '원장·관리자만 할 수 있습니다(파카 직원 권한 밖).');
  const [page, action] = lack;
  fail(403, 'PERMISSION_DENIED', `파카 직원 권한에 '${policy.labels[page] || page} ${action === 'view' ? '조회' : '수정'}'이 없습니다. 원장이 파카 직원 관리에서 켜 주면 쓸 수 있습니다.`);
}
const tableNeed = (provider, resource) => {
  const spec = catalog[`${provider}.${resource}`];
  return spec ? policy.tables[`${spec.provider}.${spec.table}`] : null;
};
const workflowSpec = (provider, workflow) => policy.workflows[`${provider}.${workflow}`];

function read(actor, provider, resource) {
  const need = tableNeed(provider, resource);
  if (need !== null) check(actor, need);   // 없는 조회 항목은 읽기 서비스가 404 로
}
function workflow(actor, provider, workflowName) { check(actor, workflowSpec(provider, workflowName)?.need); }
function command(actor, operation) { check(actor, policy.commands[operation]); }
// 업무 묶음 결과에서 권한 없는 칸만 비운다
function redact(actor, provider, workflowName, result) {
  const sections = workflowSpec(provider, workflowName)?.sections || {};
  const out = { ...result };
  for (const [key, need] of Object.entries(sections)) {
    if (key in out && missing(actor, need)) out[key] = { hidden: true, reason: '파카 직원 권한 밖' };
  }
  return out;
}
// 목록(list_capabilities)에는 쓸 수 있는 것만
function catalogFor(actor, provider, { resources, workflows, commands }) {
  return {
    resources: resources.filter(r => !missing(actor, tableNeed(provider, r.resource) ?? undefined)),
    workflows: workflows.filter(w => !missing(actor, workflowSpec(provider, w.name)?.need)),
    commands: commands.filter(c => !missing(actor, policy.commands[c.operation])),
  };
}
module.exports = { read, workflow, command, redact, catalogFor };
