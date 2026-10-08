/** DB boundary double; controller, auth, service, repository and amount calculations stay real. */
const clone = value => JSON.parse(JSON.stringify(value));
const normalizedJson = value => Object.fromEntries(Object.entries(typeof value === 'string' ? JSON.parse(value) : value).sort(([a], [b]) => a.localeCompare(b)));
function fixture() {
  const data = {
    user: { id: 100, email: 'synthetic@example.invalid', name: '합성 원장', role: 'owner', academy_id: 1,
      is_active: 1, approval_status: 'approved', permissions: '{}', deleted_at: null },
    student: { id: 101, academy_id: 1, name: '합성 휴원생', status: 'paused', rest_start_date: '2026-05-01', rest_end_date: null,
      rest_reason: null, student_number: 'SYNTHETIC-101', student_type: 'exam', admission_type: 'regular', grade: '고3',
      class_days: '[]', weekly_count: 0, monthly_tuition: '300000.00', discount_rate: '0.00', is_trial: 0, time_slot: 'evening' },
    bills: [
      { id: 701, student_id: 101, academy_id: 1, year_month: '2026-05', payment_type: 'monthly', base_amount: '300000.00',
        final_amount: '300000.00', paid_amount: '0.00', payment_status: 'pending', is_prorated: 0, proration_details: null, notes: '원본 청구' },
      { id: 702, student_id: 101, academy_id: 1, year_month: '2026-05', payment_type: 'monthly', base_amount: '300000.00',
        final_amount: '300000.00', paid_amount: '200000.00', payment_status: 'partial', is_prorated: 0, proration_details: null, notes: '원본 부분납' },
      { id: 703, student_id: 101, academy_id: 1, year_month: '2026-05', payment_type: 'monthly', base_amount: '300000.00',
        final_amount: '300000.00', paid_amount: '300000.00', payment_status: 'paid', is_prorated: 0, proration_details: null, notes: '납부 완료 이력' },
      { id: 704, student_id: 101, academy_id: 1, year_month: '2026-05', payment_type: 'monthly', base_amount: '300000.00',
        final_amount: '0.00', paid_amount: '0.00', payment_status: 'cancelled', is_prorated: 0, proration_details: null, notes: '수동 취소 이력' },
    ],
    audits: [], credits: [], seasons: [], revenues: [{ id: 901, payment_id: 702, amount: '200000.00' }],
    expenses: [{ id: 902, amount: '12345.00' }],
  };
  let snapshot = null;
  const conn = {
    beginTransaction: jest.fn(async () => { snapshot = clone(data); }),
    commit: jest.fn(async () => { snapshot = null; }),
    rollback: jest.fn(async () => { if (snapshot) Object.assign(data, clone(snapshot)); snapshot = null; }),
    release: jest.fn(),
    execute: jest.fn(async (sql, params = []) => {
      if (/^\s*SET TRANSACTION READ ONLY/i.test(sql)) return [[], []];
      if (/^\s*SELECT/i.test(sql)) {
        if (/FROM users\b/i.test(sql)) return [[...(params[0] === data.user.id ? [clone(data.user)] : [])], []];
        if (/FROM students\b/i.test(sql)) return [[...(params[0] === data.student.id && (params.length === 1 || params[1] === data.student.academy_id) ? [clone(data.student)] : [])], []];
        if (/FROM student_payments\b/i.test(sql)) {
          let bills = data.bills.filter(row => row.academy_id === params[0] && row.student_id === params[1]);
          const months = params.filter(value => typeof value === 'string' && /^\d{4}-\d{2}$/.test(value));
          if (months.length) bills = bills.filter(row => row.payment_type === 'monthly'
            && (months.length === 1 ? row.year_month === months[0] : row.year_month >= months[0] && row.year_month <= months[1]));
          bills.sort((a, b) => a.year_month.localeCompare(b.year_month) || a.id - b.id);
          return [clone(bills), []];
        }
        if (/FROM max_engine_payment_settlements/i.test(sql)) {
          const ids = params.slice(2), latest = new Map();
          for (const row of data.audits) if (row.academy_id === params[0] && row.student_id === params[1] && ids.includes(row.payment_id)) latest.set(row.payment_id, row);
          const scoped = data.audits.filter(row => row.academy_id === params[0] && row.student_id === params[1] && ids.includes(row.payment_id));
          return [clone(/NOT EXISTS/i.test(sql) ? [...latest.values()] : scoped), []];
        }
        if (/FROM rest_credits/i.test(sql)) return [clone(/WHERE id\s*=\s*\?/i.test(sql)
          ? data.credits.filter(row => row.id === params[0] && row.student_id === params[1] && row.academy_id === params[2]) : data.credits), []];
        if (/FROM student_seasons/i.test(sql)) return [clone(data.seasons), []];
      }
      if (/^\s*UPDATE student_payments\b/i.test(sql)) {
        const fields = [...sql.split(/\bWHERE\b/i)[0].matchAll(/\b(\w+)\s*=\s*\?/g)].map(match => match[1]);
        const [id, studentId, academyId] = params.slice(fields.length);
        const row = data.bills.find(bill => bill.id === id && bill.student_id === studentId && bill.academy_id === academyId);
        if (!row) return [{ affectedRows: 0 }, []];
        fields.forEach((field, i) => { row[field] = field === 'proration_details' ? normalizedJson(params[i]) : params[i]; });
        if (/is_prorated\s*=\s*1/i.test(sql)) row.is_prorated = 1;
        return [{ affectedRows: 1 }, []];
      }
      if (/^\s*INSERT INTO max_engine_payment_settlements/i.test(sql)) {
        const [academy_id, student_id, payment_id, action, settlement_date, before_final_amount, before_paid_amount,
          after_final_amount, after_paid_amount, waived_amount, reason, recorded_by] = params;
        const row = { id: data.audits.length + 1, academy_id, student_id, payment_id, action, settlement_date,
          before_final_amount, before_paid_amount, after_final_amount, after_paid_amount, waived_amount,
          refund_amount: '0.00', expense_id: null, reason, recorded_by };
        data.audits.push(row); return [{ affectedRows: 1, insertId: row.id }, []];
      }
      if (/^\s*INSERT INTO rest_credits\b/i.test(sql)) {
        const fields = sql.match(/\(([\s\S]*?)\)\s*VALUES/i)[1].split(',').map(field => field.trim());
        const values = sql.match(/\bVALUES\s*\(([\s\S]*?)\)/i)[1].split(',').map(value => value.trim());
        let bind = 0; const row = { id: 77 + data.credits.length };
        fields.forEach((field, i) => { row[field] = values[i] === '?' ? params[bind++] : values[i].replace(/^'|'$/g, ''); });
        data.credits.push(row); return [{ insertId: row.id, affectedRows: 1 }, []];
      }
      if (/^\s*UPDATE students\b/i.test(sql)) {
        const fields = [...sql.split(/\bWHERE\b/i)[0].matchAll(/\b(\w+)\s*=\s*\?/g)].map(match => match[1]);
        fields.forEach((field, i) => { data.student[field] = params[i]; });
        if (/status\s*=\s*'withdrawn'/i.test(sql)) data.student.status = 'withdrawn';
        if (/status\s*=\s*'paused'/i.test(sql)) data.student.status = 'paused';
        return [{ affectedRows: 1 }, []];
      }
      if (/^\s*UPDATE student_seasons\b/i.test(sql)) {
        for (const row of data.seasons.filter(item => params.slice(3).includes(item.id))) {
          row.is_cancelled = 1; row.cancellation_date = params[0]; row.after_season_action = 'terminate';
        }
        return [{ affectedRows: params.length - 3 }, []];
      }
      if (/^\s*DELETE a FROM attendance/i.test(sql)) return [{ affectedRows: 0 }, []];
      throw new Error(`Unhandled synthetic DB statement: ${sql}`);
    }),
  };
  conn.query = conn.execute;
  const pool = { execute: conn.execute, query: conn.execute, getConnection: jest.fn(async () => conn) };
  return { data, conn, pool, snapshot: () => clone(data) };
}
module.exports = { fixture };
