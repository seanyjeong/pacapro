const axios = require('axios');
const logger = require('../utils/logger');

const TELEGRAM_API_BASE = 'https://api.telegram.org';
const DEFAULT_APPROVAL_URL = 'https://pacapro.vercel.app/admin/users';

function getApprovalAdminUrl() {
    return process.env.PACA_APPROVAL_ADMIN_URL || DEFAULT_APPROVAL_URL;
}

function isTelegramConfigured() {
    return Boolean(process.env.PACA_SIGNUP_TELEGRAM_BOT_TOKEN && process.env.PACA_SIGNUP_TELEGRAM_CHAT_ID);
}

function cleanValue(value, fallback = '-') {
    if (value === null || value === undefined) return fallback;
    const text = String(value).trim();
    return text || fallback;
}

function formatSignupApprovalMessage(request) {
    const lines = [
        '[PACA 가입 승인 요청]',
        `학원: ${cleanValue(request.academyName, '학원명 없음')}`,
        `신청자: ${cleanValue(request.name, '이름 없음')}`,
        `이메일: ${cleanValue(request.email, '이메일 없음')}`,
        `연락처: ${cleanValue(request.phone, '연락처 없음')}`,
        `사용자 ID: ${cleanValue(request.userId)}`,
        '',
        `승인 페이지: ${getApprovalAdminUrl()}`,
    ];

    return lines.join('\n');
}

function getSafeTelegramError(error) {
    return [
        `code=${cleanValue(error && error.code, 'none')}`,
        `status=${cleanValue(error && error.response && error.response.status, 'none')}`,
    ].join(' ');
}

async function notifySignupApprovalRequest(request) {
    if (!isTelegramConfigured()) {
        logger.info('[SignupApproval] Telegram notification skipped: not configured');
        return { sent: false, reason: 'not_configured' };
    }

    const token = process.env.PACA_SIGNUP_TELEGRAM_BOT_TOKEN;
    const chatId = process.env.PACA_SIGNUP_TELEGRAM_CHAT_ID;

    try {
        await axios.post(
            `${TELEGRAM_API_BASE}/bot${token}/sendMessage`,
            {
                chat_id: chatId,
                disable_web_page_preview: true,
                text: formatSignupApprovalMessage(request),
            },
            { timeout: 5000 }
        );
        return { sent: true };
    } catch (error) {
        logger.warn(`[SignupApproval] Telegram notification failed: ${getSafeTelegramError(error)}`);
        return { sent: false, reason: 'send_failed' };
    }
}

module.exports = {
    formatSignupApprovalMessage,
    getApprovalAdminUrl,
    isTelegramConfigured,
    notifySignupApprovalRequest,
};
