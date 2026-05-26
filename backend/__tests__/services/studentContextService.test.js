const { buildStudentContext, classSchedule } = require('../../services/studentContextService');

describe('studentContextService', () => {
  test('class_days 숫자와 요일별 시간대를 안전하게 라벨링한다', () => {
    expect(classSchedule(JSON.stringify([{ day: 0, timeSlot: 'afternoon' }, { day: 3, timeSlot: 'evening' }]))).toEqual([
      { day: 0, weekday: '일', time_slot: 'afternoon', time_slot_label: '오후반' },
      { day: 3, weekday: '수', time_slot: 'evening', time_slot_label: '저녁반' },
    ]);
    expect(classSchedule('[1,5]', 'evening').map((slot) => slot.weekday)).toEqual(['월', '금']);
  });

  test('학생 컨텍스트 메시지에 수업 요일과 최근 출석 요일을 포함한다', () => {
    const context = buildStudentContext({
      student: {
        id: 7,
        name: '이서하',
        school: '행신고',
        grade: '고3',
        gender: 'female',
        status: 'active',
        class_days: JSON.stringify([{ day: 0, timeSlot: 'afternoon' }, { day: 3, timeSlot: 'evening' }]),
        time_slot: 'evening',
      },
      attendanceRows: [
        { class_date: '2026-05-24', time_slot: 'afternoon', attendance_status: 'present' },
      ],
      today: '2026-05-27',
      periodDays: 14,
    });

    expect(context.student.name).toBe('이서하');
    expect(context.message).toContain('일 오후반');
    expect(context.message).toContain('수 저녁반');
    expect(context.message).toContain('최근 출석 기록 요일: 일 오후반');
  });
});
