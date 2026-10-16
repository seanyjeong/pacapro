const repo = require('../repositories/ilsanAdmissionRepository');
const enrollmentRepo = require('../repositories/ilsanEnrollmentRepository');
const enrollment = require('./ilsanEnrollmentService');
const codec = require('./ilsanAdmissionCodec');
const model = require('../models/ilsanAdmission');
const { ACADEMY_ID, ACADEMY_NAME } = require('../constants/ilsanAdmission');
const { getKoreaDateText } = require('../utils/proratedPaymentDueDate');

function createAdmissionService(pool, today = getKoreaDateText) {
  async function scope(conn, lock = false) {
    const academy = await repo.academy(conn, lock);
    if (academy?.name !== ACADEMY_NAME) model.fail(503, 'ACADEMY_UNAVAILABLE', '일산 교육원 접수를 잠시 사용할 수 없습니다.');
    return academy;
  }
  function actor(user) {
    if (Number(user.academyId ?? user.academy_id) !== ACADEMY_ID || !Number.isSafeInteger(user.id) || user.id <= 0) {
      model.fail(403, 'ACADEMY_FORBIDDEN', '일산 교육원 담당자만 사용할 수 있습니다.');
    }
  }
  async function row(conn, id, lock = false) {
    const result = await repo.get(conn, id, lock);
    if (!result) model.fail(404, 'NOT_FOUND', '입학원서를 찾을 수 없습니다.');
    return result;
  }
  async function preview(conn, record, input) {
    if (!['submitted','scheduled','review'].includes(record.status)) model.fail(409, 'CLOSED_APPLICATION', '이미 처리된 원서입니다.');
    const terms = model.terms(input, today()), quote = model.quote(terms), profile = codec.view(record).profile;
    const duplicates = enrollment.duplicates(profile, await enrollmentRepo.roster(conn));
    return { terms, quote, duplicate_student_ids: duplicates,
      preview_hash: model.fingerprint({ id: record.id, revision: record.revision, terms, quote, duplicates }) };
  }
  return {
    async availability() {
      return repo.transaction(pool, async conn => {
        await scope(conn); await repo.ready(conn);
        codec.seal('admission-readiness');
        return { available:true, academy_name:ACADEMY_NAME };
      });
    },
    async submit(input, submissionKey) {
      if (!/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(submissionKey || '')) {
        model.fail(422, 'INVALID_REQUEST', '페이지를 새로 열고 다시 제출해 주세요.');
      }
      // A lost response may be retried after midnight. Existing receipts remain idempotent.
      const profile = model.application(input, model.dateText(input?.enrollment_date));
      const hash = model.fingerprint(profile), sealed = codec.seal(JSON.stringify(profile));
      return repo.transaction(pool, async conn => {
        await scope(conn, true);
        const existing = await repo.bySubmission(conn, submissionKey);
        if (existing && existing.payload_hash !== hash) model.fail(409, 'REQUEST_CHANGED', '이미 제출한 원서와 내용이 다릅니다. 새 원서로 접수해 주세요.');
        if (!existing) {
          if (profile.enrollment_date < today()) model.fail(422, 'PAST_DATE', '등록 희망일은 오늘 이후로 선택해 주세요.');
          await repo.insert(conn, submissionKey, hash, sealed);
        }
        return { received: true, receipt: submissionKey, message: '일산 교육원에 접수되었습니다. 담당자 확인 후 등록일을 확정합니다.' };
      });
    },
    async list(user, before) {
      actor(user);
      return repo.transaction(pool, async conn => {
        await scope(conn); const rows = await repo.list(conn, before);
        return { applications: rows.map(codec.view), next_cursor: rows.length === 50 ? rows.at(-1).id : null };
      });
    },
    async preview(user, id, input) {
      actor(user);
      return repo.transaction(pool, async conn => { await scope(conn); return preview(conn, await row(conn, id), input); });
    },
    async confirm(user, id, input) {
      actor(user);
      return repo.transaction(pool, async conn => {
        await scope(conn, true); const record = await row(conn, id, true);
        const plan = await preview(conn, record, input);
        if (typeof input.preview_hash !== 'string' || input.preview_hash !== plan.preview_hash) {
          model.fail(409, 'SOURCE_CHANGED', '원서 또는 등록 조건이 변경됐습니다. 금액을 다시 확인해 주세요.');
        }
        if (plan.duplicate_student_ids.length) model.fail(409, 'DUPLICATE_STUDENT', '같은 이름과 전화번호의 학생이 이미 있습니다. 기존 학생을 확인해 주세요.');
        await repo.approve(conn, id, user.id, plan.terms, plan.quote);
        await enrollment.activate(conn, await row(conn, id, true), today());
        return codec.view(await row(conn, id));
      });
    },
    async cancel(user, id, revision) {
      actor(user);
      return repo.transaction(pool, async conn => {
        await scope(conn, true); const record = await row(conn, id, true);
        if (record.status === 'enrolled' || record.revision !== revision) model.fail(409, 'SOURCE_CHANGED', '등록되었거나 원서 상태가 바뀌었습니다. 다시 확인해 주세요.');
        await repo.cancel(conn, id); return codec.view(await row(conn, id));
      });
    },
    async activateDue() {
      const due = await repo.transaction(pool, async conn => { await scope(conn); return repo.due(conn, today()); });
      const result = { enrolled: 0, review: 0 };
      for (const item of due) {
        let revision;
        try {
          const applied = await repo.transaction(pool, async conn => {
            await scope(conn, true);
            const record = await row(conn, item.id, true); revision = record.revision;
            return enrollment.activate(conn, record, today());
          });
          if (applied) result.enrolled++;
        } catch (error) {
          if (!(error instanceof model.AdmissionError)) throw error;
          if (revision === undefined) throw error;
          result.review += await repo.transaction(pool, conn => repo.review(conn, item.id, revision, error.code));
        }
      }
      return result;
    },
  };
}
module.exports = { createAdmissionService };
