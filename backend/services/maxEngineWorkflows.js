const { workflows } = require('../constants/maxEngineWorkflows');
const { validate, today, table } = require('./maxEngineWorkflowInput');
const students = require('./maxEngineWorkflowStudents');
const { classes, attendance } = require('./maxEngineWorkflowClasses');
const { overview } = require('./maxEngineWorkflowOverview');
const { payments } = require('./maxEngineWorkflowPayments');
const { schedule } = require('./maxEngineWorkflowConsultations');
const { records } = require('./maxEngineWorkflowRecords');
const { fail } = require('./maxEngineFullSecurity');
function catalog(provider) {
  return Object.entries(workflows[provider]).map(([name, parameters]) => ({ name, parameters, read_only: true }));
}
async function read(actor, provider, workflow, query) {
  if (Object.keys(query).some(k => k !== 'params')) fail(422, 'INVALID_QUERY', 'params만 지정해 주세요.');
  let input = {};
  try {
    if (query.params !== undefined) {
      if (typeof query.params !== 'string' || query.params.length > 2000) throw new Error('params');
      input = JSON.parse(query.params);
    }
  } catch { fail(422, 'INVALID_QUERY', 'params는 JSON 객체여야 합니다.'); }
  const p = validate(provider, workflow, input);
  let result;
  if (provider === 'peak') result = await records(actor, p, workflow);
  else switch (workflow) {
    case 'classes_with_students': result = await classes(actor, p); break;
    case 'attendance_summary': result = await attendance(actor, p); break;
    case 'student_overview': result = await overview(actor, p); break;
    case 'student_search': result = table(await students.search(actor, provider, p)); break;
    case 'unpaid_list': result = await payments(actor, p, true); break;
    case 'payment_status': result = await payments(actor, p); break;
    case 'consultation_schedule': result = await schedule(actor, p); break;
    case 'trial_students': result = await students.trial(actor, p); break;
    case 'today_brief': {
      const date = today();
      const [classList, attendanceSummary, unpaid, consultations] = await Promise.all([
        classes(actor, { date }), attendance(actor, { date }), payments(actor, { month: date.slice(0, 7) }, true), schedule(actor, { date }),
      ]);
      result = { date, classes: classList, attendance: attendanceSummary, unpaid, consultations }; break;
    }
  }
  return { academy_id: actor.academy_id, workflow, ...result };
}
module.exports = { catalog, read };
