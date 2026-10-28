// AI 연결(ChatGPT·아이작 MCP)에서 직원(staff) 계정이 쓸 수 있는 범위 — 파카 직원 권한 화면(src/lib/types/staff.ts, 항목별 view·edit)과 같은 기준.
// 기준: 같은 일을 하는 파카 화면 API 가 checkPermission 으로 검사하면 그 항목, 검사가 없는 조회는 권한 화면 항목(학생 관리·상담·스케줄 …),
// requireRole('owner'|'admin') 로 막힌 것은 원장·관리자만. PEAK(실기) 화면은 직원 허용(requireTrainer)이라 [] — 운동팩 만들기·기능 권한만 원장·관리자.
// 값: 모두 있어야 하는 [항목, 'view'|'edit'] 목록, [] = 직원 누구나, OWNER = 원장·관리자만. 표에 없는 조회·작업도 원장·관리자만.
// 원장(owner)·관리자(admin)는 이 표와 상관없이 전부.
const OWNER = 'owner';
const view = page => [[page, 'view']];
const edit = (...pages) => pages.map(page => [page, 'edit']);
const ANY = [];

// 조회 — 실제 테이블(catalog 의 provider.table) 기준. 학원관리·실기관리 어느 쪽 연결로 읽어도 같다.
const tables = {
  'paca.academies': ANY,
  'paca.academy_events': view('academy_events'),
  'paca.holidays': view('academy_events'),
  'paca.academy_settings': view('settings'),
  'paca.toss_settings': view('settings'),
  'paca.attendance': view('schedules'),
  'paca.class_schedules': view('schedules'),
  'paca.classes': view('schedules'),
  'paca.instructor_schedules': view('schedules'),
  'paca.consultations': view('consultations'),
  'paca.consultation_blocked_slots': view('consultations'),
  'paca.consultation_settings': view('consultations'),
  'paca.consultation_weekly_hours': view('consultations'),
  'paca.student_consultations': view('consultations'),
  'paca.students': view('students'),
  'paca.student_classes': view('students'),
  'paca.student_performance': view('students'),
  'paca.test_applicants': view('students'),
  'paca.student_payments': view('payments'),
  'paca.rest_credits': view('payments'),
  'paca.toss_payment_history': view('payments'),
  'paca.toss_payment_queue': view('payments'),
  'paca.max_engine_payment_settlements': view('payments'),
  'paca.revenues': view('reports'),
  'paca.expenses': view('expenses'),
  'paca.other_incomes': view('incomes'),
  'paca.instructors': view('instructors'),
  'paca.instructor_attendance': view('instructors'),
  'paca.overtime_approvals': view('overtime_approval'),
  'paca.salary_records': view('salaries'),
  'paca.seasons': view('seasons'),
  'paca.season_settings': view('seasons'),
  'paca.student_seasons': view('seasons'),
  'paca.notifications': view('notifications'),
  'paca.notification_logs': view('notifications'),
  'paca.notification_settings': view('notifications'),
  'paca.attendance_notification_queue': view('notifications'),
  'paca.sender_numbers': view('sms'),
  'paca.users': OWNER,
  'peak.academy_feature_permissions': OWNER,
};
const PEAK_TABLES = ['class_instructors', 'class_presets', 'daily_assignments', 'daily_attendance', 'daily_plans', 'exercise_pack_items',
  'exercise_packs', 'exercise_tags', 'exercises', 'monthly_test_records', 'monthly_test_types', 'monthly_tests', 'notifications', 'peak_settings',
  'preset_group_members', 'preset_groups', 'record_type_conflicts', 'record_types', 'score_ranges', 'score_tables', 'session_schedules',
  'student_records', 'student_videos', 'students', 'test_group_supervisors', 'test_groups', 'test_participants', 'test_records',
  'test_sessions', 'trainers', 'training_logs', 'video_feedback'];
for (const table of PEAK_TABLES) tables[`peak.${table}`] = ANY;

// 업무 묶음 조회 — need 가 없으면 못 부르고, sections 는 권한이 없으면 그 칸만 비운다.
const peakWorkflows = ['teaching_context', 'recent_records', 'event_ranking', 'student_progress'];
const workflows = {
  'paca.classes_with_students': { need: view('schedules') },
  'paca.attendance_summary': { need: view('schedules') },
  'paca.student_overview': { need: view('students'),
    sections: { attendance: view('schedules'), recent_consultations: view('consultations'), unpaid: view('payments') } },
  'paca.student_search': { need: view('students') },
  'paca.trial_students': { need: view('students') },
  'paca.unpaid_list': { need: view('payments') },
  'paca.payment_status': { need: view('payments') },
  'paca.consultation_schedule': { need: view('consultations') },
  'paca.today_brief': { need: ANY,
    sections: { classes: view('schedules'), attendance: view('schedules'), unpaid: view('payments'), consultations: view('consultations') } },
  ...Object.fromEntries(peakWorkflows.flatMap(name => [[`peak.${name}`, { need: ANY }], [`paca.peak_${name}`, { need: ANY }]])),
};

// 쓰기(미리보기·확인) — 작업 이름 기준
const commands = {
  student_create: edit('students'),
  student_update: edit('students'),
  trial_register: edit('students'),
  trial_schedule_add: edit('students'),
  trial_schedule_update: edit('students'),
  student_reactivate: edit('students'),
  student_withdraw: edit('students', 'payments'),
  student_settle: edit('payments'),
  payment_pay: edit('payments'),
  payment_update: edit('payments'),
  expense_create: edit('expenses'),
  attendance_set: edit('schedules'),
  class_schedule_update: edit('schedules'),
  instructor_schedule_create: edit('schedules'),
  instructor_schedule_update: edit('schedules'),
  academy_event_create: edit('schedules'),
  academy_event_update: edit('schedules'),
  consultation_create: edit('consultations'),
  consultation_update: edit('consultations'),
  consultation_reschedule: edit('consultations'),
  consultation_block_create: edit('consultations'),
  consultation_block_delete: edit('consultations'),
  consultation_record_create: edit('consultations'),
  consultation_record_update: edit('consultations'),
  peak_record_create: ANY,
  peak_record_update: ANY,
  peak_record_delete: ANY,
  peak_training_create: ANY,
  peak_training_update: ANY,
  peak_plan_create: ANY,
  peak_plan_update: ANY,
  peak_plan_exercise_add: ANY,
  peak_plan_exercise_remove: ANY,
  peak_plan_exercise_complete: ANY,
  peak_plan_exercises_update: ANY,
  peak_class_setup_create: ANY,
  peak_instructor_assignment_create: ANY,
  peak_exercise_create: ANY,
  peak_exercise_pack_create: OWNER,
};

// 거절 문구용 이름 — 파카 직원 권한 화면과 같은 이름
const labels = {
  students: '학생 관리', instructors: '강사 관리', schedules: '스케줄', academy_events: '학원일정', seasons: '시즌 관리',
  payments: '학원비', salaries: '급여 관리', expenses: '지출 관리', incomes: '기타수입', reports: '리포트',
  consultations: '상담', sms: '문자 보내기', notifications: '알림톡 설정', settings: '설정', staff: '직원 관리',
  dashboard_finance: '대시보드 매출', dashboard_unpaid: '대시보드 미수금', overtime_approval: '초과근무 승인', class_days: '수업일 관리',
};

module.exports = { OWNER, tables, workflows, commands, labels };
