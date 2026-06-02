CREATE TABLE IF NOT EXISTS peak_sso_codes (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  code_hash CHAR(64) NOT NULL,
  user_id BIGINT UNSIGNED NOT NULL,
  academy_id BIGINT UNSIGNED NOT NULL,
  expires_at DATETIME NOT NULL,
  used_at DATETIME NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uk_peak_sso_codes_hash (code_hash),
  KEY idx_peak_sso_codes_user (user_id),
  KEY idx_peak_sso_codes_expires (expires_at),
  KEY idx_peak_sso_codes_used (used_at)
);
