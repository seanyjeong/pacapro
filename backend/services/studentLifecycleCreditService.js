const repository = require('../repositories/studentLifecycleCreditRepository');
const { validateContext } = require('../models/studentLifecycleBilling');
const { fail } = require('../models/maxEngineError');

async function persist(conn, input, credit) {
  const context = validateContext(input);
  if (!credit) return null;
  if (credit.existing) {
    const existing = await repository.existing(conn, context, credit.id);
    if (!existing || existing.status === 'cancelled') fail(409, 'SOURCE_CHANGED', '기존 휴원 크레딧이 변경되었습니다.');
    return existing;
  }
  if (!['carryover', 'refund'].includes(credit.credit_type) || !Number.isSafeInteger(credit.credit_amount) ||
      credit.credit_amount <= 0 || credit.remaining_amount !== credit.credit_amount || credit.rest_start_date !== context.date) {
    fail(409, 'SOURCE_CHANGED', '휴원 크레딧 계산 결과를 다시 확인해 주세요.');
  }
  const existing = await repository.insert(conn, context, credit);
  if (!existing) fail(409, 'SOURCE_CHANGED', '저장된 휴원 크레딧을 확인할 수 없습니다.');
  return existing;
}

module.exports = { persist };
