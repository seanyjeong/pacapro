// AI 연결 직원 권한표가 조회 항목·업무 묶음·쓰기 작업을 빠짐없이 적었는지 — 새 항목이 생기면 여기서 걸러 표에 넣게 한다(빠지면 원장·관리자만).
const catalog = require('../constants/maxEngineReadCatalog.json');
const { commands } = require('../constants/maxEngineCommands');
const { workflows, workflowAliases } = require('../constants/maxEngineWorkflows');
const policy = require('../constants/maxEngineStaffPermissions');

const PAGES = ['students', 'instructors', 'schedules', 'academy_events', 'seasons', 'payments', 'salaries', 'expenses', 'incomes', 'reports',
  'consultations', 'sms', 'notifications', 'settings', 'staff', 'dashboard_finance', 'dashboard_unpaid', 'overtime_approval', 'class_days'];
const valid = need => need === policy.OWNER || (Array.isArray(need) && need.every(([page, action]) => PAGES.includes(page) && ['view', 'edit'].includes(action)));

test('every readable table, workflow and command has an explicit staff rule using PACA permission pages', () => {
  for (const spec of Object.values(catalog)) expect({ table: `${spec.provider}.${spec.table}`, ok: valid(policy.tables[`${spec.provider}.${spec.table}`]) })
    .toEqual({ table: `${spec.provider}.${spec.table}`, ok: true });
  for (const provider of Object.keys(workflows)) {
    for (const name of [...Object.keys(workflows[provider]), ...Object.keys(workflowAliases[provider] || {})]) {
      const spec = policy.workflows[`${provider}.${name}`];
      expect({ name: `${provider}.${name}`, ok: !!spec && valid(spec.need) && Object.values(spec.sections || {}).every(valid) })
        .toEqual({ name: `${provider}.${name}`, ok: true });
    }
  }
  for (const operation of Object.keys(commands)) expect({ operation, ok: valid(policy.commands[operation]) }).toEqual({ operation, ok: true });
  for (const page of Object.keys(policy.labels)) expect(PAGES).toContain(page);
});
