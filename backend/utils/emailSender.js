/**
 * Email Sender Utility
 * Gmail SMTP를 사용한 이메일 발송
 */

const nodemailer = require('nodemailer');

// Gmail SMTP 설정
const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: process.env.GMAIL_USER || 'sean8320@gmail.com',
        pass: process.env.GMAIL_APP_PASSWORD || 'pbuj osdu hgwk odwb'
    }
});

/**
 * 비밀번호 리셋 이메일 발송
 * @param {string} to - 수신자 이메일
 * @param {string} name - 수신자 이름
 * @param {string} resetToken - 리셋 토큰
 * @param {string} resetUrl - 리셋 페이지 URL
 */
async function sendPasswordResetEmail(to, name, resetToken, resetUrl) {
    const fullResetUrl = `${resetUrl}?token=${resetToken}`;

    const mailOptions = {
        from: '"P-ACA 학원관리시스템" <sean8320@gmail.com>',
        to: to,
        subject: '[P-ACA] 비밀번호 재설정 안내',
        html: `
            <div style="max-width: 600px; margin: 0 auto; font-family: 'Noto Sans KR', sans-serif;">
                <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; text-align: center;">
                    <h1 style="color: white; margin: 0; font-size: 24px;">P-ACA</h1>
                    <p style="color: rgba(255,255,255,0.9); margin: 10px 0 0 0;">체육입시 학원관리시스템</p>
                </div>

                <div style="padding: 40px 30px; background: #ffffff;">
                    <h2 style="color: #333; margin-bottom: 20px;">비밀번호 재설정</h2>

                    <p style="color: #666; line-height: 1.6;">
                        안녕하세요, <strong>${name}</strong>님!<br><br>
                        비밀번호 재설정 요청이 접수되었습니다.<br>
                        아래 버튼을 클릭하여 새 비밀번호를 설정해주세요.
                    </p>

                    <div style="text-align: center; margin: 40px 0;">
                        <a href="${fullResetUrl}"
                           style="display: inline-block;
                                  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                                  color: white;
                                  padding: 15px 40px;
                                  text-decoration: none;
                                  border-radius: 8px;
                                  font-weight: bold;
                                  font-size: 16px;">
                            비밀번호 재설정하기
                        </a>
                    </div>

                    <div style="background: #f8f9fa; padding: 20px; border-radius: 8px; margin-top: 30px;">
                        <p style="color: #666; font-size: 14px; margin: 0;">
                            ⚠️ <strong>주의사항</strong><br><br>
                            • 이 링크는 <strong>1시간</strong> 동안만 유효합니다.<br>
                            • 본인이 요청하지 않았다면 이 메일을 무시해주세요.<br>
                            • 링크가 작동하지 않으면 아래 URL을 브라우저에 복사해주세요.
                        </p>
                        <p style="color: #999; font-size: 12px; word-break: break-all; margin-top: 15px;">
                            ${fullResetUrl}
                        </p>
                    </div>
                </div>

                <div style="background: #f8f9fa; padding: 20px; text-align: center;">
                    <p style="color: #999; font-size: 12px; margin: 0;">
                        본 메일은 P-ACA 시스템에서 자동 발송되었습니다.<br>
                        문의사항은 학원으로 연락해주세요.
                    </p>
                </div>
            </div>
        `
    };

    try {
        const result = await transporter.sendMail(mailOptions);
        console.log('Password reset email sent:', result.messageId);
        return { success: true, messageId: result.messageId };
    } catch (error) {
        console.error('Failed to send password reset email:', error);
        throw error;
    }
}

/**
 * 테스트 이메일 발송
 * @param {string} to - 수신자 이메일
 */
async function sendTestEmail(to) {
    const mailOptions = {
        from: '"P-ACA 학원관리시스템" <sean8320@gmail.com>',
        to: to,
        subject: '[P-ACA] 이메일 테스트',
        html: `
            <div style="padding: 20px; font-family: sans-serif;">
                <h2>이메일 발송 테스트</h2>
                <p>이 메일이 보이면 이메일 설정이 정상적으로 완료된 것입니다! ✅</p>
                <p>발송 시간: ${new Date().toLocaleString('ko-KR')}</p>
            </div>
        `
    };

    try {
        const result = await transporter.sendMail(mailOptions);
        console.log('Test email sent:', result.messageId);
        return { success: true, messageId: result.messageId };
    } catch (error) {
        console.error('Failed to send test email:', error);
        throw error;
    }
}

module.exports = {
    sendPasswordResetEmail,
    sendTestEmail,
    transporter
};
