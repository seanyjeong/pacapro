const rows = require('./maxEngineReadRows');
const { fields } = require('../constants/maxEngineWorkflows');
const { displays } = require('../constants/maxEngineReadOptions');
const { table } = require('./maxEngineWorkflowInput');
const { fail } = require('./maxEngineFullSecurity');
function cents(value) {
  const text = String(value ?? '0');
  if (!/^-?\d+(\.\d{1,2})?$/.test(text)) fail(409, 'INVALID_AMOUNT', '원본 금액 형식을 확인해 주세요.');
  const [whole, decimal = ''] = text.replace(/^-/, '').split('.');
  return (text.startsWith('-') ? -1n : 1n) * (BigInt(whole) * 100n + BigInt(decimal.padEnd(2, '0')));
}
// Amount strings preserve exact cents; no binary floating-point accumulation.
const amount = value => { const n = value < 0n ? -value : value; return `${value < 0n ? '-' : ''}${n / 100n}.${String(n % 100n).padStart(2, '0')}`; };
async function payments(actor, p, unpaidOnly = false, studentId) {
  const filters = { ...(p.month ? { year_month: p.month } : {}), ...(studentId ? { student_id: studentId } : {}) };
  const source = await rows.all(actor, 'paca', 'student_payments', filters, { columns: fields.payment });
  const eligible = source.filter(r => r.payment_status !== 'cancelled');
  let billed = 0n, paid = 0n, unpaid = 0n;
  const items = eligible.map(r => {
    const final = BigInt(cents(r.final_amount)), received = BigInt(cents(r.paid_amount ?? '0'));
    const remaining = final > received ? final - received : 0n;
    billed += final; paid += received; unpaid += remaining;
    return { ...r, outstanding: amount(remaining) };
  }).filter(r => !unpaidOnly || r.outstanding !== '0.00');
  const students = new Map((await rows.byIds(actor, 'paca', 'students', items.map(r => r.student_id), displays.students)).map(s => [s.id, s]));
  return { month: p.month ?? null, billed: amount(billed), paid: amount(paid), unpaid: amount(unpaid),
    bill_count: eligible.length, cancelled_count: source.length - eligible.length,
    ...table(items.map(r => ({ ...r, student: students.get(r.student_id) || null }))) };
}
module.exports = { payments };
