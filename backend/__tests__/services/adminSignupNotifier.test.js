jest.mock('../../utils/logger', () => ({
    info: jest.fn(),
    warn: jest.fn(),
}));
jest.mock('axios', () => ({
    post: jest.fn(),
}));

const ORIGINAL_ENV = { ...process.env };

function loadNotifier(env = {}) {
    jest.resetModules();
    process.env = { ...ORIGINAL_ENV, ...env };
    return {
        axios: require('axios'),
        logger: require('../../utils/logger'),
        notifier: require('../../services/adminSignupNotifier'),
    };
}

afterEach(() => {
    process.env = { ...ORIGINAL_ENV };
    jest.clearAllMocks();
});

test('notifier skips Telegram when env is not configured', async () => {
    const { axios, logger, notifier } = loadNotifier({
        PACA_SIGNUP_TELEGRAM_BOT_TOKEN: '',
        PACA_SIGNUP_TELEGRAM_CHAT_ID: '',
    });

    const result = await notifier.notifySignupApprovalRequest({ email: 'owner@example.com' });

    expect(result).toEqual({ sent: false, reason: 'not_configured' });
    expect(axios.post).not.toHaveBeenCalled();
    expect(logger.info).toHaveBeenCalledWith('[SignupApproval] Telegram notification skipped: not configured');
});

test('message includes approval URL and excludes password-like values', () => {
    const { notifier } = loadNotifier({
        PACA_APPROVAL_ADMIN_URL: 'https://paca-approval.etlab.kr',
    });

    const message = notifier.formatSignupApprovalMessage({
        academyName: 'PACA 일산',
        email: 'owner@example.com',
        name: '김원장',
        password: 'secret-password',
        phone: '010-1111-2222',
        userId: 77,
    });

    expect(message).toContain('PACA 일산');
    expect(message).toContain('owner@example.com');
    expect(message).toContain('https://paca-approval.etlab.kr');
    expect(message).not.toContain('secret-password');
    expect(message).not.toMatch(/token|password|비밀번호/i);
});

test('send failure is sanitized and does not throw', async () => {
    const { axios, logger, notifier } = loadNotifier({
        PACA_SIGNUP_TELEGRAM_BOT_TOKEN: 'test-token',
        PACA_SIGNUP_TELEGRAM_CHAT_ID: '1234',
    });
    axios.post.mockRejectedValueOnce({
        code: 'ECONNRESET',
        message: 'network down',
        response: { status: 502 },
    });

    const result = await notifier.notifySignupApprovalRequest({ email: 'owner@example.com' });

    expect(result).toEqual({ sent: false, reason: 'send_failed' });
    expect(logger.warn).toHaveBeenCalledWith(expect.stringContaining('status=502'));
    expect(logger.warn).not.toHaveBeenCalledWith(expect.stringContaining('test-token'));
});
