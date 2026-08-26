const {
  findAttendanceContextForUpdate,
  findTrialStudents,
  updateTrialState,
} = require('../../repositories/trialStatusRepository');

describe('trialStatusRepository', () => {
  test('출석 처리 대상 학생을 학원 범위로 잠그고 기존 출석을 조회한다', async () => {
    const student = { id: 14, academy_id: 2, status: 'trial' };
    const connection = {
      query: jest.fn()
        .mockResolvedValueOnce([[student]])
        .mockResolvedValueOnce([[{ attendance_status: 'present' }]]),
    };

    const result = await findAttendanceContextForUpdate(connection, {
      academyId: 2,
      scheduleId: 30,
      studentId: 14,
    });

    expect(result).toEqual({ previousAttendanceStatus: 'present', student });
    const [studentSql, studentParams] = connection.query.mock.calls[0];
    expect(studentSql).toContain('academy_id = ?');
    expect(studentSql).toContain('FOR UPDATE');
    expect(studentParams).toEqual([14, 2]);
    expect(connection.query.mock.calls[1][1]).toEqual([30, 14]);
  });

  test('만료 점검은 삭제되지 않은 체험생만 조회한다', async () => {
    const students = [{ id: 14 }];
    const connection = { query: jest.fn().mockResolvedValue([students]) };

    await expect(findTrialStudents(connection)).resolves.toBe(students);

    const [sql] = connection.query.mock.calls[0];
    expect(sql).toContain("status = 'trial'");
    expect(sql).toContain('is_trial = 1');
    expect(sql).toContain('deleted_at IS NULL');
  });

  test('체험 상태 수정은 학생과 학원 범위를 모두 만족하는 한 행만 허용한다', async () => {
    const connection = { query: jest.fn().mockResolvedValue([{ affectedRows: 1 }]) };

    await updateTrialState(connection, {
      academyId: 2,
      isTrial: false,
      note: '[체험 자동 종료] 확인',
      status: 'pending',
      studentId: 14,
      trialDates: [{ date: '2026-08-24', attended: true }],
      trialRemaining: 0,
    });

    const [sql, params] = connection.query.mock.calls[0];
    expect(sql).toContain('WHERE id = ? AND academy_id = ?');
    expect(params.slice(-2)).toEqual([14, 2]);
  });

  test('체험 상태 수정 대상이 정확히 한 행이 아니면 중단한다', async () => {
    const connection = { query: jest.fn().mockResolvedValue([{ affectedRows: 0 }]) };

    await expect(updateTrialState(connection, {
      academyId: 2,
      isTrial: false,
      status: 'pending',
      studentId: 14,
      trialDates: [],
      trialRemaining: 0,
    })).rejects.toThrow('exactly one student');
  });
});
