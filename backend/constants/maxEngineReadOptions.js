// Display-only expansions. Never inherit all columns from the related table.
const displays = {
  students: ['id', 'name', 'grade', 'school'],
  classes: ['id', 'class_name'],
  class_schedules: ['id', 'class_date', 'time_slot', 'title'],
  instructors: ['id', 'name'],
  record_types: ['id', 'name', 'unit', 'direction'],
  trainers: ['id', 'name'],
};
const relations = {
  paca: { student: ['student_id', 'students'], linked_student: ['linked_student_id', 'students'],
    class: ['class_id', 'classes'], schedule: ['class_schedule_id', 'class_schedules'],
    instructor: ['instructor_id', 'instructors'] },
  peak: { student: ['student_id', 'students'], event: ['record_type_id', 'record_types'],
    trainer: ['trainer_id', 'trainers'] },
};
module.exports = { displays, relations, maxIds: 200, scanLimit: 10000, detailLimit: 200 };
