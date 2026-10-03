const fields = {
  student: ['id', 'name', 'grade', 'school', 'gender', 'status'],
  enrollment: ['class_days', 'weekly_count', 'time_slot', 'enrollment_date'],
  schedule: ['id', 'class_id', 'class_date', 'time_slot', 'instructor_id', 'title', 'is_closed'],
  attendance: ['id', 'class_schedule_id', 'student_id', 'attendance_status'],
  payment: ['id', 'student_id', 'year_month', 'payment_type', 'final_amount', 'paid_amount', 'due_date', 'payment_status'],
  consultation: ['id', 'linked_student_id', 'preferred_date', 'preferred_time', 'status', 'student_name', 'student_grade', 'student_school', 'consultation_type'],
  record: ['id', 'student_id', 'record_type_id', 'measured_at', 'value'],
  event: ['id', 'name', 'unit', 'direction'],
};
const workflows = {
  paca: {
    classes_with_students: ['date', 'time_slot', 'start_time', 'end_time'],
    attendance_summary: ['date', 'start_date', 'end_date', 'status'],
    student_overview: ['student_id', 'name'],
    student_search: ['name', 'phone_last4', 'grade', 'school'],
    unpaid_list: ['month'], payment_status: ['month'],
    consultation_schedule: ['date', 'start_date', 'end_date', 'status'],
    trial_students: ['status'], today_brief: [],
  },
  peak: {
    recent_records: ['student_id', 'name', 'date', 'start_date', 'end_date'],
    event_ranking: ['event', 'gender', 'date', 'start_date', 'end_date'],
    student_progress: ['student_id', 'name', 'event', 'date', 'start_date', 'end_date'],
  },
};
const workflowAliases = { paca: Object.fromEntries(Object.keys(workflows.peak).map(name =>
  ['peak_' + name, { provider: 'peak', workflow: name }])) };
module.exports = { fields, workflows, workflowAliases };
