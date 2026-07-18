jest.mock('../../../../routes/notifications/_utils', () => ({
    pool: {},
    decryptApiKey: jest.fn(),
    isValidPhoneNumber: jest.fn(),
    ENCRYPTION_KEY: 'test-key',
    logger: { error: jest.fn() },
}));

const {
    getSendFailureMessage,
    getSendFailureReason,
} = require('../../../../routes/notifications/test/_utils');

describe('알림톡 테스트 발송 실패 사유', () => {
    test('접속 허용 오류는 서버 주소를 숨기고 해결 방법을 안내한다', () => {
        const reason = getSendFailureReason({
            success: false,
            error: '허용되지 않은 IP(192.0.2.1)로 접근하고 있습니다.',
        });

        expect(reason).toBe(
            '발송 서비스의 보안 설정에서 현재 서버가 허용되지 않았습니다. 알림톡 연동 서비스의 접속 허용 설정을 확인해주세요.'
        );
        expect(reason).not.toContain('192.0.2.1');
    });

    test('상위 상태가 fail이어도 상세 사유를 찾아 안내한다', () => {
        const message = getSendFailureMessage({
            success: false,
            error: 'fail',
            details: { errorMessage: '승인된 템플릿과 발송 내용이 일치하지 않습니다.' },
        });

        expect(message).toBe(
            '테스트 발송에 실패했습니다. 사유: 승인된 템플릿과 발송 내용이 일치하지 않습니다.'
        );
        expect(message.toLowerCase()).not.toContain('fail');
    });

    test('상세 사유가 없으면 기술 코드 대신 확인 방법을 안내한다', () => {
        const message = getSendFailureMessage({ success: false, error: 'SEND_FAIL_500' });

        expect(message).toBe(
            '테스트 발송에 실패했습니다. 사유: 발송 서비스에서 요청을 처리하지 못했습니다. 알림톡 연동 설정을 확인한 뒤 다시 시도해주세요.'
        );
        expect(message).not.toContain('SEND_FAIL_500');
    });

    test('한국어 사유에 섞인 상태 숫자도 사용자에게 노출하지 않는다', () => {
        const message = getSendFailureMessage({ success: false, error: '인증 실패 (401)' });

        expect(message).toContain('발송 서비스 인증 정보가 올바르지 않습니다');
        expect(message).not.toContain('401');
    });
});
