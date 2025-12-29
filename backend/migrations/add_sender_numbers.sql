-- 발신번호 관리 테이블
-- 솔라피/SENS에서 등록된 발신번호를 관리

CREATE TABLE IF NOT EXISTS sender_numbers (
    id INT AUTO_INCREMENT PRIMARY KEY,
    academy_id INT NOT NULL,
    service_type ENUM('solapi', 'sens') NOT NULL,  -- 서비스 타입
    phone VARCHAR(20) NOT NULL,  -- 발신번호 (010-1234-5678 형식)
    label VARCHAR(50),  -- 라벨 (예: 학원 대표번호, 원장님 번호)
    is_default TINYINT(1) DEFAULT 0,  -- 기본 발신번호 여부
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (academy_id) REFERENCES academies(id) ON DELETE CASCADE,
    UNIQUE KEY unique_sender (academy_id, service_type, phone)  -- 중복 방지
);

-- 기존 솔라피 발신번호를 sender_numbers 테이블로 마이그레이션
INSERT INTO sender_numbers (academy_id, service_type, phone, label, is_default)
SELECT
    ns.academy_id,
    'solapi',
    ns.solapi_sender_phone,
    '기본 발신번호',
    1
FROM notification_settings ns
WHERE ns.solapi_sender_phone IS NOT NULL
  AND ns.solapi_sender_phone != ''
ON DUPLICATE KEY UPDATE label = label;  -- 이미 있으면 무시
