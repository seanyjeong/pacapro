jest.mock('../../repositories/restCreditRepository', () => ({
  findCurrentRestCreditsForUpdate: jest.fn(),
  updateRecalculatedCredit: jest.fn(),
}));

const repository = require('../../repositories/restCreditRepository');
const {
  RestCreditRecalculationConflictError,
  RestCreditRecalculationValidationError,
  recalculateRestCreditsOnResume,
} = require('../../services/restCreditRecalculationService');

const connection = { execute: jest.fn() };

function makeStudent(overrides = {}) {
  return {
    id: 14,
    academy_id: 2,
    rest_start_date: '2026-08-12',
    rest_end_date: null,
    monthly_tuition: 400000,
    ...overrides,
  };
}

function makeCredit(overrides = {}) {
  return {
    id: 12,
    rest_start_date: '2026-08-12',
    rest_end_date: '2026-08-31',
    rest_days: 20,
    credit_amount: 258000,
    remaining_amount: 258000,
    credit_type: 'carryover',
    status: 'pending',
    ...overrides,
  };
}

describe('recalculateRestCreditsOnResume', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    repository.findCurrentRestCreditsForUpdate.mockResolvedValue([makeCredit()]);
    repository.updateRecalculatedCredit.mockResolvedValue();
  });

  test('무기한 휴원 조기 복귀는 복귀 전날까지 실제 일수와 금액으로 줄인다', async () => {
    const result = await recalculateRestCreditsOnResume({
      connection,
      student: makeStudent(),
      resumeDate: '2026-08-20',
    });

    expect(repository.findCurrentRestCreditsForUpdate).toHaveBeenCalledWith(connection, {
      academyId: 2,
      restStartDate: '2026-08-12',
      studentId: 14,
    });
    expect(repository.updateRecalculatedCredit).toHaveBeenCalledWith(connection, {
      academyId: 2,
      creditId: 12,
      creditAmount: 103000,
      note: expect.stringContaining('258,000원 → 103,000원'),
      remainingAmount: 103000,
      restDays: 8,
      restEndDate: '2026-08-19',
      status: 'pending',
      studentId: 14,
    });
    expect(result).toEqual({
      adjusted: true,
      creditId: 12,
      creditType: 'carryover',
      previousAmount: 258000,
      creditAmount: 103000,
      remainingAmount: 103000,
      usedAmount: 0,
      restStartDate: '2026-08-12',
      restEndDate: '2026-08-19',
      restDays: 8,
      status: 'pending',
    });
  });

  test('같은 날 복귀해 실제 휴식일이 0일이면 미사용 크레딧을 취소한다', async () => {
    const result = await recalculateRestCreditsOnResume({
      connection,
      student: makeStudent(),
      resumeDate: '2026-08-12',
    });

    expect(repository.updateRecalculatedCredit).toHaveBeenCalledWith(
      connection,
      expect.objectContaining({
        creditAmount: 0,
        remainingAmount: 0,
        restDays: 0,
        restEndDate: '2026-08-12',
        status: 'cancelled',
      }),
    );
    expect(result.status).toBe('cancelled');
  });

  test('다음 달에 복귀해도 시작월 말일까지로만 계산한다', async () => {
    repository.findCurrentRestCreditsForUpdate.mockResolvedValue([
      makeCredit({
        rest_start_date: '2026-08-25',
        rest_days: 7,
        credit_amount: 90000,
        remaining_amount: 90000,
      }),
    ]);

    const result = await recalculateRestCreditsOnResume({
      connection,
      student: makeStudent({ rest_start_date: '2026-08-25' }),
      resumeDate: '2026-09-10',
    });

    expect(result).toMatchObject({
      adjusted: false,
      creditAmount: 90000,
      restDays: 7,
      restEndDate: '2026-08-31',
    });
    expect(repository.updateRecalculatedCredit).not.toHaveBeenCalled();
  });

  test('명시한 휴식 종료일 뒤에 복귀해도 원래 종료일보다 크레딧을 늘리지 않는다', async () => {
    repository.findCurrentRestCreditsForUpdate.mockResolvedValue([
      makeCredit({ rest_end_date: '2026-08-15', rest_days: 4, credit_amount: 51000, remaining_amount: 51000 }),
    ]);

    const result = await recalculateRestCreditsOnResume({
      connection,
      student: makeStudent({ rest_end_date: '2026-08-15' }),
      resumeDate: '2026-08-20',
    });

    expect(result).toMatchObject({ adjusted: false, creditAmount: 51000, restEndDate: '2026-08-15', restDays: 4 });
    expect(repository.updateRecalculatedCredit).not.toHaveBeenCalled();
  });

  test('일부 사용액은 보존하고 새 금액에서 사용액을 뺀 잔액으로 조정한다', async () => {
    repository.findCurrentRestCreditsForUpdate.mockResolvedValue([
      makeCredit({ remaining_amount: 208000, status: 'partial' }),
    ]);

    const result = await recalculateRestCreditsOnResume({
      connection,
      student: makeStudent(),
      resumeDate: '2026-08-20',
    });

    expect(repository.updateRecalculatedCredit).toHaveBeenCalledWith(
      connection,
      expect.objectContaining({ creditAmount: 103000, remainingAmount: 53000, status: 'partial' }),
    );
    expect(result).toMatchObject({ usedAmount: 50000, remainingAmount: 53000, status: 'partial' });
  });

  test('이미 사용한 금액이 새 크레딧보다 크면 자동 변경을 중단한다', async () => {
    repository.findCurrentRestCreditsForUpdate.mockResolvedValue([
      makeCredit({ remaining_amount: 100000, status: 'partial' }),
    ]);

    await expect(recalculateRestCreditsOnResume({
      connection,
      student: makeStudent(),
      resumeDate: '2026-08-20',
    })).rejects.toThrow(RestCreditRecalculationConflictError);
    expect(repository.updateRecalculatedCredit).not.toHaveBeenCalled();
  });

  test('휴원 뒤 수강료가 달라져 기존 크레딧 기준과 맞지 않으면 자동 변경을 중단한다', async () => {
    await expect(recalculateRestCreditsOnResume({
      connection,
      student: makeStudent({ monthly_tuition: 500000 }),
      resumeDate: '2026-08-20',
    })).rejects.toThrow(RestCreditRecalculationConflictError);
    expect(repository.updateRecalculatedCredit).not.toHaveBeenCalled();
  });

  test('같은 휴식 회차의 자동 크레딧이 여러 건이면 중복 조정을 막는다', async () => {
    repository.findCurrentRestCreditsForUpdate.mockResolvedValue([makeCredit(), makeCredit({ id: 13 })]);

    await expect(recalculateRestCreditsOnResume({
      connection,
      student: makeStudent(),
      resumeDate: '2026-08-20',
    })).rejects.toThrow(RestCreditRecalculationConflictError);
    expect(repository.updateRecalculatedCredit).not.toHaveBeenCalled();
  });

  test('복귀일이 휴식 시작일보다 빠르면 검증 오류로 중단한다', async () => {
    await expect(recalculateRestCreditsOnResume({
      connection,
      student: makeStudent(),
      resumeDate: '2026-08-11',
    })).rejects.toThrow(RestCreditRecalculationValidationError);
    expect(repository.updateRecalculatedCredit).not.toHaveBeenCalled();
  });

  test('현재 휴식 회차의 자동 크레딧이 없으면 변경 없이 통과한다', async () => {
    repository.findCurrentRestCreditsForUpdate.mockResolvedValue([]);

    const result = await recalculateRestCreditsOnResume({
      connection,
      student: makeStudent(),
      resumeDate: '2026-08-20',
    });

    expect(result).toBeNull();
    expect(repository.updateRecalculatedCredit).not.toHaveBeenCalled();
  });
});
