const db = require('../../config/database');
const { verifyToken, checkPermission } = require('../../middleware/auth');
const {
    encryptApiKey,
    decryptApiKey,
    sendAlimtalk,
    createUnpaidNotificationMessage,
    isValidPhoneNumber
} = require('../../utils/naverSens');
const { decrypt } = require('../../utils/encryption');
const logger = require('../../utils/logger');
const {
    sendAlimtalkSolapi,
    getBalanceSolapi
} = require('../../utils/solapi');

// 학생 정보 복호화 헬퍼
function decryptStudentInfo(obj) {
    if (!obj) return obj;
    if (obj.student_name) obj.student_name = decrypt(obj.student_name);
    if (obj.parent_phone) obj.parent_phone = decrypt(obj.parent_phone);
    if (obj.student_phone) obj.student_phone = decrypt(obj.student_phone);
    if (obj.phone) obj.phone = decrypt(obj.phone);  // 체험수업 등에서 phone 필드 사용
    if (obj.name) obj.name = decrypt(obj.name);
    return obj;
}
function decryptStudentArray(arr) {
    return arr.map(item => decryptStudentInfo({...item}));
}

// 암호화 키 (환경변수에서 가져옴)
const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY;
if (!ENCRYPTION_KEY) {
    logger.warn('[notifications] ENCRYPTION_KEY 환경변수가 설정되지 않았습니다.');
}

module.exports = {
    db,
    verifyToken,
    checkPermission,
    encryptApiKey,
    decryptApiKey,
    sendAlimtalk,
    createUnpaidNotificationMessage,
    isValidPhoneNumber,
    decrypt,
    logger,
    sendAlimtalkSolapi,
    getBalanceSolapi,
    decryptStudentInfo,
    decryptStudentArray,
    ENCRYPTION_KEY
};
