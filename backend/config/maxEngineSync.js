function academyIds() {
  const value = process.env.MAX_ENGINE_SYNC_ACADEMY_IDS;
  if (!value || !value.trim()) return null;
  const parts = value.split(',').map(id => id.trim());
  if (parts.some(id => !/^[1-9]\d*$/.test(id) || !Number.isSafeInteger(Number(id)))) return null;
  return new Set(parts.map(Number));
}
module.exports = {
  signingKey: () => process.env.MAX_ENGINE_SYNC_KEY || null,
  academyIds,
  pageSize: 200,
};
