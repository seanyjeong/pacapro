const config = require('../config/maxEngineSync');
const repository = require('../repositories/maxEngineSmsRepository');
const { fail } = require('../models/maxEngineError');
const { authenticate } = require('../models/maxEngineSyncPage');
const { decryptApiKey } = require('../utils/naverSens');
const { sendSMSSolapi } = require('../utils/solapi');
const logger = require('../utils/logger');

// Same shared key, internal-only call and academy allowlist as the student sync read.
function allow(academyId, header, socketAddress, headers) {
  const key = config.signingKey(), academies = config.academyIds();
  if (!key || !academies) fail(503, 'SYNC_DISABLED', '동기화 공유 키와 교육원 허용 목록 설정이 필요합니다.');
  authenticate(key, header, socketAddress, headers);
  if (!Number.isSafeInteger(academyId) || academyId < 1) {
    fail(422, 'SMS_INVALID_REQUEST', '양의 정수 academy_id가 필요합니다.');
  }
  if (!academies.has(academyId)) fail(403, 'SYNC_ACADEMY_FORBIDDEN', '맥스엔진 연동을 허용한 교육원이 아닙니다.');
}
async function solapi(academyId) {
  const { setting, defaultSender } = await repository.solapiSettings(academyId);
  const secret = setting?.service_type === 'solapi' && setting.solapi_api_key
    ? decryptApiKey(setting.solapi_api_secret, process.env.ENCRYPTION_KEY) : null;
  return { apiKey: secret ? setting.solapi_api_key : null, secret, from: defaultSender || setting?.solapi_sender_phone || null };
}
async function status(input, header, socketAddress, headers) {
  const academyId = typeof input.academy_id === 'string' && /^[1-9]\d*$/.test(input.academy_id) ? Number(input.academy_id) : NaN;
  allow(academyId, header, socketAddress, headers);
  if (Object.keys(input).some(k => k !== 'academy_id')) fail(422, 'SMS_INVALID_REQUEST', 'academy_id만 지정해 주세요.');
  const settings = await solapi(academyId);
  return { solapi: Boolean(settings.secret), sender_number: Boolean(settings.from) };
}
// Text and recipient never reach logs: only academy, purpose, message type and result.
async function send(body, header, socketAddress, headers) {
  const input = body && typeof body === 'object' && !Array.isArray(body) ? body : {};
  allow(input.academy_id, header, socketAddress, headers);
  if (Object.keys(input).some(k => !['academy_id', 'to', 'text', 'purpose'].includes(k)) ||
      typeof input.to !== 'string' || !/^01\d{8,9}$/.test(input.to) ||
      typeof input.text !== 'string' || !input.text.trim() || Buffer.byteLength(input.text) > 2000 ||
      typeof input.purpose !== 'string' || !/^[a-z_]{1,32}$/.test(input.purpose)) {
    fail(422, 'SMS_INVALID_REQUEST', 'academy_id, 숫자만 받는 번호 to, 2000바이트 이하 text, purpose만 보내 주세요.');
  }
  const settings = await solapi(input.academy_id);
  if (!settings.secret || !settings.from) {
    fail(409, 'SMS_NOT_CONFIGURED', '이 교육원은 솔라피 키 또는 발신번호가 설정되지 않았습니다.');
  }
  const result = await sendSMSSolapi({ solapi_api_key: settings.apiKey, solapi_api_secret: settings.secret,
    solapi_sender_phone: settings.from }, [{ phone: input.to }], input.text);
  const where = `[max-engine-sms] academy=${input.academy_id} purpose=${input.purpose}`;
  if (!result.success || result.failedCount) {
    logger.warn(`${where} result=failed status=${result.statusCode || 200}`);
    fail(502, 'SMS_SEND_FAILED', '솔라피가 문자를 받지 않았습니다.');
  }
  logger.info(`${where} type=${result.messageType} result=sent`);
  return { message_id: result.messageId || result.groupId || null };
}
module.exports = { status, send };
