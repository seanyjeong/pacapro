import { jsonRoute, normalizePacaApiPath } from './paca-smoke-utils.mjs';

export async function installParentNameRoutes(context, state) {
  state.students = [makeStudent({ name: '김첫째' }), makeStudent({ id: 78, name: '김둘째', student_number: '2026078' }),
    makeStudent({ id: 79, name: '이학생', father_name: null, mother_name: null })];
  const today = new Date();
  state.payments = state.students.map((student, index) => ({
    id: 501 + index, student_id: student.id, student_name: student.name, student_number: student.student_number,
    father_name: student.father_name, mother_name: student.mother_name, phone: student.phone,
    year_month: `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`,
    payment_type: 'monthly', base_amount: 350000, discount_amount: 0, additional_amount: 0,
    final_amount: 350000, paid_amount: 100000, remaining_amount: 250000, due_date: '2026-09-01',
    payment_status: 'partial', days_overdue: 10, created_at: '2026-09-01T00:00:00Z',
  }));
  state.writes = [];
  await context.route('**/*', async (route) => {
    const req = route.request();
    const url = new URL(req.url());
    if (url.hostname !== 'supermax.kr') return route.continue();
    const path = normalizePacaApiPath(url);
    const method = req.method();
    if (method !== 'GET') {
      state.writes.push({ method, path, body: req.postDataJSON() });
      if (state.failSave) return jsonRoute(route, { message: '저장하지 못했습니다. 다시 시도해주세요.' }, 500);
      if (path.startsWith('/students')) {
        state.students[0] = { ...state.students[0], ...req.postDataJSON() };
        return jsonRoute(route, { student: state.students[0], message: '저장 완료' }, method === 'POST' ? 201 : 200);
      }
      const payment = state.payments.find(item => path === `/payments/${item.id}/pay`);
      if (payment) {
        Object.assign(payment, { paid_amount: 350000, remaining_amount: 0, payment_status: 'paid' });
        return jsonRoute(route, { payment, message: '납부 완료' });
      }
      return jsonRoute(route, { message: 'Unexpected fixture write' }, 400);
    }
    if (path === '/settings/academy') return jsonRoute(route, { settings: { exam_tuition: {}, adult_tuition: {}, tuition_due_day: 5 } });
    if (path === '/seasons/registerable') return jsonRoute(route, { seasons: [] });
    if (path === '/students/class-days') return jsonRoute(route, { students: state.students });
    if (path === '/students') {
      const search = (url.searchParams.get('search') || '').trim().replace(/\s+/g, '');
      const students = state.students.filter(s => !search || [s.name, s.father_name, s.mother_name].some(v => v?.includes(search)));
      return jsonRoute(route, { students, message: '조회 완료' });
    }
    if (/^\/students\/\d+$/.test(path)) return jsonRoute(route, {
      student: state.students.find(s => s.id === Number(path.split('/').pop())), payments: [], performances: [],
    });
    if (path.startsWith('/payments')) {
      const payment = state.payments.find(p => path === `/payments/${p.id}`);
      if (payment) return jsonRoute(route, { payment });
      return jsonRoute(route, { payments: state.payments, count: state.payments.length, date: '2026-09-14' });
    }
    return jsonRoute(route, { message: 'fixture', total: 0, records: [], seasons: [], history: [] });
  });
}

export function makeStudent(overrides = {}) {
  return {
    id: 77,
    academy_id: 1,
    student_number: '2026077',
    name: '김신규',
    gender: 'male',
    student_type: 'exam',
    phone: '010-2222-3333',
    parent_phone: '',
    father_name: '김아버지',
    mother_name: '박어머니',
    school: '일산고',
    grade: '고2',
    age: null,
    address: null,
    admission_type: 'regular',
    profile_image_url: null,
    class_days: [],
    weekly_count: 0,
    monthly_tuition: '0',
    discount_rate: '0',
    discount_reason: null,
    payment_due_day: 5,
    final_monthly_tuition: '0',
    is_season_registered: false,
    current_season_id: null,
    status: 'active',
    rest_start_date: null,
    rest_end_date: null,
    rest_reason: null,
    enrollment_date: '2026-06-22',
    withdrawal_date: null,
    notes: null,
    is_trial: false,
    trial_remaining: null,
    trial_dates: null,
    time_slot: 'evening',
    memo: null,
    class_days_next: null,
    class_days_effective_from: null,
    consultation_date: null,
    created_at: '2026-06-22T09:00:00.000Z',
    updated_at: '2026-06-22T09:00:00.000Z',
    deleted_at: null,
    ...overrides,
  };
}
