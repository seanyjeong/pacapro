const {
  analyzeAttendance,
  analyzeRecordTrend,
  buildConsultationCandidates,
} = require('../../services/consultationCandidateService');

describe('consultationCandidateService', () => {
  test('연속 결석 2회와 사유 미확인 결석을 상담 신호로 계산한다', () => {
    const result = analyzeAttendance([
      { class_date: '2026-05-18', time_slot: 'evening', attendance_status: 'present' },
      { class_date: '2026-05-20', time_slot: 'evening', attendance_status: 'absent', notes: '' },
      { class_date: '2026-05-22', time_slot: 'evening', attendance_status: 'absent', notes: '개인사정' },
      { class_date: '2026-05-24', time_slot: 'afternoon', attendance_status: 'excused', notes: '병원' },
    ]);

    expect(result.max_consecutive_absences).toBe(2);
    expect(result.unexcused_absences).toBe(2);
    expect(result.summary).toMatchObject({ present: 1, absent: 2, excused: 1 });
  });

  test('정당한 결석 사유 키워드는 사유 미확인으로 보지 않는다', () => {
    const result = analyzeAttendance([
      { class_date: '2026-05-20', attendance_status: 'absent', notes: '학교 행사' },
      { class_date: '2026-05-22', attendance_status: 'absent', notes: '병원 진료' },
    ]);

    expect(result.max_consecutive_absences).toBe(2);
    expect(result.unexcused_absences).toBe(0);
  });

  test('높을수록 좋은 종목의 최근 5개 하락 추세를 감지한다', () => {
    const trend = analyzeRecordTrend([
      sample('2026-05-01', 250),
      sample('2026-05-08', 246),
      sample('2026-05-15', 242),
      sample('2026-05-22', 239),
      sample('2026-05-25', 235),
    ]);

    expect(trend.trend).toBe('declining');
    expect(trend.event_name).toBe('제자리멀리뛰기');
  });

  test('낮을수록 좋은 종목도 방향값을 보고 하락 추세를 판단한다', () => {
    const trend = analyzeRecordTrend([
      sample('2026-05-01', 11.2, { direction: 'lower', name: '100m' }),
      sample('2026-05-08', 11.4, { direction: 'lower', name: '100m' }),
      sample('2026-05-15', 11.6, { direction: 'lower', name: '100m' }),
      sample('2026-05-22', 11.7, { direction: 'lower', name: '100m' }),
      sample('2026-05-25', 11.9, { direction: 'lower', name: '100m' }),
    ]);

    expect(trend.trend).toBe('declining');
  });

  test('출석과 기록 신호를 합쳐 재원생 상담 후보만 반환한다', () => {
    const result = buildConsultationCandidates({
      today: '2026-05-27',
      attendanceDays: 14,
      students: [
        { id: 1, name: '김민준', status: 'active' },
        { id: 2, name: '박지안', status: 'withdrawn' },
      ],
      peakStudents: [{ id: 101, paca_student_id: 1, status: 'active' }],
      attendanceRows: [
        { student_id: 1, class_date: '2026-05-20', attendance_status: 'absent', notes: '' },
        { student_id: 1, class_date: '2026-05-22', attendance_status: 'absent', notes: '' },
      ],
      recordRows: [
        ...recordSet(101, 11, '제자리멀리뛰기', [250, 246, 242, 239, 235]),
        ...recordSet(101, 12, '메디신볼', [8.0, 8.0, 8.0, 8.0, 8.0]),
      ],
      limit: 10,
    });

    expect(result.period.attendance_start_date).toBe('2026-05-14');
    expect(result.candidates).toHaveLength(1);
    expect(result.candidates[0].student).toMatchObject({
      paca_student_id: 1,
      peak_student_id: 101,
      name: '김민준',
    });
    expect(result.candidates[0].reasons).toEqual(
      expect.arrayContaining([
        '최근 14일 안에 연속 결석 2회',
        '사유 미확인 결석 2회',
        '최근 5개 기록 기준 하락/정체 종목 2개',
      ]),
    );
  });

  test('제자리멀리뛰기 최근 5개 평균이 성별 기준 이하이면 상담 신호로 잡는다', () => {
    const result = buildConsultationCandidates({
      today: '2026-05-27',
      attendanceDays: 14,
      students: [
        { id: 1, name: '남학생', gender: 'male', status: 'active' },
        { id: 2, name: '여학생', gender: 'female', status: 'active' },
      ],
      peakStudents: [
        { id: 101, paca_student_id: 1, status: 'active' },
        { id: 102, paca_student_id: 2, status: 'active' },
      ],
      attendanceRows: [],
      recordRows: [
        ...recordSet(101, 11, '제자리멀리뛰기', [245, 246, 247, 248, 249]),
        ...recordSet(102, 11, '제자리멀리뛰기', [198, 199, 200, 199, 198]),
      ],
      limit: 10,
    });

    expect(result.candidates).toHaveLength(2);
    expect(result.candidates[0].reasons.join(' ')).toContain('남자 기준 250cm 이하');
    expect(result.candidates[1].signals.absolute_performance.low_standing_long_jump).toMatchObject({
      average: 198.8,
      threshold: 200,
    });
  });

  test('점수가 같으면 문제 기록 개수로 상담 후보 순서를 정한다', () => {
    const result = buildConsultationCandidates({
      today: '2026-05-27',
      attendanceDays: 7,
      students: [
        { id: 1, name: '가학생', status: 'active' },
        { id: 2, name: '하학생', status: 'active' },
      ],
      peakStudents: [
        { id: 101, paca_student_id: 1, status: 'active' },
        { id: 102, paca_student_id: 2, status: 'active' },
      ],
      attendanceRows: [],
      recordRows: [
        ...recordSet(101, 11, '제자리멀리뛰기', [250, 246, 242, 239, 235]),
        ...recordSet(101, 12, '메디신볼', [8.0, 7.8, 7.6, 7.4, 7.2]),
        ...recordSet(102, 21, '제자리멀리뛰기', [250, 246, 242, 239, 235]),
        ...recordSet(102, 22, '메디신볼', [8.0, 7.8, 7.6, 7.4, 7.2]),
        ...recordSet(102, 23, '좌전굴', [20, 20, 20, 20, 20]),
      ],
      limit: 2,
    });

    expect(result.candidates.map((candidate) => candidate.student.name)).toEqual([
      '하학생',
      '가학생',
    ]);
  });
});

function sample(measuredAt, value, overrides = {}) {
  return {
    id: Number(measuredAt.replaceAll('-', '')),
    peak_student_id: overrides.peakStudentId || 101,
    record_type_id: overrides.recordTypeId || 11,
    record_type_name: overrides.name || '제자리멀리뛰기',
    direction: overrides.direction || 'higher',
    unit: overrides.unit || 'cm',
    measured_at: measuredAt,
    value,
  };
}

function recordSet(peakStudentId, recordTypeId, name, values) {
  return values.map((value, index) => sample(`2026-05-${String(1 + index).padStart(2, '0')}`, value, {
    peakStudentId,
    recordTypeId,
    name,
  }));
}
