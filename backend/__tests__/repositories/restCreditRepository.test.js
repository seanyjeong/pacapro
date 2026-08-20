const {
  findCurrentRestCreditsForUpdate,
  updateRecalculatedCredit,
} = require('../../repositories/restCreditRepository');

describe('restCreditRepository', () => {
  test('현재 학원·학생·휴식 회차의 자동 크레딧만 잠금 조회한다', async () => {
    const credits = [{ id: 12 }];
    const connection = { execute: jest.fn().mockResolvedValue([credits, []]) };

    const result = await findCurrentRestCreditsForUpdate(connection, {
      academyId: 2,
      restStartDate: '2026-08-12',
      studentId: 14,
    });

    expect(result).toBe(credits);
    const [sql, params] = connection.execute.mock.calls[0];
    expect(sql).toContain("credit_type IN ('carryover', 'refund')");
    expect(sql).toContain("COALESCE(status, 'pending') <> 'cancelled'");
    expect(sql).toContain('FOR UPDATE');
    expect(params).toEqual([14, 2, '2026-08-12']);
  });

  test('재계산 결과는 크레딧·학생·학원 조건을 모두 만족하는 한 행만 수정한다', async () => {
    const connection = {
      execute: jest.fn().mockResolvedValue([{ affectedRows: 1 }, []]),
    };

    await updateRecalculatedCredit(connection, {
      academyId: 2,
      creditAmount: 103000,
      creditId: 12,
      note: '[복귀 재계산] 확인',
      remainingAmount: 103000,
      restDays: 8,
      restEndDate: '2026-08-19',
      status: 'pending',
      studentId: 14,
    });

    const [sql, params] = connection.execute.mock.calls[0];
    expect(sql).toContain('WHERE id = ? AND student_id = ? AND academy_id = ?');
    expect(params).toEqual([
      '2026-08-19', 8, 103000, 103000, 'pending',
      '[복귀 재계산] 확인', 12, 14, 2,
    ]);
  });

  test('수정 대상이 정확히 한 행이 아니면 오류로 중단한다', async () => {
    const connection = {
      execute: jest.fn().mockResolvedValue([{ affectedRows: 0 }, []]),
    };

    await expect(updateRecalculatedCredit(connection, {
      academyId: 2,
      creditAmount: 103000,
      creditId: 12,
      note: '[복귀 재계산] 확인',
      remainingAmount: 103000,
      restDays: 8,
      restEndDate: '2026-08-19',
      status: 'pending',
      studentId: 14,
    })).rejects.toThrow('exactly one row');
  });
});
