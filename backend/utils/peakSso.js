const crypto = require('crypto');

const DEFAULT_TTL_SECONDS = 60;

function hashPeakSsoCode(code) {
  return crypto.createHash('sha256').update(code).digest('hex');
}

function createRawCode() {
  return crypto.randomBytes(32).toString('hex');
}

function normalizeTtlSeconds(ttlSeconds) {
  const parsed = Number(ttlSeconds);
  if (!Number.isInteger(parsed) || parsed <= 0 || parsed > 300) {
    return DEFAULT_TTL_SECONDS;
  }
  return parsed;
}

async function createPeakSsoCode(db, user, ttlSeconds = DEFAULT_TTL_SECONDS) {
  const userId = Number(user?.id || user?.userId);
  const academyId = Number(user?.academyId || user?.academy_id);

  if (!userId || !academyId) {
    throw new Error('PACA_USER_REQUIRED');
  }

  const code = createRawCode();
  const codeHash = hashPeakSsoCode(code);
  const safeTtlSeconds = normalizeTtlSeconds(ttlSeconds);

  await db.query(
    `DELETE FROM peak_sso_codes
     WHERE expires_at <= NOW() OR used_at IS NOT NULL`
  );

  await db.query(
    `INSERT INTO peak_sso_codes
     (code_hash, user_id, academy_id, expires_at)
     VALUES (?, ?, ?, DATE_ADD(NOW(), INTERVAL ${safeTtlSeconds} SECOND))`,
    [codeHash, userId, academyId]
  );

  return { code, codeHash, ttlSeconds: safeTtlSeconds };
}

module.exports = {
  createPeakSsoCode,
  hashPeakSsoCode,
};
