-- ============================================
-- P-ACA x 토스플레이스 연동 테이블
-- 생성일: 2025-12-22
-- ============================================

-- 토스 결제 이력 테이블
-- 자동 매칭된 결제 기록 저장
CREATE TABLE IF NOT EXISTS toss_payment_history (
    id INT AUTO_INCREMENT PRIMARY KEY,
    payment_id INT NOT NULL COMMENT 'student_payments FK',
    academy_id INT NOT NULL COMMENT '학원 ID',
    order_id VARCHAR(100) NOT NULL COMMENT '주문번호 (PACA-{payment_id}-{timestamp})',
    payment_key VARCHAR(100) NOT NULL COMMENT '토스 결제 키',
    amount DECIMAL(10, 0) NOT NULL COMMENT '결제 금액',
    method VARCHAR(20) COMMENT '결제 수단 (CARD, CASH, NFC, etc.)',
    approved_at DATETIME COMMENT '승인 시간',
    receipt_url VARCHAR(500) COMMENT '영수증 URL',
    card_company VARCHAR(50) COMMENT '카드사',
    card_number VARCHAR(20) COMMENT '카드번호 마스킹',
    installment_months INT DEFAULT 0 COMMENT '할부 개월',
    status VARCHAR(20) DEFAULT 'DONE' COMMENT '결제 상태',
    raw_data JSON COMMENT '원본 응답 데이터',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (payment_id) REFERENCES student_payments(id) ON DELETE CASCADE,
    FOREIGN KEY (academy_id) REFERENCES academies(id) ON DELETE CASCADE,
    INDEX idx_payment_id (payment_id),
    INDEX idx_academy_id (academy_id),
    INDEX idx_order_id (order_id),
    INDEX idx_payment_key (payment_key),
    INDEX idx_approved_at (approved_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
COMMENT='토스플레이스 결제 이력';

-- 토스 결제 수동 매칭 대기열
-- 자동 매칭 실패 시 저장, 관리자가 수동으로 매칭
CREATE TABLE IF NOT EXISTS toss_payment_queue (
    id INT AUTO_INCREMENT PRIMARY KEY,
    academy_id INT COMMENT '학원 ID (추정)',
    order_id VARCHAR(100) NOT NULL COMMENT '주문번호',
    payment_key VARCHAR(100) NOT NULL COMMENT '토스 결제 키',
    amount DECIMAL(10, 0) NOT NULL COMMENT '결제 금액',
    method VARCHAR(20) COMMENT '결제 수단',
    approved_at DATETIME COMMENT '승인 시간',
    receipt_url VARCHAR(500) COMMENT '영수증 URL',
    card_company VARCHAR(50) COMMENT '카드사',
    merchant_id VARCHAR(50) COMMENT '가맹점 ID',
    metadata JSON COMMENT '추가 메타데이터',
    raw_data JSON COMMENT '원본 응답 데이터',
    match_status ENUM('pending', 'matched', 'ignored', 'error') DEFAULT 'pending' COMMENT '매칭 상태',
    matched_payment_id INT COMMENT '매칭된 student_payments ID',
    matched_at DATETIME COMMENT '매칭 처리 시간',
    matched_by INT COMMENT '매칭 처리자 user_id',
    error_reason VARCHAR(500) COMMENT '오류 사유',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME ON UPDATE CURRENT_TIMESTAMP,

    INDEX idx_match_status (match_status),
    INDEX idx_academy_id (academy_id),
    INDEX idx_order_id (order_id),
    INDEX idx_created_at (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
COMMENT='토스 결제 수동 매칭 대기열';

-- 토스 연동 설정 테이블 (학원별)
CREATE TABLE IF NOT EXISTS toss_settings (
    id INT AUTO_INCREMENT PRIMARY KEY,
    academy_id INT NOT NULL COMMENT '학원 ID',
    merchant_id VARCHAR(50) COMMENT '토스 가맹점 ID',
    plugin_api_key VARCHAR(100) COMMENT '플러그인 API 키 (암호화)',
    callback_secret VARCHAR(100) COMMENT '콜백 서명 검증 시크릿 (암호화)',
    is_active TINYINT(1) DEFAULT 0 COMMENT '활성화 여부',
    auto_match_enabled TINYINT(1) DEFAULT 1 COMMENT '자동 매칭 사용',
    auto_receipt_print TINYINT(1) DEFAULT 1 COMMENT '자동 영수증 출력',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME ON UPDATE CURRENT_TIMESTAMP,

    UNIQUE KEY idx_academy (academy_id),
    FOREIGN KEY (academy_id) REFERENCES academies(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
COMMENT='토스플레이스 연동 설정';
