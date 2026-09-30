const crypto = require('crypto');
const { commands } = require('../constants/maxEngineCommands');
const { previewSeconds } = require('../config/maxEngineFull');
const repo = require('../repositories/maxEngineFullCommandRepository');
const { fail, digest, seal, unseal, decrypt } = require('./maxEngineFullSecurity');
const students = require('./maxEngineFullStudents');
const consultations = require('./maxEngineFullConsultations');
const attendance = require('./maxEngineFullAttendance');
const payments = require('./maxEngineFullPayments');
const consultationRecords = require('./maxEngineFullConsultationRecords');

function catalog(provider) {
  return Object.entries(commands).map(([operation, c]) => ({ operation, resource: provider === 'peak' ? 'paca_' + c.resource : c.resource,
    source: c.provider, label: c.label, notice: c.notice || null,
    fields: c.schema.describe().keys, requires_id: !operation.endsWith('_create') }));
}
function validate(body) {
  if (!body || typeof body.operation !== 'string' || Object.keys(body).some(k => !['operation', 'resource_id', 'changes'].includes(k))) fail(422, 'INVALID_INPUT', 'operation·resource_id·changes만 보내 주세요.');
  const spec = Object.hasOwn(commands, body.operation) ? commands[body.operation] : null;
  if (!spec) fail(403, 'WRITE_FORBIDDEN', '허용되지 않은 쓰기입니다. 급여·문자 발송은 조회만 가능합니다.');
  const create = body.operation.endsWith('_create');
  if ((create && body.resource_id != null) || (!create && (!Number.isSafeInteger(body.resource_id) || body.resource_id < 1))) fail(422, 'INVALID_INPUT', '대상 id를 확인해 주세요.');
  if (body.operation === 'student_create' && (!body.changes || !body.changes.phone ||
      (body.changes.registration_source === 'max_engine' && String(body.changes.phone).replace(/\D/g, '').length < 9))) {
    fail(422, 'INVALID_INPUT', '학생 전화번호가 없습니다. 엔진에서 전화번호를 입력한 뒤 다시 보내 주세요.');
  }
  const parsed = spec.schema.validate(body.changes, { convert: false });
  if (parsed.error || !parsed.value) fail(422, 'INVALID_INPUT', '작업별 필수 입력·형식·허용 필드를 확인해 주세요.');
  if (JSON.stringify(parsed.value).length > 30000) fail(422, 'INVALID_INPUT', '입력 길이를 줄여 주세요.');
  return { operation: body.operation, resource_id: body.resource_id ?? null, changes: parsed.value };
}
async function state(conn, actor, command, lock = false) {
  if (command.operation.startsWith('consultation_record_')) return consultationRecords.state(conn, actor, command, lock);
  if (command.operation === 'student_create') return repo.roster(conn, actor.academy_id, lock);
  if (command.operation === 'consultation_create') return repo.row(conn, 'students', command.changes.student_id, actor.academy_id, lock);
  if (command.operation === 'attendance_set') return attendance.state(conn, actor, command.resource_id, lock);
  const before = await repo.row(conn, commands[command.operation].resource, command.resource_id, actor.academy_id, lock);
  if (command.operation === 'payment_pay') await repo.row(conn, 'students', before.student_id, actor.academy_id, lock);
  return before;
}
function display(command, before) {
  const old = command.operation === 'attendance_set' ? before.attendance : before.record || before;
  const previous = command.operation.endsWith('_create') ? null : Object.fromEntries(
    Object.keys(command.changes).map(k => [k, decrypt(old[k] ?? null)]));
  if (command.operation === 'student_create') students.validateCreate(command.changes, before);
  if (command.operation === 'consultation_create') consultations.validate(before);
  return { before: previous, after: command.operation === 'payment_pay' ? payments.result(command.changes, before) : command.changes,
    notice: commands[command.operation].notice || null };
}
async function preview(actor, provider, body) {
  const command = validate(body);
  const before = await repo.transaction(conn => state(conn, actor, command));
  const view = display(command, before);
  const expiresAt = Math.min(actor.expires_at, Math.floor(Date.now() / 1000) + previewSeconds);
  const idempotencyKey = crypto.randomUUID();
  const payload = { actor, provider, command, before_hash: digest(before), expires_at: expiresAt, idempotency_key: idempotencyKey };
  return { academy_id: actor.academy_id, operation: command.operation, resource_id: command.resource_id,
    ...view, preview_token: seal(payload), idempotency_key: idempotencyKey, expires_at: expiresAt, requires_confirmation: true };
}
async function apply(conn, actor, command, before) {
  const { operation, resource_id: id, changes } = command;
  switch (operation) {
    case 'student_create': return students.create(conn, actor, changes, before);
    case 'student_update': return students.update(conn, id, changes);
    case 'consultation_create': return consultations.create(conn, actor, changes, before);
    case 'consultation_update': return consultations.update(conn, actor, id, changes);
    case 'consultation_record_create': return consultationRecords.create(conn, actor, changes);
    case 'consultation_record_update': return consultationRecords.update(conn, id, changes);
    case 'attendance_set': return attendance.apply(conn, actor, id, changes, before);
    case 'payment_pay': return payments.apply(conn, actor, id, changes, before);
    default: fail(403, 'WRITE_FORBIDDEN', '허용된 작업이 아닙니다.');
  }
}
async function confirm(actor, provider, body) {
  if (!body || Object.keys(body).some(k => !['preview_token', 'idempotency_key', 'confirm'].includes(k)) ||
      body.confirm !== true || typeof body.idempotency_key !== 'string') fail(422, 'CONFIRM_REQUIRED', '미리보기를 검토한 뒤 confirm=true로 확인해 주세요.');
  const payload = unseal(body.preview_token);
  if (payload.actor.user_id !== actor.user_id || payload.actor.academy_id !== actor.academy_id ||
      payload.provider !== provider || payload.idempotency_key !== body.idempotency_key) fail(409, 'PREVIEW_MISMATCH', '미리보기의 계정·대상·확인 키가 다릅니다.');
  const command = validate(payload.command);
  const requestHash = digest(payload), idempotencyHash = digest(body.idempotency_key);
  return repo.transaction(async conn => {
    await repo.lockAcademy(conn, actor.academy_id);
    const previous = await repo.previous(conn, actor, idempotencyHash);
    if (previous) {
      if (previous.request_hash !== requestHash) fail(409, 'IDEMPOTENCY_CONFLICT', '확인 키가 다른 작업에 사용되었습니다.');
      return typeof previous.result_json === 'string' ? JSON.parse(previous.result_json) : previous.result_json;
    }
    if (payload.expires_at <= Math.floor(Date.now() / 1000)) fail(409, 'PREVIEW_EXPIRED', '미리보기가 만료되었습니다. 다시 확인해 주세요.');
    const before = await state(conn, actor, command, true);
    if (digest(before) !== payload.before_hash) fail(409, 'SOURCE_CHANGED', '변경 전 값이 달라졌습니다. 새 미리보기를 확인해 주세요.');
    display(command, before);
    const id = await apply(conn, actor, command, before);
    const result = { academy_id: actor.academy_id, operation: command.operation, resource_id: id, applied: true };
    await repo.completed(conn, actor, idempotencyHash, requestHash, command.operation, result);
    return result;
  });
}
module.exports = { catalog, preview, confirm, validate };
