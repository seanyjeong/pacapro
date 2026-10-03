-- Execute against the PEAK database only. Additive migration; no business rows altered.
-- 수납·출결·학생·상담 작업과 같은 트랜잭션. 본문·이름·연락처·토큰을 보관하지 않는다.
CREATE TABLE IF NOT EXISTS max_engine_commands (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  academy_id INT NOT NULL,
  user_id INT NOT NULL,
  idempotency_hash CHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  request_hash CHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  operation VARCHAR(40) NOT NULL,
  resource_id INT NOT NULL,
  result_json JSON NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY unique_actor_command (academy_id, user_id, idempotency_hash),
  KEY academy_audit (academy_id, created_at)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS max_engine_academy_locks (
  academy_id INT NOT NULL PRIMARY KEY
) ENGINE=InnoDB;
